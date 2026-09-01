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

    const { name, description, ownerType, ownerId } = req.body as { name?: string; description?: string; ownerType?: 'user' | 'team'; ownerId?: string };

    if (!name) {
      res.status(400).json({ success: false, error: 'Name is required' });
      return;
    }

    let finalOwnerType: 'user' | 'team' = 'user';
    let finalOwnerId = req.user.userId;

    if (ownerType === 'team' && ownerId) {
      const db = getDb();
      try {
        const teamDoc = await db.get(ownerId) as unknown as { _id: string; type: string; ownerId: string; members: Array<{ userId: string; role: string }> };
        if (teamDoc && teamDoc.type === 'team') {
          const isOwner = teamDoc.ownerId === req.user!.userId;
          const member = teamDoc.members.find(m => m.userId === req.user!.userId);
          const canCreate = isOwner || member?.role === 'admin';
          if (canCreate) {
            finalOwnerType = 'team';
            finalOwnerId = ownerId;
          } else {
            res.status(403).json({ success: false, error: 'Not authorized to create team workspace' });
            return;
          }
        } else {
          res.status(404).json({ success: false, error: 'Team not found' });
          return;
        }
      } catch {
        res.status(404).json({ success: false, error: 'Team not found' });
        return;
      }
    }

    const workspace: Workspace = {
      _id: `workspace:${uuidv4()}`,
      type: 'workspace',
      name,
      description,
      ownerType: finalOwnerType,
      ownerId: finalOwnerId,
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
