import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createDocument, getDocument, updateDocument, getDb } from '../config/database';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { requireWriteAccess } from '../middleware/rbac';
import { broadcastSyncEvent } from '../websocket';
import { encryptVariables, decryptVariables } from '../services/vault';
import { logAudit } from '../services/audit';
import type { Environment, TrashItem, Variable } from '@apiforge/shared';

const router = Router();

const isValidVariables = (variables: unknown): boolean =>
  Array.isArray(variables) &&
  variables.every(
    (v) =>
      typeof v === 'object' &&
      v !== null &&
      typeof (v as Variable).key === 'string' &&
      (v as Variable).key.trim().length > 0 &&
      typeof (v as Variable).value === 'string'
  );

router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { workspaceId } = req.query;
    const db = getDb();
    
    const result = await db.view('app', 'by_type', {
      key: 'environment',
      include_docs: true,
    });

    let environments = result.rows
      .map((row) => row.doc as Environment)
      .filter((e) => !e.deletedAt)
      .map(e => ({ ...e, variables: decryptVariables(e.variables || []) }));
    
    if (workspaceId) {
      environments = environments.filter((e) => e.workspaceId === workspaceId);
    }

    res.json({ success: true, data: environments });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get environments' });
  }
});

router.post('/', authMiddleware, requireWriteAccess, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, workspaceId, variables, isGlobal, collectionId, forkedFrom } = req.body;

    if (!name) {
      res.status(400).json({ success: false, error: 'Name is required' });
      return;
    }

    if (variables !== undefined && !isValidVariables(variables)) {
      res.status(400).json({ success: false, error: 'Each variable must have a non-empty key and a string value' });
      return;
    }

    if (!workspaceId || typeof workspaceId !== 'string') {
      res.status(400).json({ success: false, error: 'workspaceId is required' });
      return;
    }

    const environment: Environment = {
      _id: `env:${uuidv4()}`,
      type: 'environment',
      workspaceId,
      collectionId,
      name,
      variables: encryptVariables(variables || []),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isGlobal: isGlobal || false,
      forkedFrom,
    };

    await createDocument(environment);
    await logAudit({ userId: req.user!.userId, userEmail: req.user!.email, action: 'environment.create', entityType: 'environment', entityId: environment._id, workspaceId, details: { name } });
    res.status(201).json({ success: true, data: { ...environment, variables: decryptVariables(environment.variables) } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create environment' });
  }
});

router.get('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const environment = await getDocument<Environment>(req.params.id);
    
    if (!environment || environment.deletedAt) {
      res.status(404).json({ success: false, error: 'Environment not found' });
      return;
    }

    res.json({ success: true, data: { ...environment, variables: decryptVariables(environment.variables || []) } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get environment' });
  }
});

router.patch('/:id', authMiddleware, requireWriteAccess, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const existing = await getDocument<Environment>(req.params.id);

    if (!existing || existing.deletedAt) {
      res.status(404).json({ success: false, error: 'Environment not found' });
      return;
    }

    const { name, variables } = req.body;
    const updates: Partial<Environment> = {};

    if (variables !== undefined && !isValidVariables(variables)) {
      res.status(400).json({ success: false, error: 'Each variable must have a non-empty key and a string value' });
      return;
    }
    
    if (name !== undefined) updates.name = name;
    if (variables !== undefined) updates.variables = encryptVariables(variables);

    const updated = await updateDocument<Environment>(req.params.id, updates);
    await logAudit({ userId: req.user!.userId, userEmail: req.user!.email, action: 'environment.update', entityType: 'environment', entityId: req.params.id, workspaceId: existing.workspaceId, details: { name } });
    res.json({ success: true, data: updated ? { ...updated, variables: decryptVariables(updated.variables || []) } : updated });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update environment' });
  }
});

router.delete('/:id', authMiddleware, requireWriteAccess, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const environment = await getDocument<Environment>(req.params.id);
    
    if (!environment || environment.deletedAt) {
      res.status(404).json({ success: false, error: 'Environment not found' });
      return;
    }

    const workspaceId = environment.workspaceId;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const trashItem: TrashItem = {
      _id: `trash:${uuidv4()}`,
      type: 'environment',
      deletedId: environment._id,
      deletedAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      data: environment,
    };

    await createDocument(trashItem);
    await updateDocument<Environment>(req.params.id, { deletedAt: new Date().toISOString() });

    await broadcastSyncEvent(req.user.userId, workspaceId, {
      type: 'delete',
      entityType: 'environment',
      entityId: req.params.id,
      workspaceId,
    });

    res.json({ success: true, message: 'Environment moved to trash' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete environment' });
  }
});

router.post('/:id/restore', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const environment = await getDocument<Environment>(req.params.id);
    
    if (!environment) {
      res.status(404).json({ success: false, error: 'Environment not found' });
      return;
    }

    const db = getDb();
    const raw = await db.get(req.params.id) as unknown as Record<string, unknown>;
    delete (raw as Record<string, unknown>).deletedAt;
    (raw as Record<string, unknown>).updatedAt = new Date().toISOString();
    await db.insert(raw as unknown as Parameters<typeof db.insert>[0]);
    const updated = await getDocument<Environment>(req.params.id);
    const trashResult = await db.find({ selector: { deletedId: req.params.id } } as unknown as Parameters<typeof db.find>[0]);
    for (const trashDoc of trashResult.docs) {
      await db.destroy((trashDoc as unknown as Record<string, unknown>)._id as string, (trashDoc as unknown as Record<string, unknown>)._rev as string);
    }

    await broadcastSyncEvent(req.user.userId, environment.workspaceId, {
      type: 'create',
      entityType: 'environment',
      entityId: updated!._id,
      data: updated,
      workspaceId: environment.workspaceId,
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to restore environment' });
  }
});

router.post('/:id/fork', authMiddleware, requireWriteAccess, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }
    const env = await getDocument<Environment>(req.params.id);
    if (!env || env.deletedAt) { res.status(404).json({ success: false, error: 'Environment not found' }); return; }
    const { name, workspaceId, collectionId } = req.body as { name?: string; workspaceId?: string; collectionId?: string };
    const fork: Environment = {
      _id: `env:${uuidv4()}`,
      type: 'environment',
      workspaceId: workspaceId || env.workspaceId,
      collectionId: collectionId || env.collectionId,
      name: name || `${env.name} (fork)`,
      variables: [...env.variables],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isGlobal: false,
      forkedFrom: env._id,
    };
    const created = await createDocument(fork);
    await broadcastSyncEvent(req.user.userId, fork.workspaceId, { type: 'create', entityType: 'environment', entityId: created._id, data: created, workspaceId: fork.workspaceId });
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fork environment' });
  }
});

export default router;
