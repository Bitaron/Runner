import type { Collection, ApiRequest, Folder } from '@apiforge/shared';

// Mock zustand persist middleware
jest.mock('zustand/middleware', () => ({
  persist: (config: unknown) => config,
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-123'),
}));

import { useCollectionsStore } from '../collectionsStore';

describe('Collections Store', () => {
  beforeEach(() => {
    useCollectionsStore.setState({
      collections: [],
      currentCollection: null,
      currentFolder: null,
      currentRequest: null,
      history: [],
    });
  });

  describe('Initial State', () => {
    it('should have empty collections array', () => {
      const collections = useCollectionsStore.getState().collections;
      expect(collections).toEqual([]);
    });

    it('should have no current selection', () => {
      const { currentCollection, currentFolder, currentRequest } = useCollectionsStore.getState();
      expect(currentCollection).toBeNull();
      expect(currentFolder).toBeNull();
      expect(currentRequest).toBeNull();
    });

    it('should have empty history', () => {
      const history = useCollectionsStore.getState().history;
      expect(history).toEqual([]);
    });
  });

  describe('setCollections', () => {
    it('should set collections array', () => {
      const mockCollections: Collection[] = [
        {
          _id: 'collection:1',
          type: 'collection',
          workspaceId: 'workspace:1',
          name: 'Test Collection',
          variables: [],
          folders: [],
          requests: [],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          createdBy: 'user:1',
        },
      ];

      useCollectionsStore.getState().setCollections(mockCollections);
      expect(useCollectionsStore.getState().collections).toEqual(mockCollections);
    });
  });

  describe('setCurrentCollection', () => {
    it('should set current collection', () => {
      const collection: Collection = {
        _id: 'collection:1',
        type: 'collection',
        workspaceId: 'workspace:1',
        name: 'Current Collection',
        variables: [],
        folders: [],
        requests: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        createdBy: 'user:1',
      };

      useCollectionsStore.getState().setCurrentCollection(collection);
      expect(useCollectionsStore.getState().currentCollection).toEqual(collection);
    });

    it('should allow setting null', () => {
      useCollectionsStore.getState().setCurrentCollection(null);
      expect(useCollectionsStore.getState().currentCollection).toBeNull();
    });
  });

  describe('addCollection', () => {
    it('should add a new collection', () => {
      const newCollection: Collection = {
        _id: 'collection:new',
        type: 'collection',
        workspaceId: 'workspace:1',
        name: 'New Collection',
        variables: [],
        folders: [],
        requests: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        createdBy: 'user:1',
      };

      useCollectionsStore.getState().addCollection(newCollection);
      
      const collections = useCollectionsStore.getState().collections;
      expect(collections).toHaveLength(1);
      expect(collections[0].name).toBe('New Collection');
    });

    it('should append to existing collections', () => {
      const existingCollection: Collection = {
        _id: 'collection:existing',
        type: 'collection',
        workspaceId: 'workspace:1',
        name: 'Existing',
        variables: [],
        folders: [],
        requests: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        createdBy: 'user:1',
      };

      const newCollection: Collection = {
        _id: 'collection:new',
        type: 'collection',
        workspaceId: 'workspace:1',
        name: 'New',
        variables: [],
        folders: [],
        requests: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        createdBy: 'user:1',
      };

      useCollectionsStore.getState().addCollection(existingCollection);
      useCollectionsStore.getState().addCollection(newCollection);

      const collections = useCollectionsStore.getState().collections;
      expect(collections).toHaveLength(2);
    });
  });

  describe('updateCollection', () => {
    it('should update an existing collection', () => {
      const collection: Collection = {
        _id: 'collection:1',
        type: 'collection',
        workspaceId: 'workspace:1',
        name: 'Original Name',
        variables: [],
        folders: [],
        requests: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        createdBy: 'user:1',
      };

      useCollectionsStore.getState().addCollection(collection);
      useCollectionsStore.getState().updateCollection('collection:1', { name: 'Updated Name' });

      const updated = useCollectionsStore.getState().collections.find(c => c._id === 'collection:1');
      expect(updated?.name).toBe('Updated Name');
    });
  });

  describe('removeCollection', () => {
    it('should remove a collection', () => {
      const collection: Collection = {
        _id: 'collection:to-remove',
        type: 'collection',
        workspaceId: 'workspace:1',
        name: 'To Remove',
        variables: [],
        folders: [],
        requests: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        createdBy: 'user:1',
      };

      useCollectionsStore.getState().addCollection(collection);
      expect(useCollectionsStore.getState().collections).toHaveLength(1);

      useCollectionsStore.getState().removeCollection('collection:to-remove');
      expect(useCollectionsStore.getState().collections).toHaveLength(0);
    });

    it('should clear currentCollection if removed', () => {
      const collection: Collection = {
        _id: 'collection:current',
        type: 'collection',
        workspaceId: 'workspace:1',
        name: 'Current',
        variables: [],
        folders: [],
        requests: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        createdBy: 'user:1',
      };

      useCollectionsStore.getState().addCollection(collection);
      useCollectionsStore.getState().setCurrentCollection(collection);
      useCollectionsStore.getState().removeCollection('collection:current');

      expect(useCollectionsStore.getState().currentCollection).toBeNull();
    });
  });

  describe('addFolder', () => {
    it('should add a folder to collection', () => {
      const collection: Collection = {
        _id: 'collection:1',
        type: 'collection',
        workspaceId: 'workspace:1',
        name: 'Test',
        variables: [],
        folders: [],
        requests: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        createdBy: 'user:1',
      };

      const folder: Folder = {
        _id: 'folder:1',
        name: 'Test Folder',
        variables: [],
        requests: [],
        folders: [],
      };

      useCollectionsStore.getState().addCollection(collection);
      useCollectionsStore.getState().addFolder('collection:1', folder);

      const updated = useCollectionsStore.getState().collections.find(c => c._id === 'collection:1');
      expect(updated?.folders).toHaveLength(1);
      expect(updated?.folders[0].name).toBe('Test Folder');
    });
  });

  describe('addRequest', () => {
    it('should add a request to collection', () => {
      const collection: Collection = {
        _id: 'collection:1',
        type: 'collection',
        workspaceId: 'workspace:1',
        name: 'Test',
        variables: [],
        folders: [],
        requests: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        createdBy: 'user:1',
      };

      const request: ApiRequest = {
        _id: 'request:1',
        type: 'request',
        workspaceId: 'workspace:1',
        name: 'Get Users',
        method: 'GET',
        url: 'https://api.example.com/users',
        params: [],
        headers: [],
        body: { mode: 'none' },
        auth: { type: 'none' },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        createdBy: 'user:1',
      };

      useCollectionsStore.getState().addCollection(collection);
      useCollectionsStore.getState().addRequest('collection:1', request);

      const updated = useCollectionsStore.getState().collections.find(c => c._id === 'collection:1');
      expect(updated?.requests).toHaveLength(1);
      expect(updated?.requests[0].name).toBe('Get Users');
    });
  });

  describe('setHistory', () => {
    it('should set history', () => {
      const requests: ApiRequest[] = [
        {
          _id: 'request:1',
          type: 'request',
          workspaceId: 'workspace:1',
          name: 'Request 1',
          method: 'GET',
          url: 'https://api.example.com/1',
          params: [],
          headers: [],
          body: { mode: 'none' },
          auth: { type: 'none' },
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          createdBy: 'user:1',
        },
      ];

      useCollectionsStore.getState().setHistory(requests);
      expect(useCollectionsStore.getState().history).toEqual(requests);
    });
  });

  describe('addToHistory', () => {
    it('should add request to history', () => {
      const request: ApiRequest = {
        _id: 'request:1',
        type: 'request',
        workspaceId: 'workspace:1',
        name: 'Historical Request',
        method: 'POST',
        url: 'https://api.example.com/test',
        params: [],
        headers: [],
        body: { mode: 'none' },
        auth: { type: 'none' },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        createdBy: 'user:1',
      };

      useCollectionsStore.getState().addToHistory(request);
      expect(useCollectionsStore.getState().history).toHaveLength(1);
    });

    it('should limit history to 100 items', () => {
      for (let i = 0; i < 105; i++) {
        const request: ApiRequest = {
          _id: `request:${i}`,
          type: 'request',
          workspaceId: 'workspace:1',
          name: `Request ${i}`,
          method: 'GET',
          url: `https://api.example.com/${i}`,
          params: [],
          headers: [],
          body: { mode: 'none' },
          auth: { type: 'none' },
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          createdBy: 'user:1',
        };
        useCollectionsStore.getState().addToHistory(request);
      }

      const history = useCollectionsStore.getState().history;
      expect(history.length).toBeLessThanOrEqual(100);
    });
  });

  describe('clearHistory', () => {
    it('should clear all history', () => {
      const request: ApiRequest = {
        _id: 'request:1',
        type: 'request',
        workspaceId: 'workspace:1',
        name: 'Request',
        method: 'GET',
        url: 'https://api.example.com',
        params: [],
        headers: [],
        body: { mode: 'none' },
        auth: { type: 'none' },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        createdBy: 'user:1',
      };

      useCollectionsStore.getState().addToHistory(request);
      expect(useCollectionsStore.getState().history).toHaveLength(1);

      useCollectionsStore.getState().clearHistory();
      expect(useCollectionsStore.getState().history).toHaveLength(0);
    });
  });

  describe('createNewRequest', () => {
    it('should create a new request with default values', () => {
      const newRequest = useCollectionsStore.getState().createNewRequest(
        'workspace:1',
        'user:1',
        'collection:1'
      );

      expect(newRequest._id).toContain('request:');
      expect(newRequest.type).toBe('request');
      expect(newRequest.method).toBe('GET');
      expect(newRequest.name).toBe('New Request');
      expect(newRequest.url).toBe('');
      expect(newRequest.params).toEqual([]);
      expect(newRequest.headers).toEqual([]);
      expect(newRequest.body.mode).toBe('none');
      expect(newRequest.auth.type).toBe('none');
    });

    it('should set workspace and user IDs', () => {
      const newRequest = useCollectionsStore.getState().createNewRequest(
        'workspace:123',
        'user:456'
      );

      expect(newRequest.workspaceId).toBe('workspace:123');
      expect(newRequest.createdBy).toBe('user:456');
    });

    it('should set collection and folder IDs when provided', () => {
      const newRequest = useCollectionsStore.getState().createNewRequest(
        'workspace:1',
        'user:1',
        'collection:1',
        'folder:1'
      );

      expect(newRequest.collectionId).toBe('collection:1');
      expect(newRequest.folderId).toBe('folder:1');
    });
  });
});
