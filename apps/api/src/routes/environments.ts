import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createDocument, getDocument, updateDocument, deleteDocument, getDb } from '../config/database';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import type { Environment } from '@apiforge/shared';

const router = Router();

router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { workspaceId } = req.query;
    const db = getDb();
    
    const result = await db.view('app', 'by_type', {
      key: 'environment',
      include_docs: true,
    });

    let environments = result.rows.map((row) => row.doc as Environment);
    
    if (workspaceId) {
      environments = environments.filter((e) => e.workspaceId === workspaceId);
    }

    res.json({ success: true, data: environments });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get environments' });
  }
});

router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, workspaceId, variables, isGlobal } = req.body;

    if (!name) {
      res.status(400).json({ success: false, error: 'Name is required' });
      return;
    }

    const environment: Environment = {
      _id: `env:${uuidv4()}`,
      type: 'environment',
      workspaceId: workspaceId || 'default',
      name,
      variables: variables || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isGlobal: isGlobal || false,
    };

    await createDocument(environment);
    res.status(201).json({ success: true, data: environment });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create environment' });
  }
});

router.get('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const environment = await getDocument<Environment>(req.params.id);
    
    if (!environment) {
      res.status(404).json({ success: false, error: 'Environment not found' });
      return;
    }

    res.json({ success: true, data: environment });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get environment' });
  }
});

router.patch('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { name, variables } = req.body;
    const updates: Partial<Environment> = {};
    
    if (name !== undefined) updates.name = name;
    if (variables !== undefined) updates.variables = variables;

    const updated = await updateDocument<Environment>(req.params.id, updates);
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update environment' });
  }
});

router.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    await deleteDocument(req.params.id);
    res.json({ success: true, message: 'Environment deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete environment' });
  }
});

export default router;
