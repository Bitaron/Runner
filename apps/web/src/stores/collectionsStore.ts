import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Collection, ApiRequest, Folder, KeyValue, RequestBody, AuthConfig } from '@apiforge/shared';
import { v4 as uuidv4 } from 'uuid';
import { syncManager } from '@/lib/syncManager';

interface CollectionsState {
  collections: Collection[];
  currentCollection: Collection | null;
  currentFolder: Folder | null;
  currentRequest: ApiRequest | null;
  history: ApiRequest[];
  
  setCollections: (collections: Collection[]) => void;
  setCurrentCollection: (collection: Collection | null) => void;
  setCurrentFolder: (folder: Folder | null) => void;
  setCurrentRequest: (request: ApiRequest | null) => void;
  
  addCollection: (collection: Collection) => void;
  updateCollection: (id: string, updates: Partial<Collection>) => void;
  removeCollection: (id: string) => void;
  restoreCollection: (id: string) => void;
  
  addFolder: (collectionId: string, folder: Folder, parentFolderId?: string) => void;
  updateFolder: (collectionId: string, folderId: string, updates: Partial<Folder>, parentFolderId?: string) => void;
  removeFolder: (collectionId: string, folderId: string, parentFolderId?: string) => void;
  
  addRequest: (collectionId: string, request: ApiRequest, folderId?: string) => void;
  updateRequest: (id: string, updates: Partial<ApiRequest>) => void;
  removeRequest: (id: string, collectionId: string, folderId?: string) => void;
  
  moveItem: (itemId: string, itemType: 'request' | 'folder', fromCollectionId: string, toCollectionId: string, toFolderId?: string) => void;
  
  setHistory: (history: ApiRequest[]) => void;
  addToHistory: (request: ApiRequest) => void;
  clearHistory: () => void;
  
  createNewRequest: (workspaceId: string, userId: string, collectionId?: string, folderId?: string) => ApiRequest;
}

export const useCollectionsStore = create<CollectionsState>()(
  persist(
    (set, get) => ({
      collections: [],
      currentCollection: null,
      currentFolder: null,
      currentRequest: null,
      history: [],
      
      setCollections: (collections) => set({ collections }),
      
      setCurrentCollection: (collection) => set({ currentCollection: collection }),
      
      setCurrentFolder: (folder) => set({ currentFolder: folder }),
      
      setCurrentRequest: (request) => set({ currentRequest: request }),
      
      addCollection: (collection) => set((state) => {
        syncManager.emitCollectionEvent('create', collection);
        return { collections: [...state.collections, collection] };
      }),
      
      updateCollection: (id, updates) => set((state) => {
        const collection = state.collections.find((c) => c._id === id);
        if (collection) {
          const updated = { ...collection, ...updates, updatedAt: new Date().toISOString() };
          syncManager.emitCollectionEvent('update', updated);
        }
        return {
          collections: state.collections.map((c) =>
            c._id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c
          ),
          currentCollection: state.currentCollection?._id === id
            ? { ...state.currentCollection, ...updates, updatedAt: new Date().toISOString() }
            : state.currentCollection
        };
      }),
      
      removeCollection: (id) => set((state) => {
        const collection = state.collections.find((c) => c._id === id);
        if (collection) {
          syncManager.emitCollectionEvent('delete', collection);
        }
        return {
          collections: state.collections.filter((c) => c._id !== id),
          currentCollection: state.currentCollection?._id === id ? null : state.currentCollection
        };
      }),
      
      restoreCollection: (id) => set((state) => ({
        collections: state.collections.map((c) =>
          c._id === id ? { ...c, deletedAt: undefined } : c
        )
      })),
      
      addFolder: (collectionId, folder, parentFolderId) => set((state) => {
        const collection = state.collections.find((c) => c._id === collectionId);
        if (collection) {
          syncManager.emitFolderEvent('create', folder, collection);
        }
        return {
          collections: state.collections.map((c) => {
            if (c._id !== collectionId) return c;
            
            if (!parentFolderId) {
              return { ...c, folders: [...c.folders, folder], updatedAt: new Date().toISOString() };
            }
            
            const addFolderToParent = (folders: Folder[]): Folder[] => {
              return folders.map((f) => {
                if (f._id === parentFolderId) {
                  return { ...f, folders: [...f.folders, folder] };
                }
                return { ...f, folders: addFolderToParent(f.folders) };
              });
            };
            
            return { ...c, folders: addFolderToParent(c.folders), updatedAt: new Date().toISOString() };
          })
        };
      }),
      
      updateFolder: (collectionId, folderId, updates, parentFolderId) => set((state) => {
        const collection = state.collections.find((c) => c._id === collectionId);
        if (collection) {
          const findFolder = (folders: Folder[]): Folder | null => {
            for (const f of folders) {
              if (f._id === folderId) return f;
              const found = findFolder(f.folders);
              if (found) return found;
            }
            return null;
          };
          const folder = findFolder(collection.folders);
          if (folder) {
            syncManager.emitFolderEvent('update', { ...folder, ...updates }, collection);
          }
        }
        return {
          collections: state.collections.map((c) => {
            if (c._id !== collectionId) return c;
            
            const updateFolderInTree = (folders: Folder[]): Folder[] => {
              return folders.map((f) => {
                if (f._id === folderId) {
                  return { ...f, ...updates };
                }
                return { ...f, folders: updateFolderInTree(f.folders) };
              });
            };
            
            if (!parentFolderId) {
              return { ...c, folders: updateFolderInTree(c.folders), updatedAt: new Date().toISOString() };
            }
            
            const updateInParent = (folders: Folder[]): Folder[] => {
              return folders.map((f) => {
                if (f._id === parentFolderId) {
                  return { ...f, folders: updateFolderInTree(f.folders) };
                }
                return { ...f, folders: updateInParent(f.folders) };
              });
            };
            
            return { ...c, folders: updateInParent(c.folders), updatedAt: new Date().toISOString() };
          })
        };
      }),
      
      removeFolder: (collectionId, folderId, parentFolderId) => set((state) => {
        const collection = state.collections.find((c) => c._id === collectionId);
        if (collection) {
          const findFolder = (folders: Folder[]): Folder | null => {
            for (const f of folders) {
              if (f._id === folderId) return f;
              const found = findFolder(f.folders);
              if (found) return found;
            }
            return null;
          };
          const folder = findFolder(collection.folders);
          if (folder) {
            syncManager.emitFolderEvent('delete', folder, collection);
          }
        }
        return {
          collections: state.collections.map((c) => {
            if (c._id !== collectionId) return c;
            
            const removeFromTree = (folders: Folder[]): Folder[] => {
              return folders.filter((f) => f._id !== folderId).map((f) => ({
                ...f,
                folders: removeFromTree(f.folders)
              }));
            };
            
            if (!parentFolderId) {
              return { ...c, folders: removeFromTree(c.folders), updatedAt: new Date().toISOString() };
            }
            
            const removeFromParent = (folders: Folder[]): Folder[] => {
              return folders.map((f) => {
                if (f._id === parentFolderId) {
                  return { ...f, folders: removeFromTree(f.folders) };
                }
                return { ...f, folders: removeFromParent(f.folders) };
              });
            };
            
            return { ...c, folders: removeFromParent(c.folders), updatedAt: new Date().toISOString() };
          })
        };
      }),
      
      addRequest: (collectionId, request, folderId) => set((state) => {
        const collection = state.collections.find((c) => c._id === collectionId);
        if (collection) {
          syncManager.emitRequestEvent('create', request, collection.workspaceId);
        }
        return {
          collections: state.collections.map((c) => {
            if (c._id !== collectionId) return c;
            
            if (!folderId) {
              return { ...c, requests: [...c.requests, request], updatedAt: new Date().toISOString() };
            }
            
            const addToFolder = (folders: Folder[]): Folder[] => {
              return folders.map((f) => {
                if (f._id === folderId) {
                  return { ...f, requests: [...f.requests, request] };
                }
                return { ...f, folders: addToFolder(f.folders) };
              });
            };
            
            return { ...c, folders: addToFolder(c.folders), updatedAt: new Date().toISOString() };
          })
        };
      }),
      
      updateRequest: (id, updates) => set((state) => {
        let workspaceId = '';
        for (const c of state.collections) {
          const findRequest = (requests: ApiRequest[]): ApiRequest | null => {
            for (const r of requests) {
              if (r._id === id) return r;
            }
            return null;
          };
          let req = findRequest(c.requests);
          if (!req) {
            const findInFolders = (folders: Folder[]): ApiRequest | null => {
              for (const f of folders) {
                let found = findRequest(f.requests);
                if (found) return found;
                found = findInFolders(f.folders);
                if (found) return found;
              }
              return null;
            };
            req = findInFolders(c.folders);
          }
          if (req) {
            workspaceId = c.workspaceId;
            syncManager.emitRequestEvent('update', { ...req, ...updates }, workspaceId);
            break;
          }
        }
        return {
          collections: state.collections.map((c) => {
            const updateInRequests = (requests: ApiRequest[]): ApiRequest[] => {
              return requests.map((r) =>
                r._id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r
              );
            };
            
            const updateInFolders = (folders: Folder[]): Folder[] => {
              return folders.map((f) => ({
                ...f,
                requests: updateInRequests(f.requests),
                folders: updateInFolders(f.folders)
              }));
            };
            
            return {
              ...c,
              requests: updateInRequests(c.requests),
              folders: updateInFolders(c.folders),
              updatedAt: new Date().toISOString()
            };
          }),
          currentRequest: state.currentRequest?._id === id
            ? { ...state.currentRequest, ...updates, updatedAt: new Date().toISOString() }
            : state.currentRequest
        };
      }),
      
      removeRequest: (id, collectionId, folderId) => set((state) => {
        const collection = state.collections.find((c) => c._id === collectionId);
        if (collection) {
          const findRequest = (requests: ApiRequest[]): ApiRequest | null => {
            for (const r of requests) {
              if (r._id === id) return r;
            }
            return null;
          };
          let req = findRequest(collection.requests);
          if (!req) {
            const findInFolders = (folders: Folder[]): ApiRequest | null => {
              for (const f of folders) {
                let found = findRequest(f.requests);
                if (found) return found;
                found = findInFolders(f.folders);
                if (found) return found;
              }
              return null;
            };
            req = findInFolders(collection.folders);
          }
          if (req) {
            syncManager.emitRequestEvent('delete', req, collection.workspaceId);
          }
        }
        return {
          collections: state.collections.map((c) => {
            if (c._id !== collectionId) return c;
            
            if (!folderId) {
              return {
                ...c,
                requests: c.requests.filter((r) => r._id !== id),
                updatedAt: new Date().toISOString()
              };
            }
            
            const removeFromFolder = (folders: Folder[]): Folder[] => {
              return folders.map((f) => {
                if (f._id === folderId) {
                  return { ...f, requests: f.requests.filter((r) => r._id !== id) };
                }
                return { ...f, folders: removeFromFolder(f.folders) };
              });
            };
            
            return { ...c, folders: removeFromFolder(c.folders), updatedAt: new Date().toISOString() };
          }),
          currentRequest: state.currentRequest?._id === id ? null : state.currentRequest
        };
      }),
      
      moveItem: (itemId, itemType, fromCollectionId, toCollectionId, toFolderId) => set((state) => {
        let movedItem: ApiRequest | Folder | null = null;
        
        const collections = state.collections.map((c) => {
          if (c._id !== fromCollectionId) return c;
          
          if (itemType === 'request') {
            const request = c.requests.find((r) => r._id === itemId) ||
              c.folders.reduce((found: ApiRequest | null, f) => {
                if (found) return found;
                const findRequest = (folder: Folder): ApiRequest | null => {
                  const req = folder.requests.find((r) => r._id === itemId);
                  if (req) return req;
                  return folder.folders.reduce<ApiRequest | null>((acc, subFolder) => 
                    acc || findRequest(subFolder), null);
                };
                return findRequest(f);
              }, null);
            
            if (!request) return c;
            movedItem = request;
            
            const newC = {
              ...c,
              requests: c.requests.filter((r) => r._id !== itemId),
              folders: c.folders.map((f) => ({
                ...f,
                requests: f.requests.filter((r) => r._id !== itemId),
                folders: f.folders.map((sf) => ({
                  ...sf,
                  requests: sf.requests.filter((r) => r._id !== itemId)
                }))
              }))
            };
            
            if (fromCollectionId === toCollectionId) {
              const addToTargetFolder = (folders: Folder[]): Folder[] => {
                return folders.map((f) => {
                  if (f._id === toFolderId) {
                    return { ...f, requests: [...f.requests, { ...request, folderId: toFolderId }] };
                  }
                  return { ...f, folders: addToTargetFolder(f.folders) };
                });
              };
              
              if (toFolderId) {
                return { ...newC, folders: addToTargetFolder(newC.folders) };
              }
              return { ...newC, requests: [...newC.requests, { ...request, folderId: undefined }] };
            }
            
            return newC;
          }
          
          return c;
        });
        
        if (!movedItem) return state;
        
        return {
          ...state,
          collections: collections.map((c) => {
            if (c._id !== toCollectionId || fromCollectionId === toCollectionId) return c;
            
            if (itemType === 'request' && movedItem) {
              const request = movedItem as ApiRequest;
              if (toFolderId) {
                const addToFolder = (folders: Folder[]): Folder[] => {
                  return folders.map((f) => {
                    if (f._id === toFolderId) {
                      return { ...f, requests: [...f.requests, { ...request, folderId: toFolderId, collectionId: toCollectionId }] };
                    }
                    return { ...f, folders: addToFolder(f.folders) };
                  });
                };
                return { ...c, folders: addToFolder(c.folders) };
              }
              return { ...c, requests: [...c.requests, { ...request, collectionId: toCollectionId, folderId: undefined }] };
            }
            return c;
          })
        };
      }),
      
      setHistory: (history) => set({ history }),
      
      addToHistory: (request) => set((state) => ({
        history: [request, ...state.history.slice(0, 99)]
      })),
      
      clearHistory: () => set({ history: [] }),
      
      createNewRequest: (workspaceId, userId, collectionId, folderId) => ({
        _id: `request:${uuidv4()}`,
        type: 'request' as const,
        collectionId,
        folderId,
        workspaceId,
        name: 'New Request',
        method: 'GET' as const,
        url: '',
        params: [],
        headers: [],
        body: { mode: 'none' as const },
        auth: { type: 'none' as const },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: userId,
      }),
    }),
    {
      name: 'apiforge-collections',
      partialize: (state) => ({
        collections: state.collections,
        history: state.history,
      }),
    }
  )
);
