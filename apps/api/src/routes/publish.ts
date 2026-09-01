import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createDocument, getDocument, getDb } from '../config/database';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { requireWriteAccess } from '../middleware/rbac';
import { logAudit } from '../services/audit';
import type { PublishedDoc, Collection } from '@apiforge/shared';

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
    const slug = slugify(collection.name);
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
    const db = getDb();
    const result = await db.view('app', 'by_type', { key: 'published_doc', include_docs: true });
    let docs = result.rows.map(r => r.doc as unknown as PublishedDoc);
    if (workspaceId && typeof workspaceId === 'string') docs = docs.filter(d => d.workspaceId === workspaceId);
    res.json({ success: true, data: docs });
  } catch (e) { res.status(500).json({ success: false, error: 'Failed' }); }
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
    // redact secrets for public
    const redact = (vars: Collection['variables']) => vars.map(v => v.type === 'secret' ? { ...v, value: '***' } : v);
    const redactFolder = (f: Collection['folders'][number]): Collection['folders'][number] => ({ ...f, variables: redact(f.variables), folders: f.folders.map(redactFolder) });
    const redacted = { ...collection, variables: redact(collection.variables), folders: collection.folders.map(redactFolder) };
    res.json({ success: true, data: { published: doc, collection: redacted } });
  } catch (e) { res.status(500).json({ success: false, error: 'Failed' }); }
});

router.delete('/:id', authMiddleware, requireWriteAccess, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const doc = await db.get(req.params.id) as unknown as Record<string, unknown>;
    await db.destroy(req.params.id, doc._rev as string);
    res.json({ success: true, message: 'Unpublished' });
  } catch (e) { res.status(500).json({ success: false, error: 'Failed' }); }
});

export default router;
