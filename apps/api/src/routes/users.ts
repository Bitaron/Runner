import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createDocument, getDocument, updateDocument, deleteDocument, findByType } from '../config/database';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import type { User, Team, Workspace } from '@apiforge/shared';

const router = Router();

router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.isAnonymous) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const user = await getDocument<User>(req.user.userId);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get user' });
  }
});

router.patch('/', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.isAnonymous) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { name, settings } = req.body;
    const updates: Partial<User> = {};
    
    if (name) updates.name = name;
    if (settings) updates.settings = { ...(await getDocument<User>(req.user.userId))?.settings, ...settings };

    const updated = await updateDocument<User>(req.user.userId, updates);
    const { passwordHash: _, ...userWithoutPassword } = updated;
    
    res.json({ success: true, data: userWithoutPassword });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update user' });
  }
});

export default router;
