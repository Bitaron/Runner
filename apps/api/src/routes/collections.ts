import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createDocument, getDocument, updateDocument, findByWorkspace, getDb } from '../config/database';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { broadcastSyncEvent } from '../websocket';
import type { Collection, Folder, TrashItem } from '@apiforge/shared';

const router = Router();

router.get('/', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { workspaceId } = req.query;
    const db = getDb();

    let collections: Collection[];

    if (workspaceId) {
      const result = await db.view('app', 'by_workspace', {
        key: workspaceId,
        include_docs: true,
      });
      collections = result.rows
        .map((row) => row.doc as Collection)
        .filter((doc) => doc.type === 'collection' && !doc.deletedAt);
    } else {
      const result = await db.view('app', 'by_type', {
        key: 'collection',
        include_docs: true,
      });
      collections = result.rows
        .map((row) => row.doc as Collection)
        .filter((doc) => !doc.deletedAt);
    }

    res.json({ success: true, data: collections });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get collections' });
  }
});

router.post('/', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { name, description, workspaceId, variables, auth, preRequestScript, testScript } = req.body;

    if (!name) {
      res.status(400).json({ success: false, error: 'Name is required' });
      return;
    }

    const finalWorkspaceId = workspaceId || 'default';

    const collection: Collection = {
      _id: `collection:${uuidv4()}`,
      type: 'collection',
      workspaceId: finalWorkspaceId,
      name,
      description,
      variables: variables || [],
      auth,
      preRequestScript,
      testScript,
      folders: [],
      requests: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: req.user.userId,
    };

    const created = await createDocument(collection);

    await broadcastSyncEvent(req.user.userId, finalWorkspaceId, {
      type: 'create',
      entityType: 'collection',
      entityId: created._id,
      data: created,
      workspaceId: finalWorkspaceId,
    });

    res.status(201).json({ success: true, data: created });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create collection' });
  }
});

router.get('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const collection = await getDocument<Collection>(req.params.id);
    
    if (!collection) {
      res.status(404).json({ success: false, error: 'Collection not found' });
      return;
    }

    res.json({ success: true, data: collection });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get collection' });
  }
});

router.patch('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { name, description, variables, auth, preRequestScript, testScript, folders, requests } = req.body;
    const updates: Partial<Collection> = {};
    
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (variables !== undefined) updates.variables = variables;
    if (auth !== undefined) updates.auth = auth;
    if (preRequestScript !== undefined) updates.preRequestScript = preRequestScript;
    if (testScript !== undefined) updates.testScript = testScript;
    if (folders !== undefined) updates.folders = folders;
    if (requests !== undefined) updates.requests = requests;

    const updated = await updateDocument<Collection>(req.params.id, updates);

    if (updated) {
      await broadcastSyncEvent(req.user.userId, updated.workspaceId, {
        type: 'update',
        entityType: 'collection',
        entityId: updated._id,
        data: updated,
        workspaceId: updated.workspaceId,
      });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update collection' });
  }
});

router.delete('/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const collection = await getDocument<Collection>(req.params.id);
    
    if (!collection) {
      res.status(404).json({ success: false, error: 'Collection not found' });
      return;
    }

    const workspaceId = collection.workspaceId;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const trashItem: TrashItem = {
      _id: `trash:${uuidv4()}`,
      type: 'collection',
      deletedId: collection._id,
      deletedAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      data: collection,
    };

    await createDocument(trashItem);
    await updateDocument<Collection>(req.params.id, { deletedAt: new Date().toISOString() });

    await broadcastSyncEvent(req.user.userId, workspaceId, {
      type: 'delete',
      entityType: 'collection',
      entityId: req.params.id,
      workspaceId,
    });

    res.json({ success: true, message: 'Collection moved to trash' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete collection' });
  }
});

router.post('/:id/restore', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const collection = await getDocument<Collection>(req.params.id);
    
    if (!collection) {
      res.status(404).json({ success: false, error: 'Collection not found' });
      return;
    }

    const updated = await updateDocument<Collection>(req.params.id, { deletedAt: undefined });

    await broadcastSyncEvent(req.user.userId, collection.workspaceId, {
      type: 'create',
      entityType: 'collection',
      entityId: updated!._id,
      data: updated,
      workspaceId: collection.workspaceId,
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to restore collection' });
  }
});

router.post('/:id/folders', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { name, description, parentFolderId } = req.body;

    if (!name) {
      res.status(400).json({ success: false, error: 'Name is required' });
      return;
    }

    const collection = await getDocument<Collection>(req.params.id);
    
    if (!collection) {
      res.status(404).json({ success: false, error: 'Collection not found' });
      return;
    }

    const newFolder: Folder = {
      _id: `folder:${uuidv4()}`,
      name,
      description,
      variables: [],
      requests: [],
      folders: [],
    };

    if (parentFolderId) {
      const addToParent = (folders: Folder[]): Folder[] => {
        return folders.map((f) => {
          if (f._id === parentFolderId) {
            return { ...f, folders: [...f.folders, newFolder] };
          }
          return { ...f, folders: addToParent(f.folders) };
        });
      };
      collection.folders = addToParent(collection.folders);
    } else {
      collection.folders.push(newFolder);
    }

    const updated = await updateDocument<Collection>(req.params.id, { folders: collection.folders });

    await broadcastSyncEvent(req.user.userId, collection.workspaceId, {
      type: 'update',
      entityType: 'collection',
      entityId: collection._id,
      data: updated,
      workspaceId: collection.workspaceId,
    });

    res.status(201).json({ success: true, data: newFolder });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create folder' });
  }
});

export default router;
