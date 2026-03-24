import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createDocument, getDocument, updateDocument, deleteDocument, findByType, getDb } from '../config/database';
import { authMiddleware, optionalAuth, AuthenticatedRequest } from '../middleware/auth';
import type { Workspace } from '@apiforge/shared';

const router = Router();

router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const db = getDb();
    const result = await db.view('app', 'by_type', { 
      key: 'workspace', 
      include_docs: true 
    });

    const workspaces = result.rows
      .map((row) => row.doc as Workspace)
      .filter((w) => 
        (w.ownerType === 'user' && w.ownerId === req.user!.userId) ||
        (w.ownerType === 'team' && req.user!.teams?.includes(w.ownerId))
      );

    res.json({ success: true, data: workspaces });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get workspaces' });
  }
});

router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { name, description } = req.body;

    if (!name) {
      res.status(400).json({ success: false, error: 'Name is required' });
      return;
    }

    const workspace: Workspace = {
      _id: `workspace:${uuidv4()}`,
      type: 'workspace',
      name,
      description,
      ownerType: 'user',
      ownerId: req.user.userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await createDocument(workspace);
    res.status(201).json({ success: true, data: workspace });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create workspace' });
  }
});

router.get('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const workspace = await getDocument<Workspace>(req.params.id);
    
    if (!workspace) {
      res.status(404).json({ success: false, error: 'Workspace not found' });
      return;
    }

    res.json({ success: true, data: workspace });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get workspace' });
  }
});

router.patch('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { name, description } = req.body;
    const updates: Partial<Workspace> = {};
    
    if (name) updates.name = name;
    if (description !== undefined) updates.description = description;

    const updated = await updateDocument<Workspace>(req.params.id, updates);
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update workspace' });
  }
});

router.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    await deleteDocument(req.params.id);
    res.json({ success: true, message: 'Workspace deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete workspace' });
  }
});

export default router;
