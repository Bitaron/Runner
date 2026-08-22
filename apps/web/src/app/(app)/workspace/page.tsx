'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Menu, Terminal, X } from 'lucide-react';
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
import { useMediaQuery } from '@/hooks/useMediaQuery';
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

const mergeServerFirst = <T extends { _id: string }>(serverItems: T[], localItems: T[]): T[] => {
  const serverIds = new Set(serverItems.map((item) => item._id));
  return [...serverItems, ...localItems.filter((item) => !serverIds.has(item._id))];
};

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
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showConsole, setShowConsole] = useState(false);
  const [appLogs, setAppLogs] = useState<string[]>([]);

  const isMobile = useMediaQuery('(max-width: 767px)');
  const isTablet = useMediaQuery('(min-width: 768px) and (max-width: 1023px)');

  const { addCollection, addRequest, updateRequest, addToHistory, createNewRequest } = useCollectionsStore();
  const { currentWorkspace, workspaces, setWorkspaces, setCurrentWorkspace, environments, globalVariables, addEnvironment, updateEnvironment, removeEnvironment, setEnvironments } = useWorkspaceStore();
  const { user, tokens, isAnonymous, isAuthenticated, hasHydrated, logout } = useAuthStore();

  const currentTab = tabs.find(t => t.id === activeTabId) as Tab | undefined;
  const currentRequest = currentTab?.type === 'request' ? currentTab.request : null;

  const workspacesLoadedRef = useRef(false);

  useEffect(() => {
    if (!hasHydrated || !isAuthenticated) {
      setIsInitialLoading(false);
      return undefined;
    }

    let cancelled = false;

    const loadWorkspaceData = async () => {
      const workspaceId = useWorkspaceStore.getState().currentWorkspace?._id;
      const params = workspaceId ? { workspaceId } : undefined;
      const [collectionsRes, environmentsRes] = await Promise.all([
        apiClient.get<Collection[]>('/api/collections', params),
        apiClient.get<Environment[]>('/api/environments', params),
      ]);
      if (cancelled) return;
      if (collectionsRes.success && collectionsRes.data) {
        useCollectionsStore.getState().setCollections(
          mergeServerFirst(collectionsRes.data, useCollectionsStore.getState().collections)
        );
      }
      if (environmentsRes.success && environmentsRes.data) {
        setEnvironments(mergeServerFirst(environmentsRes.data, useWorkspaceStore.getState().environments));
      }
    };

    const loadInitialData = async () => {
      setIsInitialLoading(true);
      try {
        if (!workspacesLoadedRef.current) {
          const workspacesRes = await apiClient.get<Workspace[]>('/api/workspaces');
          if (!cancelled && workspacesRes.success && workspacesRes.data) {
            setWorkspaces(workspacesRes.data);
            const current = useWorkspaceStore.getState().currentWorkspace;
            if ((!current || !workspacesRes.data.some((w) => w._id === current._id)) && workspacesRes.data.length > 0) {
              setCurrentWorkspace(workspacesRes.data[0]);
            }
            workspacesLoadedRef.current = true;
          }
        }
        await loadWorkspaceData();
      } catch {
        // keep persisted local state when the API rejects or is unreachable
      } finally {
        if (!cancelled) {
          setIsInitialLoading(false);
        }
      }
    };

    loadInitialData();

    return () => {
      cancelled = true;
    };
  }, [hasHydrated, isAuthenticated, currentWorkspace?._id, setWorkspaces, setCurrentWorkspace, setEnvironments]);

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

  useEffect(() => {
    setSidebarCollapsed(isTablet);
  }, [isTablet]);

  useEffect(() => {
    if (!isMobile) {
      setMobileSidebarOpen(false);
    }
  }, [isMobile]);

  useEffect(() => {
    if (!mobileSidebarOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileSidebarOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileSidebarOpen]);

  useEffect(() => {
    document.title = currentWorkspace
      ? `${currentWorkspace.name} - Runner`
      : 'Runner - API Development Platform';
  }, [currentWorkspace]);

  const appendAppLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setAppLogs((prev) => [...prev.slice(-99), `[${timestamp}] ${message}`]);
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
    useCollectionsStore.getState().removeFolder(collectionId, folderId);
    toast.success('Folder deleted');
  }, []);

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
    const existingTab = tabs.find(t => t.type === 'request' && t.request._id === request._id);
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

  const buildRequestPayload = useCallback(async (request: ApiRequest) => {
    let effectiveRequest = request;

    if (request.preRequestScript) {
      const scriptRequest: ApiRequest = {
        ...request,
        headers: [...request.headers],
        params: [...request.params],
      };
      const scriptLogs = executeScript(request.preRequestScript, { request: scriptRequest });
      setConsoleLogs((prev) => [...prev, ...scriptLogs]);

      const mutableFields = ['method', 'url', 'headers', 'params', 'body', 'auth'] as const;
      const updates: Partial<ApiRequest> = {};
      mutableFields.forEach((field) => {
        if (scriptRequest[field] !== request[field]) {
          (updates as Record<string, unknown>)[field] = scriptRequest[field];
        }
      });
      effectiveRequest = { ...request, ...updates };
    }

    const authHeaders: Record<string, string> = {};
    if (effectiveRequest.auth.type === 'bearer' && effectiveRequest.auth.bearer) {
      const prefix = effectiveRequest.auth.bearer.prefix || 'Bearer';
      authHeaders['Authorization'] = `${prefix} ${effectiveRequest.auth.bearer.token}`;
    } else if (effectiveRequest.auth.type === 'basic' && effectiveRequest.auth.basic) {
      const credentials = btoa(`${effectiveRequest.auth.basic.username}:${effectiveRequest.auth.basic.password}`);
      authHeaders['Authorization'] = `Basic ${credentials}`;
    } else if (effectiveRequest.auth.type === 'apikey' && effectiveRequest.auth.apikey) {
      if (effectiveRequest.auth.apikey.location === 'header') {
        authHeaders[effectiveRequest.auth.apikey.key] = effectiveRequest.auth.apikey.value;
      }
    }

    const payload = {
      method: effectiveRequest.method,
      url: effectiveRequest.url,
      headers: [...effectiveRequest.headers.filter((h) => !h.disabled), ...Object.entries(authHeaders).map(([key, value]) => ({ key, value }))],
      params: effectiveRequest.params.filter((p) => !p.disabled),
      body: effectiveRequest.body,
      timeout: 30000,
    };

    return { request: effectiveRequest, authHeaders, payload };
  }, [executeScript]);

  const createErrorState = useCallback((message: string): Response => ({
    status: 0,
    statusText: 'Error',
    headers: {},
    body: message,
    contentType: 'text/plain',
    time: 0,
    size: 0,
    cookies: [],
  }), []);

  const executeViewRequest = useCallback(
    async ({ request, payload }: { request: ApiRequest; payload: Record<string, unknown> }) => {
      const response = await apiClient.post<Response>('/api/execute', payload);

      if (response.success && response.data) {
        setResponse(response.data);
        appendAppLog(`${request.method} ${request.url} → ${response.data.status} ${response.data.statusText} (${response.data.time}ms)`);

        if (request.testScript) {
          const scriptLogs = executeScript(request.testScript, { request, response: response.data });
          setConsoleLogs((prev) => [...prev, ...scriptLogs]);
        }
      } else {
        setResponse(createErrorState(response.error || 'Unknown error occurred'));
        appendAppLog(`${request.method} ${request.url} → Error: ${response.error || 'Unknown error'}`);
      }
    },
    [executeScript, appendAppLog, createErrorState]
  );

  const executeDownloadRequest = useCallback(
    async ({ request, payload }: { request: ApiRequest; payload: Record<string, unknown> }) => {
      const startedAt = Date.now();

      // Direct fetch so the raw body can be saved as a file
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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

        const contentType = response.headers.get('content-type') || 'application/octet-stream';

        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);

        setResponse({
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: `Downloaded: ${filename} (${(blob.size / 1024).toFixed(2)} KB)`,
          contentType,
          time: Date.now() - startedAt,
          size: blob.size,
          cookies: [],
        });
        appendAppLog(`${request.method} ${request.url} → ${response.status} ${response.statusText} (downloaded ${filename})`);
      } else {
        const errorText = await response.text();
        setResponse({
          ...createErrorState(errorText || 'Download failed'),
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
        });
        appendAppLog(`${request.method} ${request.url} → Error: ${response.status} ${response.statusText}`);
      }
    },
    [appendAppLog, createErrorState]
  );

  const runSendFlow = useCallback(
    async (mode: 'view' | 'download') => {
      if (!currentRequest || !currentRequest.url.trim()) return;

      setIsLoading(true);
      setResponse(null);
      setConsoleLogs([]);
      setTestResults([]);

      try {
        const built = await buildRequestPayload(currentRequest);

        if (mode === 'download') {
          await executeDownloadRequest(built);
        } else {
          await executeViewRequest(built);
        }

        addToHistory(built.request);
      } catch (error) {
        setResponse(createErrorState(error instanceof Error ? error.message : 'Request failed'));
        appendAppLog(`${currentRequest?.method ?? ''} ${currentRequest?.url ?? ''} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setIsLoading(false);
      }
    },
    [currentRequest, buildRequestPayload, executeViewRequest, executeDownloadRequest, addToHistory, appendAppLog, createErrorState]
  );

  const handleSendRequest = useCallback(() => {
    void runSendFlow('view');
  }, [runSendFlow]);

  const handleSendAndDownload = useCallback(() => {
    void runSendFlow('download');
  }, [runSendFlow]);

  const handleCancelRequest = useCallback(() => {
    // Cancel the current request by setting isLoading to false
    // In a real implementation, you'd use AbortController
    setIsLoading(false);
  }, []);

  const handleLogout = async () => {
    syncManager.disconnect();
    try {
      await apiClient.post('/api/auth/logout');
    } catch {
      // Server unreachable; clear local state anyway
    }
    logout();
    window.location.href = '/login';
  };

  return (
    <div className="relative flex h-screen overflow-hidden">
      <SearchShortcut onOpen={() => setShowSearch(true)} />

      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <div
        id="workspace-sidebar"
        className={cn(
          'shrink-0 h-full',
          'max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:w-[85vw] max-md:max-w-[320px]',
          'max-md:shadow-2xl max-md:transition-transform max-md:duration-200',
          mobileSidebarOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full max-md:pointer-events-none'
        )}
      >
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
          className="max-md:!w-full"
        />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden relative">
        <div className="flex md:hidden items-center gap-2 h-10 px-2 bg-[#262627] border-b border-[#3d3d3d]">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={mobileSidebarOpen}
            aria-controls="workspace-sidebar"
            className="p-2 text-gray-400 hover:text-white hover:bg-[#3d3d3d] rounded transition-colors"
          >
            <Menu className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-white truncate">
            {currentWorkspace?.name || 'Runner'}
          </span>
        </div>

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
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize request and response panes"
                aria-valuenow={Math.round(splitPosition)}
                aria-valuemin={20}
                aria-valuemax={80}
                tabIndex={0}
                className="absolute top-0 bottom-0 w-1 bg-[#3d3d3d] hover:bg-[#ff6b35] cursor-col-resize z-10 focus-visible:bg-[#ff6b35] focus:outline-none"
                style={{ left: `${splitPosition}%` }}
                onMouseDown={() => setIsDragging(true)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    setSplitPosition((prev) => Math.max(20, prev - 2));
                  } else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    setSplitPosition((prev) => Math.min(80, prev + 2));
                  }
                }}
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
                role="separator"
                aria-orientation="horizontal"
                aria-label="Resize request and response panes"
                aria-valuenow={Math.round(verticalSplitPosition)}
                aria-valuemin={20}
                aria-valuemax={80}
                tabIndex={0}
                className="absolute left-0 right-0 h-1 bg-[#3d3d3d] hover:bg-[#ff6b35] cursor-row-resize z-10 focus-visible:bg-[#ff6b35] focus:outline-none"
                style={{ top: `${verticalSplitPosition}%` }}
                onMouseDown={() => setIsDraggingVertical(true)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setVerticalSplitPosition((prev) => Math.max(20, prev - 2));
                  } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setVerticalSplitPosition((prev) => Math.min(80, prev + 2));
                  }
                }}
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

        {showConsole && (
          <div
            role="region"
            aria-label="Console output"
            className="flex flex-col h-56 shrink-0 bg-[#1e1e1e] border-t border-[#3d3d3d]"
          >
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#262627] border-b border-[#3d3d3d]">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Terminal className="w-3.5 h-3.5" />
                <span>Console</span>
              </div>
              <button
                type="button"
                onClick={() => setShowConsole(false)}
                aria-label="Close console"
                className="p-1 text-gray-400 hover:text-white hover:bg-[#3d3d3d] rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 font-mono text-xs text-gray-300 space-y-1">
              {[...appLogs, ...consoleLogs].length === 0 ? (
                <p className="text-gray-500">Console ready</p>
              ) : (
                [...appLogs, ...consoleLogs].map((entry, index) => (
                  <div key={index} className="whitespace-pre-wrap break-all">
                    {entry}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <BottomBar
          layout={layout}
          onLayoutChange={setLayout}
          onHelpOpen={() => setShowHelp(true)}
          onConsoleOpen={() => setShowConsole((prev) => !prev)}
        />
      </div>

      {selectedCollection && (
        <div className="fixed inset-y-0 right-0 z-40 w-full max-w-[500px] bg-[#262627] shadow-2xl border-l border-[#3d3d3d] sm:static sm:z-auto sm:w-[320px] sm:max-w-none sm:shadow-none md:w-[380px] lg:w-[500px]">
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
        <div className="fixed inset-y-0 right-0 z-40 w-full max-w-[500px] bg-[#262627] shadow-2xl border-l border-[#3d3d3d] sm:static sm:z-auto sm:w-[320px] sm:max-w-none sm:shadow-none md:w-[380px] lg:w-[500px]">
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

      {isInitialLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#1e1e1e]/80">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[#3d3d3d] border-t-[#ff6b35] rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Loading workspace…</p>
          </div>
        </div>
      )}

      <ToastContainer />
    </div>
  );
}
