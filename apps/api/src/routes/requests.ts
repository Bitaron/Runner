import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createDocument, getDocument, updateDocument, getDb } from '../config/database';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { requireWriteAccess } from '../middleware/rbac';
import { broadcastSyncEvent } from '../websocket';
import type { ApiRequest, TrashItem } from '@apiforge/shared';

const router = Router();

router.post('/', authMiddleware, requireWriteAccess, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { name, method, url, collectionId, folderId, workspaceId, params, headers, body, auth, preRequestScript, testScript } = req.body;

    if (!workspaceId) {
      res.status(400).json({ success: false, error: 'workspaceId is required' });
      return;
    }

    const finalWorkspaceId = workspaceId;

    const request: ApiRequest = {
      _id: `request:${uuidv4()}`,
      type: 'request',
      collectionId,
      folderId,
      workspaceId: finalWorkspaceId,
      name: name || 'New Request',
      method: method || 'GET',
      url: url || '',
      params: params || [],
      headers: headers || [],
      body: body || { mode: 'none' },
      auth: auth || { type: 'none', inheritFromParent: true },
      preRequestScript,
      testScript,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: req.user.userId,
    };

    const created = await createDocument(request);

    await broadcastSyncEvent(req.user.userId, finalWorkspaceId, {
      type: 'create',
      entityType: 'request',
      entityId: created._id,
      data: created,
      workspaceId: finalWorkspaceId,
    });

    res.status(201).json({ success: true, data: created });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create request' });
  }
});

router.get('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const request = await getDocument<ApiRequest>(req.params.id);
    
    if (!request) {
      res.status(404).json({ success: false, error: 'Request not found' });
      return;
    }

    res.json({ success: true, data: request });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get request' });
  }
});

router.patch('/:id', authMiddleware, requireWriteAccess, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const allowedFields = ['name', 'method', 'url', 'params', 'headers', 'body', 'auth', 'preRequestScript', 'testScript'];
    const updates: Partial<ApiRequest> = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        (updates as Record<string, unknown>)[field] = req.body[field];
      }
    });

    const updated = await updateDocument<ApiRequest>(req.params.id, updates);

    if (updated) {
      await broadcastSyncEvent(req.user.userId, updated.workspaceId, {
        type: 'update',
        entityType: 'request',
        entityId: updated._id,
        data: updated,
        workspaceId: updated.workspaceId,
      });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update request' });
  }
});

router.delete('/:id', authMiddleware, requireWriteAccess, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const request = await getDocument<ApiRequest>(req.params.id);
    
    if (!request) {
      res.status(404).json({ success: false, error: 'Request not found' });
      return;
    }

    const workspaceId = request.workspaceId;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    const trashItem: TrashItem = {
      _id: `trash:${uuidv4()}`,
      type: 'request',
      deletedId: request._id,
      deletedAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      data: request,
    };
    await createDocument(trashItem);
    await updateDocument<ApiRequest>(req.params.id, { deletedAt: new Date().toISOString() });

    await broadcastSyncEvent(req.user.userId, workspaceId, {
      type: 'delete',
      entityType: 'request',
      entityId: req.params.id,
      workspaceId,
    });

    res.json({ success: true, message: 'Request moved to trash' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete request' });
  }
});

router.post('/:id/restore', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }
    const request = await getDocument<ApiRequest>(req.params.id);
    if (!request) { res.status(404).json({ success: false, error: 'Request not found' }); return; }
    const db = getDb();
    // remove deletedAt
    const existing = await db.get(req.params.id) as unknown as Record<string, unknown>;
    delete (existing as Record<string, unknown>).deletedAt;
    (existing as Record<string, unknown>).updatedAt = new Date().toISOString();
    const result = await db.insert(existing as unknown as Parameters<typeof db.insert>[0]);
    const updated = { ...existing, _rev: result.rev } as unknown as ApiRequest;
    // cleanup trash
    const trashResult = await db.find({ selector: { deletedId: req.params.id } } as unknown as Parameters<typeof db.find>[0]);
    for (const doc of trashResult.docs) {
      await db.destroy((doc as unknown as Record<string, unknown>)._id as string, (doc as unknown as Record<string, unknown>)._rev as string);
    }
    await broadcastSyncEvent(req.user.userId, updated.workspaceId, {
      type: 'create',
      entityType: 'request',
      entityId: updated._id,
      data: updated,
      workspaceId: updated.workspaceId,
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to restore request' });
  }
});

export default router;
