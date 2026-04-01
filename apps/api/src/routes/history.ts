import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createDocument, getDb } from '../config/database';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import type { HistoryEntry, ApiRequest } from '@apiforge/shared';

const router = Router();

router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const db = getDb();
    const result = await db.view('app', 'by_user', {
      key: req.user.userId,
      include_docs: true,
    });

    const history = result.rows
      .map((row) => row.doc as HistoryEntry)
      .filter((h) => h.type === 'history')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 100);

    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get history' });
  }
});

router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { request, response, workspaceId } = req.body;

    const historyEntry: HistoryEntry = {
      _id: `history:${uuidv4()}`,
      type: 'history',
      userId: req.user.userId,
      workspaceId: workspaceId || 'default',
      request,
      response,
      timestamp: new Date().toISOString(),
    };

    await createDocument(historyEntry);
    res.status(201).json({ success: true, data: historyEntry });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to save to history' });
  }
});

router.delete('/', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const db = getDb();
    const result = await db.view('app', 'by_user', {
      key: req.user.userId,
      include_docs: true,
    });

    const historyDocs = result.rows
      .filter((row) => (row.doc as HistoryEntry).type === 'history');

    for (const row of historyDocs) {
      await db.destroy(row.id, (row as any).value?.rev);
    }

    res.json({ success: true, message: 'History cleared' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to clear history' });
  }
});

router.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const doc = await db.get(req.params.id);
    await db.destroy(req.params.id, doc._rev);
    res.json({ success: true, message: 'History entry deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete history entry' });
  }
});

export default router;
