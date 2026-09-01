import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { getDb } from '../config/database';
import type { Team, Workspace } from '@apiforge/shared';

const checkWorkspaceWriteAccess = async (userId: string | undefined, workspaceId: string): Promise<{ allowed: boolean; error?: string; status?: number }> => {
  const db = getDb();
  let workspace: Workspace | null = null;
  try {
    workspace = await db.get(workspaceId) as unknown as Workspace;
  } catch {
    return { allowed: false, error: 'Workspace not found', status: 404 };
  }
  if (!workspace || workspace.type !== 'workspace') {
    return { allowed: false, error: 'Workspace not found', status: 404 };
  }
  if (workspace.ownerType === 'user') {
    if (workspace.ownerId !== userId) {
      return { allowed: false, error: 'Not authorized for workspace', status: 403 };
    }
    return { allowed: true };
  }
  if (workspace.ownerType === 'team') {
    let team: Team | null = null;
    try {
      team = await db.get(workspace.ownerId) as unknown as Team;
    } catch {
      return { allowed: false, error: 'Team not found', status: 404 };
    }
    if (!team) return { allowed: false, error: 'Team not found', status: 404 };
    const member = team.members.find(m => m.userId === userId);
    if (!member) return { allowed: false, error: 'Not a team member', status: 403 };
    if (member.role === 'viewer') return { allowed: false, error: 'Viewer cannot write', status: 403 };
    return { allowed: true };
  }
  return { allowed: false, error: 'Invalid workspace owner', status: 403 };
};

export const requireWorkspaceAccess = async (userId: string | undefined, workspaceId: string): Promise<{ allowed: boolean; error?: string; status?: number }> => {
  const db = getDb();
  let workspace: Workspace | null = null;
  try {
    workspace = await db.get(workspaceId) as unknown as Workspace;
  } catch {
    return { allowed: false, error: 'Workspace not found', status: 404 };
  }
  if (!workspace || workspace.type !== 'workspace') return { allowed: false, error: 'Workspace not found', status: 404 };
  if (workspace.ownerType === 'user') {
    if (workspace.ownerId !== userId) return { allowed: false, error: 'Not authorized for workspace', status: 403 };
    return { allowed: true };
  }
  if (workspace.ownerType === 'team') {
    try {
      const team = await db.get(workspace.ownerId) as unknown as Team;
      if (!team) return { allowed: false, error: 'Team not found', status: 404 };
      if (team.ownerId === userId || team.members.some(m => m.userId === userId)) return { allowed: true };
      return { allowed: false, error: 'Not a team member', status: 403 };
    } catch {
      return { allowed: false, error: 'Team not found', status: 404 };
    }
  }
  return { allowed: false, error: 'Invalid workspace', status: 403 };
};

export const requireWriteAccess = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    const workspaceId = (req.body?.workspaceId as string) || (req.query?.workspaceId as string) || (req.params?.workspaceId as string);
    let targetWorkspaceId: string | undefined = workspaceId;
    if (!targetWorkspaceId && req.params?.id) {
      try {
        const db = getDb();
        const doc = await db.get(req.params.id) as unknown as Record<string, unknown>;
        if (doc && typeof doc.workspaceId === 'string') targetWorkspaceId = doc.workspaceId as string;
        // team-owned published docs store workspaceId as well
        if (!targetWorkspaceId && typeof (doc as Record<string, unknown>).collectionId === 'string') {
          const coll = await db.get((doc as Record<string, unknown>).collectionId as string) as unknown as Record<string, unknown>;
          if (coll && typeof coll.workspaceId === 'string') targetWorkspaceId = coll.workspaceId as string;
        }
      } catch {}
    }
    // No workspace context (e.g. /api/workspaces POST without team, or personal pre-creation) -> allow,
    // but creation of team workspaces is already gated in workspaces.ts
    if (!targetWorkspaceId) {
      next();
      return;
    }

    const result = await checkWorkspaceWriteAccess(req.user.userId, targetWorkspaceId);
    if (!result.allowed) {
      res.status(result.status || 403).json({ success: false, error: result.error || 'Forbidden' });
      return;
    }
    next();
  } catch (error) {
    console.error('RBAC error:', error);
    res.status(403).json({ success: false, error: 'Forbidden' });
  }
};
