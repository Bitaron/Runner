import { Router, Response } from 'express';
import { getDb } from '../config/database';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import type { Collection, ApiRequest } from '@apiforge/shared';

const router = Router();

interface SearchResult {
  type: 'collection' | 'request' | 'folder';
  id: string;
  name: string;
  url?: string;
  collectionId?: string;
  collectionName?: string;
  method?: string;
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
    const results: SearchResult[] = [];

    const allCollections = await db.view('app', 'by_type', {
      key: 'collection',
      include_docs: true,
    });

    const collections = allCollections.rows
      .map((row) => row.doc as Collection)
      .filter((c) => !c.deletedAt);

    const allRequests = await db.view('app', 'by_type', {
      key: 'request',
      include_docs: true,
    });

    const requests = allRequests.rows
      .map((row) => row.doc as ApiRequest)
      .filter((r) => !r.deletedAt);

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
