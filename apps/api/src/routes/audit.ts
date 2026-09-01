import { Router, Response } from 'express';
import { getDb } from '../config/database';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { requireWorkspaceAccess } from '../middleware/rbac';
import type { AuditEntry } from '@apiforge/shared';

const router = Router();

router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }
    const { workspaceId, limit = '50' } = req.query;
    if (workspaceId && typeof workspaceId === 'string') {
      const wsCheck = await requireWorkspaceAccess(req.user.userId, workspaceId);
      if (!wsCheck.allowed) { res.status(wsCheck.status || 403).json({ success: false, error: wsCheck.error }); return; }
    }
    const db = getDb();
    const result = await db.view('app', 'by_type', { key: 'audit', include_docs: true });
    let entries = result.rows.map(r => r.doc as unknown as AuditEntry);
    if (workspaceId && typeof workspaceId === 'string') {
      entries = entries.filter(e => e.workspaceId === workspaceId);
    } else {
      // without workspaceId, only show entries from workspaces user can access
      const allowed: AuditEntry[] = [];
      for (const e of entries) {
        if (!e.workspaceId) {
          allowed.push(e);
          continue;
        }
        const c = await requireWorkspaceAccess(req.user!.userId, e.workspaceId);
        if (c.allowed) allowed.push(e);
      }
      entries = allowed;
    }
    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const n = Math.min(parseInt(limit as string, 10) || 50, 200);
    res.json({ success: true, data: entries.slice(0, n) });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to get audit' });
  }
});

export default router;
