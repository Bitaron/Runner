import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createDocument, getDocument, updateDocument, deleteDocument, findUserByEmail, getDb } from '../config/database';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import type { Team, User } from '@apiforge/shared';

const router = Router();

router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const db = getDb();
    const result = await db.view('app', 'by_type', {
      key: 'team',
      include_docs: true,
    });

    const teams = result.rows
      .map((row) => row.doc as Team)
      .filter((t) => t.ownerId === req.user!.userId || t.members.some((m) => m.userId === req.user!.userId));

    res.json({ success: true, data: teams });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get teams' });
  }
});

router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { name } = req.body;

    if (!name) {
      res.status(400).json({ success: false, error: 'Name is required' });
      return;
    }

    const team: Team = {
      _id: `team:${uuidv4()}`,
      type: 'team',
      name,
      ownerId: req.user.userId,
      members: [{
        userId: req.user.userId,
        email: req.user.email,
        name: 'Owner',
        role: 'owner',
        joinedAt: new Date().toISOString(),
      }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await createDocument(team);

    const user = await getDocument<User>(req.user.userId);
    if (user) {
      await updateDocument<User>(req.user.userId, {
        teams: [...(user.teams || []), team._id],
      });
    }

    res.status(201).json({ success: true, data: team });
  } catch (error) {
    console.error('Create team error:', error);
    res.status(500).json({ success: false, error: 'Failed to create team' });
  }
});

router.get('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const team = await getDocument<Team>(req.params.id);
    
    if (!team) {
      res.status(404).json({ success: false, error: 'Team not found' });
      return;
    }

    if (team.ownerId !== req.user.userId && !team.members.some((m) => m.userId === req.user!.userId)) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    res.json({ success: true, data: team });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get team' });
  }
});

router.patch('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const team = await getDocument<Team>(req.params.id);
    
    if (!team) {
      res.status(404).json({ success: false, error: 'Team not found' });
      return;
    }

    if (team.ownerId !== req.user.userId) {
      res.status(403).json({ success: false, error: 'Only owner can update team' });
      return;
    }

    const { name } = req.body;
    const updates: Partial<Team> = {};
    
    if (name !== undefined) updates.name = name;

    const updated = await updateDocument<Team>(req.params.id, updates);
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update team' });
  }
});

router.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const team = await getDocument<Team>(req.params.id);
    
    if (!team) {
      res.status(404).json({ success: false, error: 'Team not found' });
      return;
    }

    if (team.ownerId !== req.user.userId) {
      res.status(403).json({ success: false, error: 'Only owner can delete team' });
      return;
    }

    await deleteDocument(req.params.id);

    for (const member of team.members) {
      const user = await getDocument<User>(member.userId);
      if (user) {
        await updateDocument<User>(member.userId, {
          teams: user.teams.filter((t) => t !== team._id),
        });
      }
    }

    res.json({ success: true, message: 'Team deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete team' });
  }
});

router.post('/:id/members', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { email, role } = req.body;

    if (!email || !role) {
      res.status(400).json({ success: false, error: 'Email and role are required' });
      return;
    }

    if (!['admin', 'member'].includes(role)) {
      res.status(400).json({ success: false, error: 'Invalid role' });
      return;
    }

    const team = await getDocument<Team>(req.params.id);
    
    if (!team) {
      res.status(404).json({ success: false, error: 'Team not found' });
      return;
    }

    if (team.ownerId !== req.user.userId && !team.members.find((m) => m.userId === req.user!.userId && m.role === 'admin')) {
      res.status(403).json({ success: false, error: 'Only owner or admin can invite members' });
      return;
    }

    const user = await findUserByEmail(email);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found with this email' });
      return;
    }

    if (team.members.some((m) => m.userId === user._id)) {
      res.status(409).json({ success: false, error: 'User is already a member' });
      return;
    }

    const newMember = {
      userId: user._id,
      email: user.email,
      name: user.name,
      role: role as 'admin' | 'member',
      joinedAt: new Date().toISOString(),
    };

    team.members.push(newMember);
    const updated = await updateDocument<Team>(req.params.id, { members: team.members });

    await updateDocument<User>(user._id, {
      teams: [...(user.teams || []), team._id],
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Invite member error:', error);
    res.status(500).json({ success: false, error: 'Failed to invite member' });
  }
});

router.delete('/:id/members/:userId', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const team = await getDocument<Team>(req.params.id);
    
    if (!team) {
      res.status(404).json({ success: false, error: 'Team not found' });
      return;
    }

    const memberIndex = team.members.findIndex((m) => m.userId === req.params.userId);
    if (memberIndex === -1) {
      res.status(404).json({ success: false, error: 'Member not found' });
      return;
    }

    const isOwner = team.ownerId === req.user.userId;
    const isAdmin = team.members.find((m) => m.userId === req.user!.userId)?.role === 'admin';
    const isSelf = req.params.userId === req.user.userId;

    if (!isOwner && !isAdmin && !isSelf) {
      res.status(403).json({ success: false, error: 'Permission denied' });
      return;
    }

    if (team.members[memberIndex].role === 'owner') {
      res.status(403).json({ success: false, error: 'Cannot remove the owner' });
      return;
    }

    team.members.splice(memberIndex, 1);
    const updated = await updateDocument<Team>(req.params.id, { members: team.members });

    const memberUser = await getDocument<User>(req.params.userId);
    if (memberUser) {
      await updateDocument<User>(req.params.userId, {
        teams: memberUser.teams.filter((t) => t !== team._id),
      });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to remove member' });
  }
});

router.patch('/:id/members/:userId', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const team = await getDocument<Team>(req.params.id);
    
    if (!team) {
      res.status(404).json({ success: false, error: 'Team not found' });
      return;
    }

    if (team.ownerId !== req.user.userId) {
      res.status(403).json({ success: false, error: 'Only owner can change member roles' });
      return;
    }

    const memberIndex = team.members.findIndex((m) => m.userId === req.params.userId);
    if (memberIndex === -1) {
      res.status(404).json({ success: false, error: 'Member not found' });
      return;
    }

    const { role } = req.body;
    if (!['admin', 'member'].includes(role)) {
      res.status(400).json({ success: false, error: 'Invalid role' });
      return;
    }

    team.members[memberIndex].role = role;
    const updated = await updateDocument<Team>(req.params.id, { members: team.members });

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update member role' });
  }
});

export default router;
