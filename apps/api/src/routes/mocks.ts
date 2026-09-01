import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createDocument, getDocument, getDb } from '../config/database';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { requireWriteAccess } from '../middleware/rbac';
import type { MockServer, Collection } from '@apiforge/shared';

const router = Router();

// Mock serving - public, no auth, must be before /:id
router.all('/:id/call/*', async (req, res) => {
  try {
    const mock = await getDocument<MockServer>(req.params.id);
    if (!mock) { res.status(404).json({ success: false, error: 'Mock not found' }); return; }

    // Optional: try to match collection request by path/method for dynamic mock
    let matchedBody: string | undefined;
    let matchedStatus = mock.statusCode || 200;
    let matchedHeaders = mock.headers || [];
    try {
      const coll = await getDocument<Collection>(mock.collectionId);
      if (coll) {
        const path = '/' + (req.params[0] || '');
        const method = req.method.toUpperCase();
        const allReqs = [...coll.requests, ...coll.folders.flatMap(f => f.requests)];
        const found = allReqs.find(r => {
          try {
            const u = new URL(r.url);
            return u.pathname === path && r.method.toUpperCase() === method;
          } catch { return r.url.endsWith(path) && r.method.toUpperCase() === method; }
        });
        if (found && found.body && found.body.mode === 'raw' && found.body.raw) {
          matchedBody = found.body.raw;
        }
      }
    } catch {}

    const body = matchedBody || mock.body || JSON.stringify({ mock: true, path: req.params[0], method: req.method }, null, 2);
    const delay = mock.delay || 0;
    if (delay) await new Promise(r => setTimeout(r, delay));

    matchedHeaders.forEach(h => { if (h.key && h.value) res.setHeader(h.key, h.value); });
    if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json');
    res.status(matchedStatus).send(body);
  } catch (e) {
    res.status(500).json({ success: false, error: 'Mock error' });
  }
});

// Create mock
router.post('/', authMiddleware, requireWriteAccess, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }
    const { collectionId, name, workspaceId, delay, statusCode, headers, body } = req.body;
    if (!collectionId || !workspaceId) { res.status(400).json({ success: false, error: 'collectionId and workspaceId required' }); return; }
    const mock: MockServer = {
      _id: `mock:${uuidv4()}`,
      type: 'mock',
      workspaceId,
      collectionId,
      name: name || 'Mock Server',
      url: `/mock/${uuidv4()}`,
      delay: delay || 0,
      statusCode: statusCode || 200,
      headers: headers || [],
      body: body || JSON.stringify({ message: 'Mock response' }, null, 2),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: req.user.userId,
    };
    const created = await createDocument(mock);
    res.status(201).json({ success: true, data: created });
  } catch (e) { res.status(500).json({ success: false, error: 'Failed to create mock' }); }
});

// List mocks
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { workspaceId } = req.query;
    const db = getDb();
    const result = await db.view('app', 'by_type', { key: 'mock', include_docs: true });
    let mocks = result.rows.map(r => r.doc as unknown as MockServer);
    if (workspaceId) mocks = mocks.filter(m => m.workspaceId === workspaceId);
    res.json({ success: true, data: mocks });
  } catch (e) { res.status(500).json({ success: false, error: 'Failed to get mocks' }); }
});

router.get('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const mock = await getDocument<MockServer>(req.params.id);
    if (!mock) { res.status(404).json({ success: false, error: 'Mock not found' }); return; }
    res.json({ success: true, data: mock });
  } catch (e) { res.status(500).json({ success: false, error: 'Failed' }); }
});

router.patch('/:id', authMiddleware, requireWriteAccess, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const existing = await db.get(req.params.id) as unknown as MockServer;
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    const result = await db.insert(updated as unknown as Parameters<typeof db.insert>[0]);
    res.json({ success: true, data: { ...updated, _rev: result.rev } });
  } catch (e) { res.status(500).json({ success: false, error: 'Failed to update mock' }); }
});

router.delete('/:id', authMiddleware, requireWriteAccess, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const doc = await db.get(req.params.id) as unknown as Record<string, unknown>;
    await db.destroy(req.params.id, doc._rev as string);
    res.json({ success: true, message: 'Mock deleted' });
  } catch (e) { res.status(500).json({ success: false, error: 'Failed to delete' }); }
});

export default router;
