import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createDocument, getDocument, updateDocument } from '../config/database';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { broadcastSyncEvent } from '../websocket';
import type { ApiRequest } from '@apiforge/shared';

const router = Router();

router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { name, method, url, collectionId, folderId, workspaceId, params, headers, body, auth, preRequestScript, testScript } = req.body;
    const finalWorkspaceId = workspaceId || 'default';

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
      auth: auth || { type: 'none' },
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

router.patch('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

router.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    await updateDocument<ApiRequest>(req.params.id, { deletedAt: new Date().toISOString() });

    await broadcastSyncEvent(req.user.userId, workspaceId, {
      type: 'delete',
      entityType: 'request',
      entityId: req.params.id,
      workspaceId,
    });

    res.json({ success: true, message: 'Request deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete request' });
  }
});

export default router;
