import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createDocument, getDocument, getDb } from '../config/database';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { requireWriteAccess } from '../middleware/rbac';
import type { Monitor, Collection } from '@apiforge/shared';
import axios from 'axios';

const router = Router();

const parseScheduleToMs = (schedule: string): number => {
  // support simple: "every 5m", "every 1h", "every 30s", or cron "* * * * *"
  const every = schedule.match(/every\s+(\d+)(s|m|h)/);
  if (every) {
    const n = parseInt(every[1], 10);
    const unit = every[2];
    if (unit === 's') return n * 1000;
    if (unit === 'm') return n * 60 * 1000;
    if (unit === 'h') return n * 60 * 60 * 1000;
  }
  if (schedule.includes('*')) return 60 * 1000; // cron -> 1m for stub
  return 60 * 60 * 1000;
};

// Create monitor
router.post('/', authMiddleware, requireWriteAccess, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }
    const { collectionId, workspaceId, name, schedule, environmentId } = req.body;
    if (!collectionId || !workspaceId) { res.status(400).json({ success: false, error: 'collectionId and workspaceId required' }); return; }
    const now = new Date().toISOString();
    const delay = parseScheduleToMs(schedule || 'every 1h');
    const nextRun = new Date(Date.now() + delay).toISOString();
    const monitor: Monitor = {
      _id: `monitor:${uuidv4()}`,
      type: 'monitor',
      workspaceId,
      collectionId,
      environmentId,
      name: name || 'Monitor',
      schedule: schedule || 'every 1h',
      lastRun: undefined,
      nextRun,
      createdAt: now,
      updatedAt: now,
      createdBy: req.user.userId,
    };
    const created = await createDocument(monitor);
    res.status(201).json({ success: true, data: created });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to create monitor' });
  }
});

router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { workspaceId } = req.query;
    const db = getDb();
    const result = await db.view('app', 'by_type', { key: 'monitor', include_docs: true });
    let monitors = result.rows.map(r => r.doc as unknown as Monitor);
    if (workspaceId) monitors = monitors.filter(m => m.workspaceId === workspaceId);
    res.json({ success: true, data: monitors });
  } catch (e) { res.status(500).json({ success: false, error: 'Failed' }); }
});

router.get('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const m = await getDocument<Monitor>(req.params.id);
    if (!m) { res.status(404).json({ success: false, error: 'Not found' }); return; }
    res.json({ success: true, data: m });
  } catch (e) { res.status(500).json({ success: false, error: 'Failed' }); }
});

router.patch('/:id', authMiddleware, requireWriteAccess, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const existing = await db.get(req.params.id) as unknown as Monitor;
    const updated = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
    const result = await db.insert(updated as unknown as Parameters<typeof db.insert>[0]);
    res.json({ success: true, data: { ...updated, _rev: result.rev } });
  } catch (e) { res.status(500).json({ success: false, error: 'Failed' }); }
});

router.delete('/:id', authMiddleware, requireWriteAccess, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const doc = await db.get(req.params.id) as unknown as Record<string, unknown>;
    await db.destroy(req.params.id, doc._rev as string);
    res.json({ success: true, message: 'Deleted' });
  } catch (e) { res.status(500).json({ success: false, error: 'Failed' }); }
});

// Manual run
router.post('/:id/run', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const monitor = await getDocument<Monitor>(req.params.id);
    if (!monitor) { res.status(404).json({ success: false, error: 'Not found' }); return; }
    const collection = await getDocument<Collection>(monitor.collectionId);
    if (!collection) { res.status(404).json({ success: false, error: 'Collection not found' }); return; }

    const allReqs = [...collection.requests, ...collection.folders.flatMap(f => f.requests)];
    const results: Array<{ name: string; status: number; time: number }> = [];
    for (const r of allReqs.slice(0, 10)) { // limit 10
      try {
        const start = Date.now();
        let status = 200;
        try {
          const resp = await axios.request({ method: (r.method as string).toLowerCase(), url: r.url, timeout: 5000, validateStatus: () => true });
          status = resp.status;
        } catch { status = 0; }
        results.push({ name: r.name, status, time: Date.now() - start });
      } catch {
        results.push({ name: r.name, status: 0, time: 0 });
      }
    }

    // update lastRun/nextRun
    const db = getDb();
    const doc = await db.get(monitor._id) as unknown as Monitor;
    const delay = parseScheduleToMs(monitor.schedule);
    const updated = { ...doc, lastRun: new Date().toISOString(), nextRun: new Date(Date.now() + delay).toISOString(), updatedAt: new Date().toISOString() };
    await db.insert(updated as unknown as Parameters<typeof db.insert>[0]);

    res.json({ success: true, data: { monitor: updated, results } });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Monitor run failed' });
  }
});

export default router;
