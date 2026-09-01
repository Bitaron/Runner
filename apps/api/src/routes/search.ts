import { Router, Response } from 'express';
import { getDb } from '../config/database';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { requireWorkspaceAccess } from '../middleware/rbac';
import type { Collection, ApiRequest } from '@apiforge/shared';

const router = Router();

interface SearchResult {
  type: 'collection' | 'request' | 'folder' | 'environment' | 'history';
  id: string;
  name: string;
  url?: string;
  collectionId?: string;
  collectionName?: string;
  method?: string;
  workspaceId?: string;
}

router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { q, workspaceId, type } = req.query;
    
    if (!q || typeof q !== 'string') {
      res.status(400).json({ success: false, error: 'Query parameter "q" is required' });
      return;
    }

    const searchQuery = q.toLowerCase();
    const db = getDb();

    // Enforce workspace scoping: if workspaceId given, verify access; if not, restrict to workspaces user can access
    if (workspaceId && typeof workspaceId === 'string') {
      const wsCheck = await requireWorkspaceAccess(req.user!.userId, workspaceId);
      if (!wsCheck.allowed) { res.status(wsCheck.status || 403).json({ success: false, error: wsCheck.error }); return; }
    }

    const allCollectionsRaw = await db.view('app', 'by_type', {
      key: 'collection',
      include_docs: true,
    });

    let collections = allCollectionsRaw.rows
      .map((row) => row.doc as Collection)
      .filter((c) => !c.deletedAt);

    // Filter to only workspaces caller can access when no explicit workspaceId filter
    if (!workspaceId) {
      const allowed: Collection[] = [];
      for (const c of collections) {
        const chk = await requireWorkspaceAccess(req.user!.userId, c.workspaceId);
        if (chk.allowed) allowed.push(c);
      }
      collections = allowed;
    }

    const allRequestsRaw = await db.view('app', 'by_type', {
      key: 'request',
      include_docs: true,
    });

    let requests = allRequestsRaw.rows
      .map((row) => row.doc as ApiRequest)
      .filter((r) => !r.deletedAt);
    if (!workspaceId) {
      const allowedReq: ApiRequest[] = [];
      for (const r of requests) {
        const chk = await requireWorkspaceAccess(req.user!.userId, r.workspaceId);
        if (chk.allowed) allowedReq.push(r);
      }
      requests = allowedReq;
    }

    const results: SearchResult[] = [];

    if (!type || type === 'collection' || type === 'all') {
      for (const collection of collections) {
        if (workspaceId && collection.workspaceId !== workspaceId) continue;

        if (collection.name.toLowerCase().includes(searchQuery)) {
          results.push({
            type: 'collection',
            id: collection._id,
            name: collection.name,
          });
        }

        if (collection.description?.toLowerCase().includes(searchQuery)) {
          results.push({
            type: 'collection',
            id: collection._id,
            name: `${collection.name} (description)`,
          });
        }

        if (type === 'all') {
          for (const variable of collection.variables) {
            if (variable.key.toLowerCase().includes(searchQuery) || variable.value.toLowerCase().includes(searchQuery)) {
              results.push({
                type: 'collection',
                id: collection._id,
                name: `${collection.name} (variable: ${variable.key})`,
              });
            }
          }
        }
      }
    }

    if (!type || type === 'request' || type === 'all') {
      for (const request of requests) {
        if (workspaceId && request.workspaceId !== workspaceId) continue;

        let matches = false;
        let matchName = request.name;

        if (request.name.toLowerCase().includes(searchQuery)) {
          matches = true;
          matchName = request.name;
        } else if (request.url.toLowerCase().includes(searchQuery)) {
          matches = true;
          matchName = `${request.name} - ${request.url}`;
        }

        if (matches) {
          const collection = collections.find((c) => 
            c._id === request.collectionId || 
            c.requests.some((r) => r._id === request._id)
          );

          results.push({
            type: 'request',
            id: request._id,
            name: matchName,
            url: request.url,
            collectionId: request.collectionId,
            collectionName: collection?.name,
            method: request.method,
          });
        }
      }
    }

    if (type === 'all') {
      const searchFolders = (folders: Collection['folders'], collectionName: string, collectionId: string) => {
        for (const folder of folders) {
          if (folder.name.toLowerCase().includes(searchQuery)) {
            results.push({
              type: 'folder',
              id: folder._id,
              name: `${collectionName} / ${folder.name}`,
              collectionId,
              collectionName,
            });
          }

          if (folder.description?.toLowerCase().includes(searchQuery)) {
            results.push({
              type: 'folder',
              id: folder._id,
              name: `${collectionName} / ${folder.name} (description)`,
              collectionId,
              collectionName,
            });
          }

          searchFolders(folder.folders, `${collectionName} / ${folder.name}`, collectionId);
        }
      };

      for (const collection of collections) {
        searchFolders(collection.folders, collection.name, collection._id);
      }
    }

    // ── Environment search (name, variables) ──
    if (!type || type === 'environment' || type === 'all') {
      try {
        const envView = await db.view('app', 'by_type', { key: 'environment', include_docs: true });
        let envs = envView.rows.map(r => r.doc as unknown as { _id: string; name: string; workspaceId?: string; variables?: Array<{ key: string; value: string }>; deletedAt?: string }).filter(e => !e.deletedAt);
        // filter envs to accessible workspaces when no explicit workspaceId
        if (!workspaceId) {
          const allowedEnv: typeof envs = [];
          for (const e of envs) {
            if (!e.workspaceId) continue;
            const chk = await requireWorkspaceAccess(req.user!.userId, e.workspaceId);
            if (chk.allowed) allowedEnv.push(e);
          }
          envs = allowedEnv;
        }
        for (const env of envs) {
          if (workspaceId && env.workspaceId !== workspaceId) continue;
          if (env.name.toLowerCase().includes(searchQuery)) {
            results.push({ type: 'environment', id: env._id, name: env.name, workspaceId: env.workspaceId });
          } else if (env.variables?.some(v => v.key.toLowerCase().includes(searchQuery) || v.value.toLowerCase().includes(searchQuery))) {
            const match = env.variables.find(v => v.key.toLowerCase().includes(searchQuery) || v.value.toLowerCase().includes(searchQuery));
            results.push({ type: 'environment', id: env._id, name: `${env.name} (var: ${match?.key})`, workspaceId: env.workspaceId });
          }
        }
      } catch {}
    }

    // ── History search (request name/url/method) ──
    if (!type || type === 'history' || type === 'all') {
      try {
        const histView = await db.view('app', 'by_user', { key: req.user!.userId, include_docs: true });
        const entries = histView.rows.map(r => r.doc as unknown as { _id: string; type: string; workspaceId?: string; request?: { name: string; url: string; method: string } }).filter(h => h.type === 'history');
        for (const h of entries) {
          if (workspaceId && h.workspaceId !== workspaceId) continue;
          const reqDoc = h.request;
          if (!reqDoc) continue;
          if (reqDoc.name.toLowerCase().includes(searchQuery) || reqDoc.url.toLowerCase().includes(searchQuery) || reqDoc.method.toLowerCase().includes(searchQuery)) {
            results.push({ type: 'history', id: h._id, name: `${reqDoc.method} ${reqDoc.name || reqDoc.url}`, url: reqDoc.url, method: reqDoc.method, workspaceId: h.workspaceId });
          }
        }
      } catch {}
    }

    res.json({
      success: true,
      data: {
        results,
        total: results.length,
        query: q,
      },
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ success: false, error: 'Search failed' });
  }
});

export default router;
