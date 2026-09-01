import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createDocument, getDocument, updateDocument, findByWorkspace, getDb } from '../config/database';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { requireWriteAccess } from '../middleware/rbac';
import { broadcastSyncEvent } from '../websocket';
import { encryptVariables, decryptVariables } from '../services/vault';
import { logAudit } from '../services/audit';
import type { Collection, Folder, TrashItem, CollectionVersion } from '@apiforge/shared';

const router = Router();

const decryptCollection = (c: Collection): Collection => {
  const decryptFolder = (f: Folder): Folder => ({ ...f, variables: decryptVariables(f.variables || []), folders: f.folders.map(decryptFolder), requests: f.requests });
  return { ...c, variables: decryptVariables(c.variables || []), folders: c.folders.map(decryptFolder) };
};
const encryptCollectionInput = (input: Partial<Collection>): Partial<Collection> => {
  const out: Partial<Collection> = { ...input };
  if (input.variables) out.variables = encryptVariables(input.variables);
  if (input.folders) {
    const encFolder = (f: Folder): Folder => ({ ...f, variables: encryptVariables(f.variables || []), folders: f.folders.map(encFolder) });
    out.folders = input.folders.map(encFolder);
  }
  return out;
};

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
        .filter((doc) => doc.type === 'collection' && !doc.deletedAt)
        .map(decryptCollection);
    } else {
      const result = await db.view('app', 'by_type', {
        key: 'collection',
        include_docs: true,
      });
      collections = result.rows
        .map((row) => row.doc as Collection)
        .filter((doc) => !doc.deletedAt)
        .map(decryptCollection);
    }

    res.json({ success: true, data: collections });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get collections' });
  }
});

router.post('/', authMiddleware, requireWriteAccess, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    if (!workspaceId) {
      res.status(400).json({ success: false, error: 'workspaceId is required' });
      return;
    }

    const finalWorkspaceId = workspaceId;

    const collection: Collection = {
      _id: `collection:${uuidv4()}`,
      type: 'collection',
      workspaceId: finalWorkspaceId,
      name,
      description,
      variables: variables ? encryptVariables(variables) : [],
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

    await logAudit({ userId: req.user.userId, userEmail: req.user.email, action: 'collection.create', entityType: 'collection', entityId: created._id, workspaceId: finalWorkspaceId, details: { name } });

    const decryptedCreated = decryptCollection(created);
    await broadcastSyncEvent(req.user.userId, finalWorkspaceId, {
      type: 'create',
      entityType: 'collection',
      entityId: created._id,
      data: decryptedCreated,
      workspaceId: finalWorkspaceId,
    });

    res.status(201).json({ success: true, data: decryptedCreated });
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

    res.json({ success: true, data: decryptCollection(collection) });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get collection' });
  }
});

router.patch('/:id', authMiddleware, requireWriteAccess, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { name, description, variables, auth, preRequestScript, testScript, folders, requests } = req.body;
    const updates: Partial<Collection> = {};

    const isValidVariables = (vars: unknown): boolean =>
      Array.isArray(vars) &&
      vars.every(
        (v) =>
          typeof v === 'object' &&
          v !== null &&
          typeof v.key === 'string' &&
          v.key.trim().length > 0 &&
          typeof v.value === 'string'
      );

    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (variables !== undefined) {
      if (!isValidVariables(variables)) {
        res.status(400).json({ success: false, error: 'Each variable must have a non-empty key and a string value' });
        return;
      }
      updates.variables = encryptVariables(variables);
    }
    if (auth !== undefined) updates.auth = auth;
    if (preRequestScript !== undefined) updates.preRequestScript = preRequestScript;
    if (testScript !== undefined) updates.testScript = testScript;
    if (folders !== undefined) {
      const encFolder = (f: Folder): Folder => ({ ...f, variables: encryptVariables(f.variables || []), folders: f.folders.map(encFolder) });
      updates.folders = folders.map(encFolder);
    }
    if (requests !== undefined) updates.requests = requests;

    // version snapshot before update
    try {
      const existing = await getDocument<Collection>(req.params.id);
      if (existing) {
        const db = getDb();
        const vRes = await db.view('app', 'by_type', { key: 'collection_version', include_docs: true });
        const existingVersions = vRes.rows.map(r => r.doc as unknown as CollectionVersion).filter(v => v.collectionId === req.params.id);
        const nextVersion = (existing.version || existingVersions.length ? Math.max(existing.version || 0, ...existingVersions.map(v => v.version)) : 0) + 1;
        const versionDoc: CollectionVersion = {
          _id: `cver:${uuidv4()}`,
          type: 'collection_version',
          collectionId: req.params.id,
          version: nextVersion,
          data: { ...existing },
          createdAt: new Date().toISOString(),
          createdBy: req.user!.userId,
        };
        await createDocument(versionDoc);
        updates.version = nextVersion;
      }
    } catch {}

    const updated = await updateDocument<Collection>(req.params.id, updates);

    if (updated) {
      await logAudit({ userId: req.user!.userId, userEmail: req.user!.email, action: 'collection.update', entityType: 'collection', entityId: updated._id, workspaceId: updated.workspaceId, details: { name: updated.name } });
      const dec = decryptCollection(updated);
      await broadcastSyncEvent(req.user.userId, updated.workspaceId, {
        type: 'update',
        entityType: 'collection',
        entityId: updated._id,
        data: dec,
        workspaceId: updated.workspaceId,
      });
      res.json({ success: true, data: dec });
      return;
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update collection' });
  }
});

router.delete('/:id', authMiddleware, requireWriteAccess, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    const db = getDb();
    const raw = await db.get(req.params.id) as unknown as Record<string, unknown>;
    delete (raw as Record<string, unknown>).deletedAt;
    (raw as Record<string, unknown>).updatedAt = new Date().toISOString();
    await db.insert(raw as unknown as Parameters<typeof db.insert>[0]);
    const updated = await getDocument<Collection>(req.params.id);
    const trashResult = await db.find({ selector: { deletedId: req.params.id } } as unknown as Parameters<typeof db.find>[0]);
    for (const trashDoc of trashResult.docs) {
      await db.destroy((trashDoc as unknown as Record<string, unknown>)._id as string, (trashDoc as unknown as Record<string, unknown>)._rev as string);
    }

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

router.post('/:id/folders', authMiddleware, requireWriteAccess, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    const findSiblings = (folders: Folder[]): Folder[] | null => {
      if (!parentFolderId) return folders;
      for (const f of folders) {
        if (f._id === parentFolderId) return f.folders;
        const nested = findSiblings(f.folders);
        if (nested) return nested;
      }
      return null;
    };

    const siblings = findSiblings(collection.folders);

    if (!siblings) {
      res.status(404).json({ success: false, error: 'Parent folder not found' });
      return;
    }

    if (siblings.some((f) => f.name === name)) {
      res.status(409).json({ success: false, error: 'A folder with this name already exists at this level' });
      return;
    }

    const newFolder: Folder = {
      _id: `folder:${uuidv4()}`,
      name,
      description,
      variables: [],
      auth: { type: 'none', inheritFromParent: true },
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

    res.status(201).json({ success: true, data: { folder: newFolder, collection: updated } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create folder' });
  }
});

router.post('/:id/fork', authMiddleware, requireWriteAccess, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }
    const source = await getDocument<Collection>(req.params.id);
    if (!source || source.deletedAt) { res.status(404).json({ success: false, error: 'Collection not found' }); return; }
    const { name, workspaceId } = req.body as { name?: string; workspaceId?: string };
    const targetWorkspaceId = workspaceId || source.workspaceId;
    const fork: Collection = {
      ...source,
      _id: `collection:${uuidv4()}`,
      name: name || `${source.name} (fork)`,
      workspaceId: targetWorkspaceId,
      forkedFrom: source._id,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: req.user.userId,
    };
    // deep clone folders/requests with new ids
    const cloneFolder = (f: Folder): Folder => ({
      ...f,
      _id: `folder:${uuidv4()}`,
      requests: f.requests.map(r => ({ ...r, _id: `request:${uuidv4()}`, collectionId: fork._id })),
      folders: f.folders.map(cloneFolder),
    });
    fork.folders = source.folders.map(cloneFolder);
    fork.requests = source.requests.map(r => ({ ...r, _id: `request:${uuidv4()}`, collectionId: fork._id }));
    const created = await createDocument(fork);
    await broadcastSyncEvent(req.user.userId, targetWorkspaceId, { type: 'create', entityType: 'collection', entityId: created._id, data: created, workspaceId: targetWorkspaceId });
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fork collection' });
  }
});

router.get('/:id/versions', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const db = getDb();
    const result = await db.view('app', 'by_type', { key: 'collection_version', include_docs: true });
    let versions = result.rows.map(r => r.doc as unknown as CollectionVersion).filter(v => v.collectionId === req.params.id);
    versions.sort((a, b) => b.version - a.version);
    res.json({ success: true, data: versions });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get versions' });
  }
});

router.post('/:id/versions/:versionId/restore', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }
    const version = await getDocument<CollectionVersion>(req.params.versionId);
    if (!version || version.collectionId !== req.params.id) { res.status(404).json({ success: false, error: 'Version not found' }); return; }
    const restoredData = { ...version.data, _id: req.params.id, updatedAt: new Date().toISOString() } as Collection;
    const db = getDb();
    const existing = await db.get(req.params.id) as unknown as Record<string, unknown>;
    const toInsert = { ...existing, ...restoredData } as unknown as Record<string, unknown>;
    await db.insert(toInsert as unknown as Parameters<typeof db.insert>[0]);
    const updated = await getDocument<Collection>(req.params.id);
    if (updated) await broadcastSyncEvent(req.user.userId, updated.workspaceId, { type: 'update', entityType: 'collection', entityId: updated._id, data: updated, workspaceId: updated.workspaceId });
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to restore version' });
  }
});

export default router;
