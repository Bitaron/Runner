import { Router, Response } from 'express';
import { getDb, getDocument } from '../config/database';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { requireWorkspaceAccess } from '../middleware/rbac';
import { broadcastSyncEvent } from '../websocket';
import type { TrashItem, Collection, Environment, ApiRequest, Folder } from '@apiforge/shared';

const router = Router();

const isExpired = (item: TrashItem): boolean => {
  try { return new Date(item.expiresAt).getTime() < Date.now(); } catch { return false; }
};

// GET /api/trash?workspaceId=xxx  - list trash items for workspace(s)
router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }
    const { workspaceId } = req.query;
    if (workspaceId && typeof workspaceId === 'string') {
      const wsCheck = await requireWorkspaceAccess(req.user.userId, workspaceId);
      if (!wsCheck.allowed) { res.status(wsCheck.status || 403).json({ success: false, error: wsCheck.error }); return; }
    }
    const db = getDb();

    // Find all trash items - filter by type TrashItem via mango index
    const result = await db.find({ selector: { type: { $in: ['collection','request','environment','folder'] }, deletedId: { $exists: true } } } as unknown as Parameters<typeof db.find>[0]);
    let items = (result.docs as unknown as TrashItem[]).filter(d => d && typeof (d as unknown as Record<string, unknown>).deletedId === 'string' && (d as unknown as Record<string, unknown>).type !== 'audit');

    // Filter by workspace access before cleanup to avoid leaking cross-workspace expired cleanup side-effects
    if (workspaceId && typeof workspaceId === 'string') {
      items = items.filter(i => {
        const data = i.data as unknown as Record<string, unknown>;
        return data.workspaceId === workspaceId || (data as unknown as Collection)?.workspaceId === workspaceId;
      });
    } else {
      const allowed: TrashItem[] = [];
      for (const it of items) {
        const wsId = (it.data as unknown as Record<string, unknown>).workspaceId as string | undefined;
        if (!wsId) continue;
        const c = await requireWorkspaceAccess(req.user!.userId, wsId);
        if (c.allowed) allowed.push(it);
      }
      items = allowed;
    }

    // Cleanup expired (30d) - only for filtered items caller can see
    const expired = items.filter(isExpired);
    for (const exp of expired) {
      try {
        const trashDoc = await db.get(exp._id) as unknown as TrashItem & { _rev?: string };
        if (trashDoc) await db.destroy(exp._id, (trashDoc as unknown as Record<string, unknown>)._rev as string);
        try {
          const doomed = await db.get(exp.deletedId) as unknown as Record<string, unknown>;
          if (doomed) await db.destroy(exp.deletedId, doomed._rev as string);
        } catch {}
      } catch {}
    }
    items = items.filter(i => !isExpired(i));

    // sort by deletedAt desc
    items.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());

    res.json({ success: true, data: items });
  } catch (error) {
    console.error('Trash list error:', error);
    res.status(500).json({ success: false, error: 'Failed to get trash' });
  }
});

// POST /api/trash/:id/restore
router.post('/:id/restore', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }
    const db = getDb();
    const trashItem = await getDocument<TrashItem>(req.params.id);
    if (!trashItem) { res.status(404).json({ success: false, error: 'Trash item not found' }); return; }
    const wsId = (trashItem.data as unknown as Record<string, unknown>).workspaceId as string | undefined;
    if (wsId) {
      const wsCheck = await requireWorkspaceAccess(req.user.userId, wsId);
      if (!wsCheck.allowed) { res.status(wsCheck.status || 403).json({ success: false, error: wsCheck.error }); return; }
    }

    const deletedId = trashItem.deletedId;
    const data = trashItem.data as unknown as Record<string, unknown>;

    // Restore the soft-deleted doc: remove deletedAt
    try {
      const existing = await db.get(deletedId) as unknown as Record<string, unknown>;
      if (existing) {
        delete (existing as Record<string, unknown>).deletedAt;
        (existing as Record<string, unknown>).updatedAt = new Date().toISOString();
        await db.insert(existing as unknown as Parameters<typeof db.insert>[0]);
      } else {
        // if soft-deleted doc was already hard-deleted, recreate from trash data
        const recreated = { ...data, _id: deletedId, _rev: undefined } as unknown as Record<string, unknown>;
        delete recreated.deletedAt;
        (recreated as Record<string, unknown>).updatedAt = new Date().toISOString();
        await db.insert(recreated as unknown as Parameters<typeof db.insert>[0]);
      }
    } catch (e) {
      // try to recreate
      try {
        const recreated = { ...data, _id: deletedId } as unknown as Record<string, unknown>;
        delete recreated.deletedAt;
        await db.insert(recreated as unknown as Parameters<typeof db.insert>[0]);
      } catch {}
    }

    // remove trash item
    try {
      const trashDoc = await db.get(trashItem._id) as unknown as Record<string, unknown>;
      await db.destroy(trashItem._id, trashDoc._rev as string);
    } catch {}

    // broadcast restore
    const workspaceId = (data.workspaceId as string) || 'default';
    await broadcastSyncEvent(req.user.userId, workspaceId, {
      type: 'create',
      entityType: trashItem.type === 'collection' ? 'collection' : trashItem.type === 'environment' ? 'environment' : trashItem.type === 'request' ? 'request' : 'collection',
      entityId: deletedId,
      data: data,
      workspaceId,
    } as Parameters<typeof broadcastSyncEvent>[2]);

    res.json({ success: true, message: 'Restored', data });
  } catch (error) {
    console.error('Trash restore error:', error);
    res.status(500).json({ success: false, error: 'Failed to restore' });
  }
});

// DELETE /api/trash/:id  - permanent delete
router.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }
    const db = getDb();
    const trashItem = await getDocument<TrashItem>(req.params.id);
    if (!trashItem) { res.status(404).json({ success: false, error: 'Trash item not found' }); return; }
    const wsId = (trashItem.data as unknown as Record<string, unknown>).workspaceId as string | undefined;
    if (wsId) {
      const wsCheck = await requireWorkspaceAccess(req.user.userId, wsId);
      if (!wsCheck.allowed) { res.status(wsCheck.status || 403).json({ success: false, error: wsCheck.error }); return; }
    }

    // delete trash doc
    try {
      const trashDoc = await db.get(trashItem._id) as unknown as Record<string, unknown>;
      await db.destroy(trashItem._id, trashDoc._rev as string);
    } catch {}

    // also permanently delete the soft-deleted doc
    try {
      const doomed = await db.get(trashItem.deletedId) as unknown as Record<string, unknown>;
      if (doomed) await db.destroy(trashItem.deletedId, doomed._rev as string);
    } catch {}

    res.json({ success: true, message: 'Permanently deleted' });
  } catch (error) {
    console.error('Trash delete error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete' });
  }
});

export default router;
