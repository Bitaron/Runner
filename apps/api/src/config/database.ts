import nano, { ServerScope, DocumentScope } from 'nano';
import type { CouchDocument, User, Team, Workspace, Collection, ApiRequest, Environment, HistoryEntry, TrashItem, WebSocketRequest } from '@apiforge/shared';

const COUCH_URL = process.env.COUCHDB_URL || 'http://admin:password@localhost:5984';
const DB_NAME = process.env.COUCHDB_DATABASE || 'apiforge';

let db: DocumentScope<CouchDocument>;

export const getDb = () => db;

export const initDatabase = async (): Promise<void> => {
  const server = nano(COUCH_URL);

  try {
    await server.db.get(DB_NAME);
    console.log(`Database '${DB_NAME}' already exists`);
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode === 404) {
      await server.db.create(DB_NAME);
      console.log(`Database '${DB_NAME}' created`);
    } else {
      throw error;
    }
  }

  db = server.use<CouchDocument>(DB_NAME);

  await createDesignDocuments();
};

const createDesignDocuments = async (): Promise<void> => {
  const designDoc = {
    _id: '_design/app',
    views: {
      by_type: {
        map: `function(doc) {
          if (doc.type) {
            emit(doc.type, doc);
          }
        }`,
      },
      by_user: {
        map: `function(doc) {
          if (doc.userId) {
            emit(doc.userId, doc);
          }
        }`,
      },
      by_workspace: {
        map: `function(doc) {
          if (doc.workspaceId) {
            emit(doc.workspaceId, doc);
          }
        }`,
      },
      by_collection: {
        map: `function(doc) {
          if (doc.collectionId) {
            emit(doc.collectionId, doc);
          }
        }`,
      },
      deleted_items: {
        map: `function(doc) {
          if (doc.deletedAt) {
            emit(doc.deletedAt, doc);
          }
        }`,
      },
      trash_expires: {
        map: `function(doc) {
          if (doc.expiresAt) {
            emit(doc.expiresAt, doc);
          }
        }`,
      },
      users_by_email: {
        map: `function(doc) {
          if (doc.type === 'user' && doc.email) {
            emit(doc.email.toLowerCase(), doc);
          }
        }`,
      },
    },
  };

  try {
    const existing = await db.get('_design/app');
    await db.insert({ ...designDoc, _rev: existing._rev } as unknown as CouchDocument);
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode === 404) {
      await db.insert(designDoc as unknown as CouchDocument);
    } else {
      throw error;
    }
  }
};

export const createDocument = async <T extends CouchDocument>(doc: T): Promise<T> => {
  const result = await db.insert(doc as unknown as CouchDocument);
  return { ...doc, _rev: result.rev } as T;
};

export const getDocument = async <T extends CouchDocument>(id: string): Promise<T | null> => {
  try {
    const doc = await db.get(id);
    return doc as T;
  } catch (error: unknown) {
    if ((error as { statusCode?: number }).statusCode === 404) {
      return null;
    }
    throw error;
  }
};

export const updateDocument = async <T extends CouchDocument>(id: string, updates: Partial<T>): Promise<T> => {
  const existing = await db.get(id);
  const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  const result = await db.insert(updated as unknown as CouchDocument);
  return { ...updated, _rev: result.rev } as T;
};

export const deleteDocument = async (id: string): Promise<void> => {
  const doc = await db.get(id);
  await db.destroy(id, doc._rev);
};

export const findByType = async <T extends CouchDocument>(type: string): Promise<T[]> => {
  const result = await db.view('app', 'by_type', { key: type, include_docs: true });
  return result.rows.map((row) => row.doc as T);
};

export const findByUser = async <T extends CouchDocument>(userId: string): Promise<T[]> => {
  const result = await db.view('app', 'by_user', { key: userId, include_docs: true });
  return result.rows.map((row) => row.doc as T);
};

export const findByWorkspace = async <T extends CouchDocument>(workspaceId: string): Promise<T[]> => {
  const result = await db.view('app', 'by_workspace', { key: workspaceId, include_docs: true });
  return result.rows.map((row) => row.doc as T);
};

export const findByCollection = async <T extends CouchDocument>(collectionId: string): Promise<T[]> => {
  const result = await db.view('app', 'by_collection', { key: collectionId, include_docs: true });
  return result.rows.map((row) => row.doc as T);
};

export const findUserByEmail = async (email: string): Promise<User | null> => {
  const result = await db.view('app', 'users_by_email', { key: email.toLowerCase(), include_docs: true });
  return result.rows.length > 0 ? (result.rows[0].doc as User) : null;
};
