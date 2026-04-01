'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { RequestBuilder } from '@/components/request/RequestBuilder';
import { ResponseViewer } from '@/components/response/ResponseViewer';
import { TeamManagement } from '@/components/team';
import { GlobalSearch, SearchShortcut } from '@/components/search';
import { WebSocketRequest } from '@/components/websocket';
import { SyncStatus, ToastContainer, toast } from '@/components/sync/SyncStatus';
import { TopBar } from '@/components/layout/TopBar';
import { RequestTabs } from '@/components/layout/RequestTabs';
import { BottomBar } from '@/components/layout/BottomBar';
import { HelpModal } from '@/components/layout/HelpModal';
import { CollectionFolderViewer } from '@/components/layout/CollectionFolderViewer';
import { CollectionPanel } from '@/components/collection';
import { EnvironmentPanel } from '@/components/environment';
import { useCollectionsStore } from '@/stores/collectionsStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/api';
import { syncManager } from '@/lib/syncManager';
import { cn } from '@/lib/utils';
import type { ApiRequest, Collection, Response, Workspace, Folder, Environment } from '@apiforge/shared';
import { v4 as uuidv4 } from 'uuid';

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

export default function WorkspacePage() {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [response, setResponse] = useState<Response | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const [testResults, setTestResults] = useState<Array<{ name: string; passed: boolean; error?: string }>>([]);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showWebSocket, setShowWebSocket] = useState(false);
  const [activePanel, setActivePanel] = useState<'http' | 'websocket'>('http');
  const [layout, setLayout] = useState<'horizontal' | 'vertical'>('vertical');
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [selectedEnvironment, setSelectedEnvironment] = useState<Environment | null>(null);
  const [showGlobals, setShowGlobals] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [splitPosition, setSplitPosition] = useState(50);
  const [verticalSplitPosition, setVerticalSplitPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingVertical, setIsDraggingVertical] = useState(false);

  const { collections, addCollection, addRequest, updateRequest, addToHistory, createNewRequest } = useCollectionsStore();
  const { currentWorkspace, workspaces, setWorkspaces, setCurrentWorkspace, environments, globalVariables, addEnvironment, updateEnvironment, removeEnvironment } = useWorkspaceStore();
  const { user, tokens, isAnonymous, logout } = useAuthStore();

  const getMethodColor = (method: string) => {
    const colors: Record<string, string> = {
      GET: 'bg-green-600 text-white',
      POST: 'bg-[#ff6b35] text-white',
      PUT: 'bg-blue-600 text-white',
      PATCH: 'bg-yellow-600 text-white',
      DELETE: 'bg-red-600 text-white',
      HEAD: 'bg-gray-600 text-white',
      OPTIONS: 'bg-purple-600 text-white',
    };
    return colors[method] || 'bg-gray-600 text-white';
  };

  const currentTab = tabs.find(t => t.id === activeTabId) as Tab | undefined;
  const currentRequest = currentTab?.type === 'request' ? currentTab.request : null;

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const workspacesRes = await apiClient.get<Workspace[]>('/api/workspaces');
        if (workspacesRes.success && workspacesRes.data) {
          setWorkspaces(workspacesRes.data);
          if (workspacesRes.data.length > 0) {
            setCurrentWorkspace(workspacesRes.data[0]);
          }
        }
      } catch (error) {
        console.error('Failed to load initial data:', error);
      }
    };

    loadInitialData();
  }, [setWorkspaces, setCurrentWorkspace]);

  useEffect(() => {
    if (user && tokens?.accessToken && currentWorkspace && !isAnonymous) {
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000/ws';
      syncManager.connect(wsUrl, tokens.accessToken, user._id, currentWorkspace._id);
    }

    return () => {
      syncManager.disconnect();
    };
  }, [user, tokens, currentWorkspace, isAnonymous]);

  useEffect(() => {
    const unsubscribe = syncManager.onEvent((event) => {
      console.log('Received sync event:', event);
      
      if (event.entityType === 'collection') {
        if (event.type === 'create' && event.data) {
          useCollectionsStore.getState().addCollection(event.data as Collection);
        } else if (event.type === 'update' && event.data) {
          useCollectionsStore.getState().updateCollection(event.entityId, event.data as Partial<Collection>);
        } else if (event.type === 'delete') {
          useCollectionsStore.getState().removeCollection(event.entityId);
        }
      } else if (event.entityType === 'request' && event.data) {
        if (event.type === 'create') {
          const req = event.data as ApiRequest;
          if (req.collectionId) {
            useCollectionsStore.getState().addRequest(req.collectionId, req, req.folderId);
          }
        } else if (event.type === 'update') {
          useCollectionsStore.getState().updateRequest(event.entityId, event.data as Partial<ApiRequest>);
        } else if (event.type === 'delete') {
          const req = event.data as ApiRequest;
          if (req.collectionId) {
            useCollectionsStore.getState().removeRequest(event.entityId, req.collectionId, req.folderId);
          }
        }
      } else if (event.entityType === 'environment') {
        if (event.type === 'create' && event.data) {
          useWorkspaceStore.getState().addEnvironment(event.data as import('@apiforge/shared').Environment);
        } else if (event.type === 'update' && event.data) {
          useWorkspaceStore.getState().updateEnvironment(event.entityId, event.data as Partial<import('@apiforge/shared').Environment>);
        } else if (event.type === 'delete') {
          useWorkspaceStore.getState().removeEnvironment(event.entityId);
        }
      }
    });

    return unsubscribe;
  }, []);

  const handleNewRequest = useCallback(() => {
    const userId = user?._id || 'anonymous';
    const workspaceId = currentWorkspace?._id || 'default';
    const newReq = createNewRequest(workspaceId, userId);
    
    // If a collection is selected, add the request to it
    if (selectedCollection) {
      const updatedRequests = [...selectedCollection.requests, newReq];
      useCollectionsStore.getState().updateCollection(selectedCollection._id, { requests: updatedRequests });
    }
    
    const newTab: RequestTab = {
      id: uuidv4(),
      type: 'request',
      request: newReq,
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setResponse(null);
    setConsoleLogs([]);
    setTestResults([]);
    setActivePanel('http');
    toast.success('New request created');
  }, [user, currentWorkspace, createNewRequest, selectedCollection]);

  const handleCreateNew = useCallback((type: 'http' | 'graphql' | 'websocket' | 'collection' | 'folder') => {
    if (type === 'http') {
      handleNewRequest();
    } else if (type === 'graphql') {
      handleNewRequest();
      const newReq = createNewRequest(currentWorkspace?._id || 'default', user?._id || 'anonymous');
      newReq.method = 'POST';
      newReq.body = { mode: 'graphql', graphql: { query: '', variables: '' } };
      setTabs(prev => {
        const lastTab = prev[prev.length - 1];
        if (lastTab && lastTab.type === 'request') {
          return [...prev.slice(0, -1), { ...lastTab, request: newReq }];
        }
        return prev;
      });
    } else if (type === 'websocket') {
      setActivePanel('websocket');
      toast.info('WebSocket panel opened');
    } else if (type === 'collection') {
      // This is handled by the modal in Sidebar
    } else if (type === 'folder') {
      if (selectedCollection) {
        const newFolder: Folder = {
          _id: uuidv4(),
          name: 'New Folder',
          requests: [],
          folders: [],
          variables: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const updatedFolders = [...selectedCollection.folders, newFolder];
        useCollectionsStore.getState().updateCollection(selectedCollection._id, { folders: updatedFolders });
        toast.success('New folder created');
      } else {
        toast.error('Select a collection first');
      }
    }
  }, [handleNewRequest, currentWorkspace, user, selectedCollection]);

  const handleDeleteCollection = useCallback((collectionId: string) => {
    useCollectionsStore.getState().removeCollection(collectionId);
    toast.success('Collection deleted');
  }, []);

  const handleDeleteFolder = useCallback((collectionId: string, folderId: string) => {
    const collection = collections.find(c => c._id === collectionId);
    if (collection) {
      const updatedFolders = collection.folders.filter(f => f._id !== folderId);
      useCollectionsStore.getState().updateCollection(collectionId, { folders: updatedFolders });
      toast.success('Folder deleted');
    }
  }, [collections]);

  const handleTabSelect = useCallback((tabId: string) => {
    setActiveTabId(tabId);
    setResponse(null);
    setConsoleLogs([]);
    setTestResults([]);
  }, []);

  const handleTabClose = useCallback((tabId: string) => {
    setTabs(prev => prev.filter(t => t.id !== tabId));
    if (activeTabId === tabId) {
      setActiveTabId(tabs[0]?.id || null);
    }
  }, [activeTabId, tabs]);

  const handleSelectRequest = useCallback((request: ApiRequest, collectionId?: string) => {
    const existingTab = tabs.find(t => t.request._id === request._id);
    if (existingTab) {
      setActiveTabId(existingTab.id);
    } else {
      const newTab: RequestTab = {
        id: uuidv4(),
        type: 'request',
        request,
      };
      setTabs(prev => [...prev, newTab]);
      setActiveTabId(newTab.id);
    }
    setResponse(null);
    setConsoleLogs([]);
    setTestResults([]);
    setActivePanel('http');
  }, [tabs]);

  const handleSelectHistory = useCallback((request: ApiRequest) => {
    const existingTab = tabs.find((t): t is RequestTab => t.type === 'request' && t.request._id === request._id);
    if (existingTab) {
      setActiveTabId(existingTab.id);
    } else {
      const newTab: RequestTab = {
        id: uuidv4(),
        type: 'request',
        request,
      };
      setTabs(prev => [...prev, newTab]);
      setActiveTabId(newTab.id);
    }
    setResponse(null);
    setConsoleLogs([]);
    setTestResults([]);
    setActivePanel('http');
  }, [tabs]);

  const handleSelectCollection = useCallback((collection: Collection) => {
    const existingTab = tabs.find((t): t is CollectionTab => t.type === 'collection' && t.collection._id === collection._id);
    if (existingTab) {
      setActiveTabId(existingTab.id);
    } else {
      const newTab: CollectionTab = {
        id: uuidv4(),
        type: 'collection',
        collection,
      };
      setTabs(prev => [...prev, newTab]);
      setActiveTabId(newTab.id);
    }
    setActivePanel('http');
  }, [tabs]);

  const handleSelectFolder = useCallback((collection: Collection, folder: Folder) => {
    const existingTab = tabs.find((t): t is FolderTab => t.type === 'folder' && t.folder._id === folder._id);
    if (existingTab) {
      setActiveTabId(existingTab.id);
    } else {
      const newTab: FolderTab = {
        id: uuidv4(),
        type: 'folder',
        collection,
        folder,
      };
      setTabs(prev => [...prev, newTab]);
      setActiveTabId(newTab.id);
    }
    setActivePanel('http');
  }, [tabs]);

  const handleRequestChange = useCallback((updatedRequest: ApiRequest) => {
    setTabs(prev => prev.map(t => 
      t.id === activeTabId && t.type === 'request'
        ? { ...t, request: updatedRequest }
        : t
    ));
    
    if (updatedRequest.collectionId) {
      updateRequest(updatedRequest._id, updatedRequest);
    }
  }, [activeTabId, updateRequest]);

  const executeScript = useCallback((script: string, context: { request: ApiRequest; response?: Response }) => {
    const logs: string[] = [];
    
    const console = {
      log: (...args: unknown[]) => logs.push(args.map(String).join(' ')),
      error: (...args: unknown[]) => logs.push(`ERROR: ${args.map(String).join(' ')}`),
      warn: (...args: unknown[]) => logs.push(`WARN: ${args.map(String).join(' ')}`),
      info: (...args: unknown[]) => logs.push(`INFO: ${args.map(String).join(' ')}`),
    };

    const pm = {
      request: context.request,
      response: context.response,
      sendRequest: (req: ApiRequest, callback: (err: Error | null, res: Response | null) => void) => {
        apiClient.post<Response>('/api/execute', req)
          .then((res) => callback(null, res.data || null))
          .catch((err) => callback(err, null));
      },
      environment: {
        get: (key: string) => {
          const env = useWorkspaceStore.getState().currentEnvironment;
          return env?.variables.find((v) => v.key === key)?.value;
        },
        set: (key: string, value: string) => {
          const env = useWorkspaceStore.getState().currentEnvironment;
          if (env) {
            const variables = [...env.variables];
            const index = variables.findIndex((v) => v.key === key);
            if (index >= 0) {
              variables[index] = { ...variables[index], value };
            } else {
              variables.push({ key, value, type: 'default', enabled: true });
            }
            useWorkspaceStore.getState().updateEnvironment(env._id, { variables });
          }
        },
      },
      collectionVariables: {
        get: (key: string) => {
          const coll = useCollectionsStore.getState().currentCollection;
          return coll?.variables.find((v) => v.key === key)?.value;
        },
        set: (key: string, value: string) => {
          const coll = useCollectionsStore.getState().currentCollection;
          if (coll) {
            const variables = [...coll.variables];
            const index = variables.findIndex((v) => v.key === key);
            if (index >= 0) {
              variables[index] = { ...variables[index], value };
            } else {
              variables.push({ key, value, type: 'default', enabled: true });
            }
            useCollectionsStore.getState().updateCollection(coll._id, { variables });
          }
        },
      },
      globals: {
        get: (key: string) => {
          const global = useWorkspaceStore.getState().globalVariables.find((v) => v.key === key);
          return global?.value;
        },
        set: (key: string, value: string) => {
          useWorkspaceStore.getState().updateGlobalVariable(key, { value });
        },
      },
      test: (name: string, fn: () => void) => {
        try {
          fn();
          setTestResults((prev) => [...prev, { name, passed: true }]);
        } catch (error) {
          setTestResults((prev) => [...prev, {
            name,
            passed: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }]);
        }
      },
      expect: (value: unknown) => ({
        to: {
          have: {
            status: (expected: number) => {
              if (context.response?.status !== expected) {
                throw new Error(`Expected status ${expected}, got ${context.response?.status}`);
              }
            },
            property: (prop: string) => ({
              that: (expected: unknown) => {
                const actual = (value as Record<string, unknown>)[prop];
                if (actual !== expected) {
                  throw new Error(`Expected ${prop} to be ${expected}, got ${actual}`);
                }
              },
            }),
          },
        },
      }),
    };

    try {
      const fn = new Function('console', 'pm', script);
      fn(console, pm);
    } catch (error) {
      logs.push(`Script Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return logs;
  }, []);

  const handleSendRequest = useCallback(async () => {
    if (!currentRequest || !currentRequest.url.trim()) return;

    setIsLoading(true);
    setResponse(null);
    setConsoleLogs([]);
    setTestResults([]);

    try {
      if (currentRequest.preRequestScript) {
        const scriptLogs = executeScript(currentRequest.preRequestScript, { request: currentRequest });
        setConsoleLogs((prev) => [...prev, ...scriptLogs]);
      }

      const authHeaders: Record<string, string> = {};
      if (currentRequest.auth.type === 'bearer' && currentRequest.auth.bearer) {
        const prefix = currentRequest.auth.bearer.prefix || 'Bearer';
        authHeaders['Authorization'] = `${prefix} ${currentRequest.auth.bearer.token}`;
      } else if (currentRequest.auth.type === 'basic' && currentRequest.auth.basic) {
        const credentials = btoa(`${currentRequest.auth.basic.username}:${currentRequest.auth.basic.password}`);
        authHeaders['Authorization'] = `Basic ${credentials}`;
      } else if (currentRequest.auth.type === 'apikey' && currentRequest.auth.apikey) {
        if (currentRequest.auth.apikey.location === 'header') {
          authHeaders[currentRequest.auth.apikey.key] = currentRequest.auth.apikey.value;
        }
      }

      const response = await apiClient.post<Response>('/api/execute', {
        method: currentRequest.method,
        url: currentRequest.url,
        headers: [...currentRequest.headers.filter((h) => !h.disabled), ...Object.entries(authHeaders).map(([key, value]) => ({ key, value }))],
        params: currentRequest.params.filter((p) => !p.disabled),
        body: currentRequest.body,
        timeout: 30000,
      });

      if (response.success && response.data) {
        setResponse(response.data);

        if (currentRequest.testScript) {
          const scriptLogs = executeScript(currentRequest.testScript, { request: currentRequest, response: response.data });
          setConsoleLogs((prev) => [...prev, ...scriptLogs]);
        }
      } else {
        setResponse({
          status: 0,
          statusText: 'Error',
          headers: {},
          body: response.error || 'Unknown error occurred',
          contentType: 'text/plain',
          time: 0,
          size: 0,
          cookies: [],
        });
      }

      addToHistory(currentRequest);
    } catch (error) {
      setResponse({
        status: 0,
        statusText: 'Error',
        headers: {},
        body: error instanceof Error ? error.message : 'Request failed',
        contentType: 'text/plain',
        time: 0,
        size: 0,
        cookies: [],
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentRequest, executeScript, addToHistory]);

  const handleSendAndDownload = useCallback(async () => {
    if (!currentRequest || !currentRequest.url.trim()) return;

    setIsLoading(true);
    setResponse(null);
    setConsoleLogs([]);
    setTestResults([]);

    try {
      if (currentRequest.preRequestScript) {
        const scriptLogs = executeScript(currentRequest.preRequestScript, { request: currentRequest });
        setConsoleLogs((prev) => [...prev, ...scriptLogs]);
      }

      const authHeaders: Record<string, string> = {};
      if (currentRequest.auth.type === 'bearer' && currentRequest.auth.bearer) {
        const prefix = currentRequest.auth.bearer.prefix || 'Bearer';
        authHeaders['Authorization'] = `${prefix} ${currentRequest.auth.bearer.token}`;
      } else if (currentRequest.auth.type === 'basic' && currentRequest.auth.basic) {
        const credentials = btoa(`${currentRequest.auth.basic.username}:${currentRequest.auth.basic.password}`);
        authHeaders['Authorization'] = `Basic ${credentials}`;
      } else if (currentRequest.auth.type === 'apikey' && currentRequest.auth.apikey) {
        if (currentRequest.auth.apikey.location === 'header') {
          authHeaders[currentRequest.auth.apikey.key] = currentRequest.auth.apikey.value;
        }
      }

      // Build URL with params
      let url = currentRequest.url;
      const params = currentRequest.params.filter((p) => !p.disabled && p.key);
      if (params.length > 0) {
        const searchParams = new URLSearchParams();
        params.forEach((p) => searchParams.append(p.key, p.value));
        url += (url.includes('?') ? '&' : '?') + searchParams.toString();
      }

      // Make direct fetch request for download
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          method: currentRequest.method,
          url: currentRequest.url,
          headers: [...currentRequest.headers.filter((h) => !h.disabled), ...Object.entries(authHeaders).map(([key, value]) => ({ key, value }))],
          params: currentRequest.params.filter((p) => !p.disabled),
          body: currentRequest.body,
          timeout: 30000,
        }),
      });

      if (response.ok) {
        // Get filename from content-disposition header or use default
        const contentDisposition = response.headers.get('content-disposition');
        let filename = 'download';
        if (contentDisposition) {
          const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
          if (match) {
            filename = match[1].replace(/['"]/g, '');
          }
        }

        // Get content type
        const contentType = response.headers.get('content-type') || 'application/octet-stream';

        // Download the file
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);

        // Set a minimal response for display
        setResponse({
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: `Downloaded: ${filename} (${(blob.size / 1024).toFixed(2)} KB)`,
          contentType,
          time: 0,
          size: blob.size,
          cookies: [],
        });
      } else {
        const errorText = await response.text();
        setResponse({
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: errorText || 'Download failed',
          contentType: 'text/plain',
          time: 0,
          size: 0,
          cookies: [],
        });
      }

      addToHistory(currentRequest);
    } catch (error) {
      setResponse({
        status: 0,
        statusText: 'Error',
        headers: {},
        body: error instanceof Error ? error.message : 'Download failed',
        contentType: 'text/plain',
        time: 0,
        size: 0,
        cookies: [],
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentRequest, executeScript, addToHistory]);

  const handleCancelRequest = useCallback(() => {
    // Cancel the current request by setting isLoading to false
    // In a real implementation, you'd use AbortController
    setIsLoading(false);
  }, []);

  const handleLogout = () => {
    syncManager.disconnect();
    logout();
    window.location.href = '/login';
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <SearchShortcut onOpen={() => setShowSearch(true)} />
      
      <Sidebar
        onSelectRequest={handleSelectRequest}
        onSelectHistory={handleSelectHistory}
        onSelectCollection={(collection) => {
          setSelectedCollection(collection);
          setSelectedFolder(null);
          handleSelectCollection(collection);
        }}
        onSelectFolder={(collection, folder) => {
          setSelectedCollection(collection);
          setSelectedFolder(folder);
          handleSelectFolder(collection, folder);
        }}
        onSelectEnvironment={(environment) => {
          setSelectedEnvironment(environment);
          setShowGlobals(false);
        }}
        onSelectGlobals={() => {
          setSelectedEnvironment(null);
          setShowGlobals(true);
        }}
        onCreateNew={handleCreateNew}
        onDeleteCollection={handleDeleteCollection}
        onDeleteFolder={handleDeleteFolder}
        activeCollectionId={selectedCollection?._id}
        activeFolderId={selectedFolder?._id}
        width={sidebarWidth}
        onWidthChange={setSidebarWidth}
        isCollapsed={sidebarCollapsed}
        onCollapseChange={setSidebarCollapsed}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar
          onSearchOpen={() => setShowSearch(true)}
          onTeamOpen={() => setShowTeamModal(true)}
          onSettingsOpen={() => {}}
          onNewRequest={handleNewRequest}
        />

        {tabs.length > 0 && (
          <RequestTabs
            tabs={tabs}
            activeTabId={activeTabId}
            onTabSelect={handleTabSelect}
            onTabClose={handleTabClose}
            onNewTab={handleNewRequest}
            getMethodColor={getMethodColor}
          />
        )}

        <div className="flex-1 overflow-hidden relative" onMouseMove={(e) => {
          if (isDragging) {
            const container = e.currentTarget.getBoundingClientRect();
            const newPosition = ((e.clientX - container.left) / container.width) * 100;
            setSplitPosition(Math.max(20, Math.min(80, newPosition)));
          }
        }} onMouseUp={() => setIsDragging(false)} onMouseLeave={() => setIsDragging(false)}>
          {layout === 'horizontal' ? (
            <>
              <div className="absolute inset-0 overflow-y-auto" style={{ width: `${splitPosition}%` }}>
                {currentTab?.type === 'collection' && (
                  <CollectionFolderViewer
                    type="collection"
                    collection={currentTab.collection}
                    onSelectRequest={handleSelectRequest}
                    onCreateRequest={handleNewRequest}
                  />
                )}
                {currentTab?.type === 'folder' && (
                  <CollectionFolderViewer
                    type="folder"
                    collection={currentTab.collection}
                    folder={currentTab.folder}
                    onSelectRequest={handleSelectRequest}
                    onCreateRequest={handleNewRequest}
                  />
                )}
                {currentTab?.type === 'request' && (
                  activePanel === 'http' ? (
                    <RequestBuilder
                      request={currentRequest}
                      onRequestChange={handleRequestChange}
                      onSend={handleSendRequest}
                      onSendAndDownload={handleSendAndDownload}
                      onCancel={handleCancelRequest}
                      isLoading={isLoading}
                    />
                  ) : (
                    <WebSocketRequest />
                  )
                )}
                {!currentTab && (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <p>Select or create a request to get started</p>
                  </div>
                )}
              </div>
              <div
                className="absolute top-0 bottom-0 w-1 bg-[#3d3d3d] hover:bg-[#ff6b35] cursor-col-resize z-10"
                style={{ left: `${splitPosition}%` }}
                onMouseDown={() => setIsDragging(true)}
              />
              <div className="absolute inset-0 overflow-y-auto" style={{ left: `${splitPosition}%` }}>
                {currentTab?.type === 'request' && activePanel === 'http' && (
                  <ResponseViewer
                    response={response}
                    isLoading={isLoading}
                    consoleLogs={consoleLogs}
                    testResults={testResults}
                  />
                )}
              </div>
            </>
          ) : (
            <>
              <div 
                className="absolute inset-0 overflow-y-auto border-b border-[#3d3d3d]"
                style={{ height: `${verticalSplitPosition}%` }}
              >
                {currentTab?.type === 'collection' && (
                  <CollectionFolderViewer
                    type="collection"
                    collection={currentTab.collection}
                    onSelectRequest={handleSelectRequest}
                    onCreateRequest={handleNewRequest}
                  />
                )}
                {currentTab?.type === 'folder' && (
                  <CollectionFolderViewer
                    type="folder"
                    collection={currentTab.collection}
                    folder={currentTab.folder}
                    onSelectRequest={handleSelectRequest}
                    onCreateRequest={handleNewRequest}
                  />
                )}
                {currentTab?.type === 'request' && (
                  activePanel === 'http' ? (
                    <RequestBuilder
                      request={currentRequest}
                      onRequestChange={handleRequestChange}
                      onSend={handleSendRequest}
                      onSendAndDownload={handleSendAndDownload}
                      onCancel={handleCancelRequest}
                      isLoading={isLoading}
                    />
                  ) : (
                    <WebSocketRequest />
                  )
                )}
                {!currentTab && (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <p>Select or create a request to get started</p>
                  </div>
                )}
              </div>
              <div
                className="absolute left-0 right-0 h-1 bg-[#3d3d3d] hover:bg-[#ff6b35] cursor-row-resize z-10"
                style={{ top: `${verticalSplitPosition}%` }}
                onMouseDown={() => setIsDraggingVertical(true)}
              />
              <div 
                className="absolute inset-0 overflow-y-auto"
                style={{ top: `${verticalSplitPosition}%` }}
              >
                {currentTab?.type === 'request' && activePanel === 'http' && (
                  <ResponseViewer
                    response={response}
                    isLoading={isLoading}
                    consoleLogs={consoleLogs}
                    testResults={testResults}
                  />
                )}
              </div>
            </>
          )}
        </div>

        <BottomBar
          layout={layout}
          onLayoutChange={setLayout}
          onHelpOpen={() => setShowHelp(true)}
          onConsoleOpen={() => {}}
        />
      </div>

      {selectedCollection && (
        <div className="w-[500px] border-l border-[#3d3d3d]">
          <CollectionPanel
            collection={selectedCollection}
            folder={selectedFolder || undefined}
            onClose={() => {
              setSelectedCollection(null);
              setSelectedFolder(null);
            }}
            onUpdateCollection={(updates) => {
              useCollectionsStore.getState().updateCollection(selectedCollection._id, updates);
              setSelectedCollection({ ...selectedCollection, ...updates });
            }}
            onUpdateFolder={(folderId, updates) => {
              useCollectionsStore.getState().updateFolder(selectedCollection._id, folderId, updates);
              if (selectedFolder && selectedFolder._id === folderId) {
                setSelectedFolder({ ...selectedFolder, ...updates });
              }
            }}
          />
        </div>
      )}

      {(selectedEnvironment || showGlobals) && (
        <div className="w-[500px] border-l border-[#3d3d3d]">
          <EnvironmentPanel
            environment={showGlobals 
              ? { _id: 'globals', type: 'environment', name: 'Globals', workspaceId: currentWorkspace?._id || '', variables: globalVariables, createdAt: '', updatedAt: '', isGlobal: true }
              : selectedEnvironment!
            }
            isGlobals={showGlobals}
            onClose={() => {
              setSelectedEnvironment(null);
              setShowGlobals(false);
            }}
            onUpdate={(updates) => {
              if (showGlobals && updates.variables) {
                useWorkspaceStore.getState().updateGlobalVariables(updates.variables);
              } else if (selectedEnvironment) {
                useWorkspaceStore.getState().updateEnvironment(selectedEnvironment._id, updates);
                setSelectedEnvironment({ ...selectedEnvironment, ...updates });
              }
            }}
            onDelete={() => {
              if (selectedEnvironment) {
                useWorkspaceStore.getState().removeEnvironment(selectedEnvironment._id);
                setSelectedEnvironment(null);
              }
            }}
            onDuplicate={() => {
              if (selectedEnvironment) {
                const newEnv: Environment = {
                  ...selectedEnvironment,
                  _id: `environment:${uuidv4()}`,
                  name: `${selectedEnvironment.name} (Copy)`,
                };
                addEnvironment(newEnv);
              }
            }}
          />
        </div>
      )}

      <TeamManagement
        isOpen={showTeamModal}
        onClose={() => setShowTeamModal(false)}
      />

      <GlobalSearch
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
        onSelectRequest={handleSelectRequest}
      />

      <HelpModal
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
      />

      <ToastContainer />
    </div>
  );
}
