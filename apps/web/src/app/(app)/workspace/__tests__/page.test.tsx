/**
 * Regression test for TS2339 fix:
 * Property 'request' does not exist on type 'CollectionTab'.
 *
 * The bug was on line 255 of page.tsx where `tabs.find(t => t.request._id === ...)`
 * was called on a `Tab[]` (RequestTab | CollectionTab | FolderTab) without first
 * narrowing via `t.type === 'request'`. This test verifies the type-narrowing
 * pattern works correctly and that accessing `.request._id` on non-request tabs
 * does not cause runtime errors or incorrect matches.
 */

import type { ApiRequest, Collection, Folder } from '@apiforge/shared';

// ---------- Mirrored tab types from page.tsx ----------

interface RequestTab {
  id: string;
  type: 'request';
  request: ApiRequest;
}

interface CollectionTab {
  id: string;
  type: 'collection';
  collection: Collection;
}

interface FolderTab {
  id: string;
  type: 'folder';
  collection: Collection;
  folder: Folder;
}

type Tab = RequestTab | CollectionTab | FolderTab;

// ---------- Helpers ----------

function createRequest(id: string, name: string): ApiRequest {
  return {
    _id: id,
    type: 'request',
    collectionId: 'col:1',
    workspaceId: 'ws:1',
    name,
    method: 'GET',
    url: 'https://example.com',
    headers: [],
    queryParams: [],
    params: [],
    body: { mode: 'none' },
    auth: { type: 'none' },
    createdBy: 'user:1',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  } as unknown as ApiRequest;
}

function createCollection(id: string): Collection {
  return {
    _id: id,
    type: 'collection',
    name: 'Test Collection',
    workspaceId: 'ws:1',
    requests: [],
    folders: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  } as unknown as Collection;
}

function createFolder(id: string, collection: Collection): Folder {
  return {
    _id: id,
    name: 'Test Folder',
    collectionId: collection._id,
    requests: [],
    folders: [],
    variables: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  } as unknown as Folder;
}

// ---------- Simulated handler from page.tsx (after fix) ----------

function findExistingRequestTab(tabs: Tab[], request: ApiRequest): Tab | undefined {
  // This mirrors the FIXED line 255 pattern:
  // tabs.find(t => t.type === 'request' && t.request._id === request._id)
  return tabs.find(t => t.type === 'request' && t.request._id === request._id);
}

// ---------- Tests ----------

describe('Workspace Tab Type Narrowing (TS2339 regression)', () => {
  const requestA = createRequest('req:1', 'Get Users');
  const requestB = createRequest('req:2', 'Create Post');

  const collection = createCollection('col:1');
  const folder = createFolder('fol:1', collection);

  const requestTab: RequestTab = {
    id: 'tab:req1',
    type: 'request',
    request: requestA,
  };

  const collectionTab: CollectionTab = {
    id: 'tab:col1',
    type: 'collection',
    collection,
  };

  const folderTab: FolderTab = {
    id: 'tab:fol1',
    type: 'folder',
    collection,
    folder,
  };

  it('finds a matching RequestTab among mixed tab types', () => {
    const tabs: Tab[] = [collectionTab, requestTab, folderTab];
    const result = findExistingRequestTab(tabs, requestA);
    expect(result).toBeDefined();
    expect(result!.id).toBe('tab:req1');
  });

  it('returns undefined when no RequestTab matches the given request', () => {
    const tabs: Tab[] = [collectionTab, requestTab, folderTab];
    const result = findExistingRequestTab(tabs, requestB);
    expect(result).toBeUndefined();
  });

  it('returns undefined when tabs contain only CollectionTab and FolderTab', () => {
    const tabs: Tab[] = [collectionTab, folderTab];
    // Before the fix this would throw: Property 'request' does not exist on type 'CollectionTab'
    const result = findExistingRequestTab(tabs, requestA);
    expect(result).toBeUndefined();
  });

  it('returns undefined on an empty tabs array', () => {
    const tabs: Tab[] = [];
    const result = findExistingRequestTab(tabs, requestA);
    expect(result).toBeUndefined();
  });

  it('matches the correct RequestTab when multiple request tabs exist', () => {
    const otherRequestTab: RequestTab = {
      id: 'tab:req2',
      type: 'request',
      request: requestB,
    };

    const tabs: Tab[] = [otherRequestTab, requestTab];
    const result = findExistingRequestTab(tabs, requestA);
    expect(result).toBeDefined();
    expect(result!.id).toBe('tab:req1');
  });

  it('does not access .request on non-request tabs at runtime', () => {
    // This test documents the contract: CollectionTab and FolderTab
    // must not have a `request` property. If the code were to access
    // `collectionTab.request` it would be `undefined` at runtime,
    // which would cause a TypeError when reading `._id`.
    const tabs: Tab[] = [collectionTab, folderTab];

    // Accessing .request on non-request tabs is undefined at runtime
    expect((collectionTab as unknown as Record<string, unknown>).request).toBeUndefined();
    expect((folderTab as unknown as Record<string, unknown>).request).toBeUndefined();

    // The type-guarded find should never attempt this access
    const result = findExistingRequestTab(tabs, requestA);
    expect(result).toBeUndefined();
  });

  it('handleSelectRequest-style logic creates a new tab when no match found', () => {
    const tabs: Tab[] = [collectionTab, folderTab];

    // Simulate the handleSelectRequest logic from page.tsx
    const existingTab = findExistingRequestTab(tabs, requestA);
    let activeTabId: string | null = null;
    let newTabs = [...tabs];

    if (existingTab) {
      activeTabId = existingTab.id;
    } else {
      const newTab: RequestTab = {
        id: 'tab:new',
        type: 'request',
        request: requestA,
      };
      newTabs = [...newTabs, newTab];
      activeTabId = newTab.id;
    }

    expect(activeTabId).toBe('tab:new');
    expect(newTabs).toHaveLength(3);
    expect(newTabs[2]).toMatchObject({ type: 'request', request: requestA });
  });

  it('handleSelectRequest-style logic reuses an existing tab when a match is found', () => {
    const tabs: Tab[] = [requestTab, collectionTab];

    const existingTab = findExistingRequestTab(tabs, requestA);
    let activeTabId: string | null = null;
    let newTabs = [...tabs];

    if (existingTab) {
      activeTabId = existingTab.id;
    } else {
      const newTab: RequestTab = {
        id: 'tab:new',
        type: 'request',
        request: requestA,
      };
      newTabs = [...newTabs, newTab];
      activeTabId = newTab.id;
    }

    expect(activeTabId).toBe('tab:req1');
    expect(newTabs).toHaveLength(2); // No new tab added
  });
});
