import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { getDb } from '../config/database';
import type { Team, Workspace } from '@apiforge/shared';

export const requireWriteAccess = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const workspaceId = (req.body?.workspaceId as string) || (req.query?.workspaceId as string) || (req.params?.workspaceId as string);
    // also try to get from collection/environment/monitor's workspace
    let targetWorkspaceId: string | undefined = workspaceId;
    if (!targetWorkspaceId && req.params?.id) {
      try {
        const db = getDb();
        const doc = await db.get(req.params.id) as unknown as Record<string, unknown>;
        if (doc && typeof doc.workspaceId === 'string') targetWorkspaceId = doc.workspaceId as string;
        // for collection fork, the source collection's workspace
      } catch {}
    }
    if (!targetWorkspaceId) { next(); return; }

    const db = getDb();
    let workspace: Workspace | null = null;
    try { workspace = await db.get(targetWorkspaceId) as unknown as Workspace; } catch { workspace = null; }
    if (!workspace) { next(); return; } // if workspace not found, allow (maybe personal)
    if (workspace.ownerType === 'user') { next(); return; } // personal workspace, owner always has write
    if (workspace.ownerType === 'team') {
      try {
        const team = await db.get(workspace.ownerId) as unknown as Team;
        if (!team) { next(); return; }
        const member = team.members.find(m => m.userId === req.user?.userId);
        if (!member) { res.status(403).json({ success: false, error: 'Not a team member' }); return; }
        if (member.role === 'viewer') { res.status(403).json({ success: false, error: 'Viewer cannot write' }); return; }
        // owner/admin/member have write
      } catch { /* ignore */ }
    }
    next();
  } catch {
    next();
  }
};
