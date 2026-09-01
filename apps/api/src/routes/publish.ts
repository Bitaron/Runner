import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createDocument, getDocument, getDb } from '../config/database';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { requireWriteAccess, requireWorkspaceAccess } from '../middleware/rbac';
import { logAudit } from '../services/audit';
import type { PublishedDoc, Collection, AuthConfig } from '@apiforge/shared';

const router = Router();

const slugify = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) + '-' + uuidv4().slice(0, 6);

// POST /api/publish - publish collection
router.post('/', authMiddleware, requireWriteAccess, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }
    const { collectionId, workspaceId, isPublic = true } = req.body;
    if (!collectionId) { res.status(400).json({ success: false, error: 'collectionId required' }); return; }
    const collection = await getDocument<Collection>(collectionId);
    if (!collection) { res.status(404).json({ success: false, error: 'Collection not found' }); return; }
    // verify caller has access to collection's workspace
    const wsCheck = await requireWorkspaceAccess(req.user.userId, collection.workspaceId);
    if (!wsCheck.allowed) { res.status(wsCheck.status || 403).json({ success: false, error: wsCheck.error }); return; }
    if (workspaceId && workspaceId !== collection.workspaceId) {
      const ws2 = await requireWorkspaceAccess(req.user.userId, workspaceId);
      if (!ws2.allowed) { res.status(ws2.status || 403).json({ success: false, error: ws2.error }); return; }
    }
    // ensure slug uniqueness (retry on collision)
    const db = getDb();
    let slug = slugify(collection.name);
    for (let i = 0; i < 5; i++) {
      const existing = await db.view('app', 'by_type', { key: 'published_doc', include_docs: true });
      const collision = existing.rows.map(r => r.doc as unknown as PublishedDoc).some(d => d.slug === slug);
      if (!collision) break;
      slug = slugify(collection.name);
    }
    const doc: PublishedDoc = {
      _id: `published:${uuidv4()}`,
      type: 'published_doc',
      collectionId,
      workspaceId: workspaceId || collection.workspaceId,
      slug,
      isPublic,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: req.user.userId,
    };
    const created = await createDocument(doc);
    await logAudit({ userId: req.user!.userId, userEmail: req.user!.email, action: 'collection.publish', entityType: 'collection', entityId: collectionId, workspaceId: doc.workspaceId, details: { slug } });
    res.status(201).json({ success: true, data: created });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to publish' });
  }
});

router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { workspaceId } = req.query;
    if (workspaceId && typeof workspaceId === 'string') {
      const wsCheck = await requireWorkspaceAccess(req.user!.userId, workspaceId);
      if (!wsCheck.allowed) { res.status(wsCheck.status || 403).json({ success: false, error: wsCheck.error }); return; }
    }
    const db = getDb();
    const result = await db.view('app', 'by_type', { key: 'published_doc', include_docs: true });
    let docs = result.rows.map(r => r.doc as unknown as PublishedDoc);
    if (workspaceId && typeof workspaceId === 'string') {
      docs = docs.filter(d => d.workspaceId === workspaceId);
    } else {
      // without workspaceId, only return docs from workspaces caller can access
      const filtered: PublishedDoc[] = [];
      for (const d of docs) {
        const c = await requireWorkspaceAccess(req.user!.userId, d.workspaceId);
        if (c.allowed) filtered.push(d);
      }
      docs = filtered;
    }
    res.json({ success: true, data: docs });
  } catch (e) { res.status(500).json({ success: false, error: 'Failed' }); }
});

const redactAuth = (auth: AuthConfig | undefined): AuthConfig | undefined => {
  if (!auth || auth.type === 'none') return auth;
  const redacted: AuthConfig = { type: auth.type, inheritFromParent: auth.inheritFromParent } as AuthConfig;
  // never expose credential fields publicly; keep type but strip secrets
  return redacted;
};

const redactRequestAuth = (r: Collection['requests'][number]): Collection['requests'][number] => ({
  ...r,
  auth: redactAuth(r.auth),
  headers: r.headers?.map(h => {
    const k = h.key.toLowerCase();
    if (k === 'authorization' || k === 'cookie' || k === 'x-api-key') return { ...h, value: '***' };
    return h;
  }),
});

// Public: GET /api/publish/slug/:slug
router.get('/slug/:slug', async (req, res): Promise<void> => {
  try {
    const db = getDb();
    const result = await db.view('app', 'by_type', { key: 'published_doc', include_docs: true });
    const doc = result.rows.map(r => r.doc as unknown as PublishedDoc).find(d => d.slug === req.params.slug);
    if (!doc || !doc.isPublic) { res.status(404).json({ success: false, error: 'Not found' }); return; }
    const collection = await getDocument<Collection>(doc.collectionId);
    if (!collection) { res.status(404).json({ success: false, error: 'Collection not found' }); return; }
    // redact secrets + auth for public
    const redactVars = (vars: Collection['variables']) => vars.map(v => v.type === 'secret' ? { ...v, value: '***' } : v);
    const redactFolder = (f: Collection['folders'][number]): Collection['folders'][number] => ({
      ...f,
      auth: redactAuth(f.auth),
      variables: redactVars(f.variables),
      folders: f.folders.map(redactFolder),
      requests: f.requests.map(redactRequestAuth),
    });
    const redacted: Collection = {
      ...collection,
      auth: redactAuth(collection.auth),
      variables: redactVars(collection.variables),
      folders: collection.folders.map(redactFolder),
      requests: collection.requests.map(redactRequestAuth),
    };
    res.json({ success: true, data: { published: doc, collection: redacted } });
  } catch (e) { res.status(500).json({ success: false, error: 'Failed' }); }
});

router.delete('/:id', authMiddleware, requireWriteAccess, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const doc = await getDocument<PublishedDoc>(req.params.id);
    if (!doc) { res.status(404).json({ success: false, error: 'Not found' }); return; }
    const wsCheck = await requireWorkspaceAccess(req.user!.userId, doc.workspaceId);
    if (!wsCheck.allowed) { res.status(wsCheck.status || 403).json({ success: false, error: wsCheck.error }); return; }
    const db = getDb();
    const raw = await db.get(req.params.id) as unknown as Record<string, unknown>;
    await db.destroy(req.params.id, raw._rev as string);
    res.json({ success: true, message: 'Unpublished' });
  } catch (e) { res.status(500).json({ success: false, error: 'Failed' }); }
});

export default router;
