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
import { TrashModal } from '@/components/trash/TrashModal';
import { MockManager } from '@/components/mocks/MockManager';
import { MonitorManager } from '@/components/monitors/MonitorManager';
import { VaultManager } from '@/components/vault/VaultManager';
import { AuditViewer } from '@/components/audit/AuditViewer';
import { PublishManager } from '@/components/publish/PublishManager';
import { useCollectionsStore } from '@/stores/collectionsStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useAuthStore } from '@/stores/authStore';
import { useCookieStore } from '@/stores/cookieStore';
import { CookieManager } from '@/components/cookies';
import { apiClient } from '@/lib/api';
import { syncManager } from '@/lib/syncManager';
import { canSyncToServer, createRequestOnServer, createFolderOnServer } from '@/lib/persistence';
import { getEffectiveAuth, getEffectiveScripts, getEffectiveVariables, interpolateVariables } from '@/lib/inheritance';
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
  const [visualizerHtml, setVisualizerHtml] = useState<string | null>(null);
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
  const [showCookieManager, setShowCookieManager] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [showMocks, setShowMocks] = useState(false);
  const [showMonitors, setShowMonitors] = useState(false);
  const [showVault, setShowVault] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
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
            let workspaceList = workspacesRes.data;

            // New/legacy users have no workspace; everything (collections,
            // requests, sync) is workspace-scoped, so provision one.
            if (workspaceList.length === 0) {
              try {
                const created = await apiClient.post<Workspace>('/api/workspaces', {
                  name: 'Personal Workspace',
                });
                if (created.success && created.data) {
                  workspaceList = [created.data];
                }
              } catch {
                // fall through with the empty list; local-only mode still works
              }
            }

            setWorkspaces(workspaceList);
            const current = useWorkspaceStore.getState().currentWorkspace;
            if ((!current || !workspaceList.some((w) => w._id === current._id)) && workspaceList.length > 0) {
              setCurrentWorkspace(workspaceList[0]);
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
      // The sync server listens on the /ws path; normalize env config that
      // omits it (e.g. NEXT_PUBLIC_WS_URL=ws://localhost:4000).
      const rawUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000/ws';
      const wsUrl = /\/ws\/?$/.test(rawUrl) ? rawUrl : `${rawUrl.replace(/\/$/, '')}/ws`;
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

  // Global drag handling for split panes (vertical + horizontal)
  // Ensures dragging continues even if cursor leaves the container
  useEffect(() => {
    if (!isDragging && !isDraggingVertical) return undefined;
    const handleWindowMouseMove = (e: MouseEvent) => {
      const container = document.getElementById('workspace-split-container');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      if (isDragging) {
        const pct = ((e.clientX - rect.left) / rect.width) * 100;
        setSplitPosition(Math.max(20, Math.min(80, pct)));
      }
      if (isDraggingVertical) {
        const pct = ((e.clientY - rect.top) / rect.height) * 100;
        setVerticalSplitPosition(Math.max(20, Math.min(80, pct)));
      }
    };
    const handleWindowMouseUp = () => {
      setIsDragging(false);
      setIsDraggingVertical(false);
    };
    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    // Prevent text selection while dragging
    document.body.style.userSelect = 'none';
    document.body.style.cursor = isDragging ? 'col-resize' : 'row-resize';
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isDragging, isDraggingVertical]);

  const appendAppLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setAppLogs((prev) => [...prev.slice(-99), `[${timestamp}] ${message}`]);
  }, []);


  const handleNewRequest = useCallback(async (overrides?: Partial<ApiRequest>) => {
    const userId = user?._id || 'anonymous';
    const workspaceId = currentWorkspace?._id || 'default';
    let newReq = createNewRequest(workspaceId, userId);

    // If a collection is selected, add the request to it
    if (selectedCollection) {
      newReq = { ...newReq, collectionId: selectedCollection._id };
    }
    if (overrides) {
      newReq = { ...newReq, ...overrides };
    }

    let finalRequest = newReq;
    if (selectedCollection) {
      const saved = await createRequestOnServer(newReq);
      if (saved) {
        finalRequest = saved;
      } else if (canSyncToServer()) {
        toast.error('Request saved locally only — could not reach server');
      }
      const updatedRequests = [...selectedCollection.requests, finalRequest];
      useCollectionsStore.getState().updateCollection(selectedCollection._id, { requests: updatedRequests });
    }

    const newTab: RequestTab = {
      id: uuidv4(),
      type: 'request',
      request: finalRequest,
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setResponse(null);
    setConsoleLogs([]);
    setTestResults([]);
    setActivePanel('http');
    toast.success('New request created');
  }, [user, currentWorkspace, createNewRequest, selectedCollection]);

  const handleCreateNew = useCallback((type: 'http' | 'graphql' | 'websocket' | 'grpc' | 'collection' | 'folder') => {
    if (type === 'http') {
      handleNewRequest();
    } else if (type === 'graphql') {
      handleNewRequest({
        method: 'POST',
        body: { mode: 'graphql', graphql: { query: '', variables: '' } },
      });
    } else if (type === 'websocket') {
      setActivePanel('websocket');
      toast.info('WebSocket panel opened');
    } else if (type === 'grpc') {
      handleNewRequest({
        method: 'POST',
        url: 'grpc://localhost:50051',
        body: { mode: 'grpc', grpc: { service: '', method: '', message: '{\n  \n}', metadata: [] } },
      });
      setActivePanel('http');
    } else if (type === 'collection') {
      // This is handled by the modal in Sidebar
    } else if (type === 'folder') {
      if (selectedCollection) {
        void (async () => {
          const serverCollection = await createFolderOnServer(selectedCollection._id, 'New Folder');
          if (serverCollection) {
            useCollectionsStore.getState().updateCollection(selectedCollection._id, {
              folders: serverCollection.folders,
            });
          } else {
            const newFolder: Folder = {
              _id: uuidv4(),
              name: 'New Folder',
              requests: [],
              folders: [],
              variables: [],
              auth: { type: 'none', inheritFromParent: true },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            const updatedFolders = [...selectedCollection.folders, newFolder];
            useCollectionsStore.getState().updateCollection(selectedCollection._id, { folders: updatedFolders });
            toast.error('Folder saved locally only — could not reach server');
          }
          toast.success('New folder created');
        })();
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
    setVisualizerHtml(null);
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
    setVisualizerHtml(null);
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
    setVisualizerHtml(null);
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
      response: context.response ? {
        ...context.response,
        json: () => { try { return JSON.parse(context.response!.body); } catch { return null; } },
        text: () => context.response!.body,
        code: context.response.status,
        status: context.response.statusText,
        responseTime: context.response.time,
        headers: {
          get: (name: string) => {
            const found = Object.entries(context.response!.headers).find(([k]) => k.toLowerCase() === name.toLowerCase());
            return found ? found[1] : undefined;
          },
          toObject: () => ({ ...context.response!.headers }),
        },
      } as unknown as Response & { json: () => unknown; text: () => string; code: number; status: string; responseTime: number; headers: { get: (n: string) => string | undefined; toObject: () => Record<string,string> } } : undefined,
      sendRequest: (req: unknown, callback: (err: Error | null, res: Response | null) => void) => {
        const payload = typeof req === 'string' ? { method: 'GET', url: req, headers: [], params: [], body: { mode: 'none' } } : req as ApiRequest;
        apiClient.post<Response>('/api/execute', payload)
          .then((res) => callback(null, res.data || null))
          .catch((err) => callback(err, null));
      },
      visualizer: {
        set: (template: string, data: unknown) => {
          try {
            let html = template;
            try {
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              const Handlebars = require('handlebars');
              html = Handlebars.compile(template)(data);
            } catch {
              // fallback simple {{key}} interpolation
              if (data && typeof data === 'object') {
                for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
                  const val = typeof v === 'string' ? v : JSON.stringify(v);
                  html = html.split(`{{${k}}}`).join(val);
                  html = html.split(`{{ ${k} }}`).join(val);
                }
              }
            }
            setVisualizerHtml(html);
          } catch (e) {
            logs.push(`Visualizer Error: ${e instanceof Error ? e.message : String(e)}`);
          }
        },
      },
      variables: {
        get: (key: string) => {
          const env = useWorkspaceStore.getState().currentEnvironment;
          const coll = useCollectionsStore.getState().currentCollection;
          return env?.variables.find(v => v.key === key)?.value
            ?? coll?.variables.find(v => v.key === key)?.value
            ?? useWorkspaceStore.getState().globalVariables.find(v => v.key === key)?.value;
        },
        set: (key: string, value: string) => {
          const env = useWorkspaceStore.getState().currentEnvironment;
          if (env) {
            const variables = [...env.variables];
            const idx = variables.findIndex(v => v.key === key);
            if (idx >= 0) variables[idx] = { ...variables[idx], value };
            else variables.push({ key, value, type: 'default', enabled: true });
            useWorkspaceStore.getState().updateEnvironment(env._id, { variables });
          }
        },
      },
      info: {
        requestName: context.request.name,
        requestId: context.request._id,
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
    // Resolve collection/folder early for inheritance (auth, vars, scripts)
    const { collections } = useCollectionsStore.getState();
    let requestCollection: Collection | null = null;
    let requestFolder: Folder | null = null;
    if (request.collectionId) {
      requestCollection = collections.find((c) => c._id === request.collectionId) || null;
      if (requestCollection && request.folderId) {
        const findFolder = (folders: Folder[]): Folder | null => {
          for (const f of folders) {
            if (f._id === request.folderId) return f;
            const nested = findFolder(f.folders);
            if (nested) return nested;
          }
          return null;
        };
        requestFolder = findFolder(requestCollection.folders);
      }
    }

    // Postman auth inheritance: request -> folder chain -> collection
    const effectiveAuth = getEffectiveAuth(request, requestCollection, requestFolder);
    let effectiveRequest: ApiRequest = { ...request, auth: effectiveAuth };

    // Postman script order: pre-request Collection → Folder chain → Request (outer → inner)
    const { preRequestScript: combinedPreScript } = getEffectiveScripts(
      requestCollection,
      requestFolder,
      request
    );
    if (combinedPreScript) {
      const scriptRequest: ApiRequest = {
        ...effectiveRequest,
        headers: [...effectiveRequest.headers],
        params: [...effectiveRequest.params],
        // clone body shallow; scripts can mutate body/auth/etc.
        body: { ...effectiveRequest.body } as typeof effectiveRequest.body,
        auth: { ...effectiveRequest.auth } as typeof effectiveRequest.auth,
      };
      const scriptLogs = executeScript(combinedPreScript, { request: scriptRequest });
      setConsoleLogs((prev) => [...prev, ...scriptLogs]);

      const mutableFields = ['method', 'url', 'headers', 'params', 'body', 'auth'] as const;
      const updates: Partial<ApiRequest> = {};
      mutableFields.forEach((field) => {
        // Use JSON comparison for objects to detect mutations inside headers/params/body/auth
        const before = JSON.stringify((effectiveRequest as unknown as Record<string, unknown>)[field]);
        const after = JSON.stringify((scriptRequest as unknown as Record<string, unknown>)[field]);
        if (before !== after) {
          (updates as Record<string, unknown>)[field] = scriptRequest[field];
        }
      });
      effectiveRequest = { ...effectiveRequest, ...updates };
    }

    const authHeaders: Record<string, string> = {};
    // Track apikey query location separately (needs to go into params, not headers)
    let apiKeyQuery: { key: string; value: string } | null = null;
    if (effectiveRequest.auth.type === 'bearer' && effectiveRequest.auth.bearer?.token) {
      const prefix = effectiveRequest.auth.bearer.prefix || 'Bearer';
      authHeaders['Authorization'] = `${prefix} ${effectiveRequest.auth.bearer.token}`;
    } else if (effectiveRequest.auth.type === 'basic' && effectiveRequest.auth.basic) {
      const credentials = btoa(`${effectiveRequest.auth.basic.username}:${effectiveRequest.auth.basic.password}`);
      authHeaders['Authorization'] = `Basic ${credentials}`;
    } else if (effectiveRequest.auth.type === 'apikey' && effectiveRequest.auth.apikey) {
      if (effectiveRequest.auth.apikey.location === 'header') {
        authHeaders[effectiveRequest.auth.apikey.key] = effectiveRequest.auth.apikey.value;
      } else if (effectiveRequest.auth.apikey.location === 'query') {
        apiKeyQuery = { key: effectiveRequest.auth.apikey.key, value: effectiveRequest.auth.apikey.value };
      }
    }

    // Auto-set Content-Type for body modes that imply one (Postman-like
    // behavior); an explicit header from the user always wins.
    const impliedContentTypes: Record<string, string> = {
      raw: effectiveRequest.body.rawType === 'json' ? 'application/json' : '',
      urlencoded: 'application/x-www-form-urlencoded',
    };
    const bodyContentType = effectiveRequest.body.mode === 'raw'
      ? (impliedContentTypes.raw || (effectiveRequest.body.rawType === 'xml' ? 'application/xml' : effectiveRequest.body.rawType === 'html' ? 'text/html' : 'text/plain'))
      : impliedContentTypes[effectiveRequest.body.mode] || '';

    const explicitHeaders = effectiveRequest.headers.filter((h) => !h.disabled);
    // Postman: explicit header wins over auto-generated auth header (case-insensitive)
    const authHeaderEntries = Object.entries(authHeaders).filter(
      ([k]) => !explicitHeaders.some((eh) => eh.key.trim().toLowerCase() === k.toLowerCase())
    );
    const headers = [...explicitHeaders, ...authHeaderEntries.map(([key, value]) => ({ key, value }))];
    if (
      bodyContentType &&
      !explicitHeaders.some((h) => h.key.trim().toLowerCase() === 'content-type')
    ) {
      headers.push({ key: 'Content-Type', value: bodyContentType });
    }

    // Interpolate variables in URL, headers, params, and body (Postman {{var}} support)
    // Refresh from store in case script mutated workspace/collection vars (pm.environment.set, pm.collectionVariables.set)
    const { currentEnvironment: interpEnv, globalVariables: interpGlobals } = useWorkspaceStore.getState();
    const { collections: postScriptCollections } = useCollectionsStore.getState();
    let interpCollection = requestCollection;
    let interpFolder = requestFolder;
    if (requestCollection) {
      const fresh = postScriptCollections.find((c) => c._id === requestCollection._id);
      if (fresh) {
        interpCollection = fresh;
        if (requestFolder) {
          const findFolder = (folders: Folder[]): Folder | null => {
            for (const f of folders) {
              if (f._id === requestFolder._id) return f;
              const nested = findFolder(f.folders);
              if (nested) return nested;
            }
            return null;
          };
          interpFolder = findFolder(fresh.folders);
        }
      }
    }
    const collectionVars = getEffectiveVariables(interpCollection, interpFolder);
    const envVarsForInterpolation = [
      ...interpGlobals.filter((v) => v.enabled),
      ...(interpEnv?.variables.filter((v) => v.enabled) || []),
    ];
    const doInterpolate = (val: string) => interpolateVariables(val, collectionVars, envVarsForInterpolation);

    const interpolatedUrl = doInterpolate(effectiveRequest.url);
    const interpolatedHeaders = headers.map((h) => ({
      ...h,
      key: doInterpolate(h.key),
      value: doInterpolate(h.value),
    }));
    // Cookie jar: auto-attach matching cookies if no explicit Cookie header
    if (!interpolatedHeaders.some(h => h.key.trim().toLowerCase() === 'cookie')) {
      const jarCookies = useCookieStore.getState().getCookiesForUrl(interpolatedUrl);
      if (jarCookies.length > 0) {
        interpolatedHeaders.push({ key: 'Cookie', value: jarCookies.map(c => `${c.name}=${c.value}`).join('; ') });
      }
    }
    // Merge apiKey query (if auth type apikey query) into params post-interpolation
    const paramsWithApiKey = apiKeyQuery
      ? [...effectiveRequest.params, { key: apiKeyQuery.key, value: apiKeyQuery.value }]
      : effectiveRequest.params;
    const interpolatedParams = paramsWithApiKey
      .filter((p) => !p.disabled)
      .map((p) => ({
        ...p,
        key: doInterpolate(p.key),
        value: doInterpolate(p.value),
      }));
    const interpolatedBody = (() => {
      const b = effectiveRequest.body;
      if (!b || b.mode === 'none') return b;
      if (b.mode === 'raw' && b.raw) {
        return { ...b, raw: doInterpolate(b.raw) };
      }
      if (b.mode === 'formdata' && b.formdata) {
        return { ...b, formdata: b.formdata.map((f) => ({ ...f, key: doInterpolate(f.key), value: doInterpolate(f.value) })) };
      }
      if (b.mode === 'urlencoded' && b.urlencoded) {
        return { ...b, urlencoded: b.urlencoded.map((f) => ({ ...f, key: doInterpolate(f.key), value: doInterpolate(f.value) })) };
      }
      if (b.mode === 'graphql' && b.graphql) {
        return { ...b, graphql: { query: doInterpolate(b.graphql.query), variables: b.graphql.variables ? doInterpolate(b.graphql.variables) : b.graphql.variables } };
      }
      if (b.mode === 'grpc' && b.grpc) {
        return { ...b, grpc: { service: doInterpolate(b.grpc.service), method: doInterpolate(b.grpc.method), message: doInterpolate(b.grpc.message), metadata: b.grpc.metadata?.map(m => ({ ...m, key: doInterpolate(m.key), value: doInterpolate(m.value) })), serverUrl: b.grpc.serverUrl ? doInterpolate(b.grpc.serverUrl) : undefined } };
      }
      return b;
    })();

    const payload = {
      method: effectiveRequest.method,
      url: interpolatedUrl,
      headers: interpolatedHeaders,
      params: interpolatedParams,
      body: interpolatedBody,
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
        // persist cookies to jar
        if (response.data.cookies && response.data.cookies.length > 0) {
          useCookieStore.getState().upsertCookiesFromResponse(response.data.cookies, request.url);
        }
        appendAppLog(`${request.method} ${request.url} → ${response.data.status} ${response.data.statusText} (${response.data.time}ms)`);

        // Post-response tests: Postman runs Request → Folder → Collection (inner → outer)
        const { collections } = useCollectionsStore.getState();
        let testCollection: Collection | null = null;
        let testFolder: Folder | null = null;
        if (request.collectionId) {
          testCollection = collections.find((c) => c._id === request.collectionId) || null;
          if (testCollection && request.folderId) {
            const findFolder = (folders: Folder[]): Folder | null => {
              for (const f of folders) {
                if (f._id === request.folderId) return f;
                const nested = findFolder(f.folders);
                if (nested) return nested;
              }
              return null;
            };
            testFolder = findFolder(testCollection.folders);
          }
        }
        const { testScript: combinedTest } = getEffectiveScripts(testCollection, testFolder, request);
        if (combinedTest) {
          const scriptLogs = executeScript(combinedTest, { request, response: response.data });
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
      setVisualizerHtml(null);

      try {
        const built = await buildRequestPayload(currentRequest);

        if (mode === 'download') {
          await executeDownloadRequest(built);
        } else {
          await executeViewRequest(built);
        }

        try {
          addToHistory(built.request);
        } catch (historyError) {
          console.error('addToHistory failed', historyError);
        }
      } catch (error) {
        console.error('runSendFlow error', error, (error as Error)?.stack);
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
          onCookieOpen={() => setShowCookieManager(true)}
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

        <div
          id="workspace-split-container"
          className={cn('flex-1 overflow-hidden relative', (isDragging || isDraggingVertical) && 'select-none')}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            if (isDragging) {
              const pct = ((e.clientX - rect.left) / rect.width) * 100;
              setSplitPosition(Math.max(20, Math.min(80, pct)));
            }
            if (isDraggingVertical) {
              const pct = ((e.clientY - rect.top) / rect.height) * 100;
              setVerticalSplitPosition(Math.max(20, Math.min(80, pct)));
            }
          }}
          onMouseUp={() => {
            setIsDragging(false);
            setIsDraggingVertical(false);
          }}
          onMouseLeave={() => {
            // Don't clear on leave when actively dragging (window handler will handle mouseup)
            // Only clear if not dragging to avoid stuck state
            if (!isDragging && !isDraggingVertical) {
              setIsDragging(false);
              setIsDraggingVertical(false);
            }
          }}
        >
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
                className="absolute top-0 bottom-0 w-1 bg-[#3d3d3d] hover:bg-[#ff6b35] cursor-col-resize z-10 focus-visible:bg-[#ff6b35] focus:outline-none active:bg-[#ff6b35]"
                style={{ left: `${splitPosition}%` }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
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
                    visualizerHtml={visualizerHtml}
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
                className="absolute left-0 right-0 h-1 bg-[#3d3d3d] hover:bg-[#ff6b35] cursor-row-resize z-10 focus-visible:bg-[#ff6b35] focus:outline-none active:bg-[#ff6b35]"
                style={{ top: `${verticalSplitPosition}%` }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setIsDraggingVertical(true);
                }}
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
                    visualizerHtml={visualizerHtml}
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
          onTrashOpen={() => setShowTrash(true)}
          onMocksOpen={() => setShowMocks(true)}
          onMonitorsOpen={() => setShowMonitors(true)}
          onVaultOpen={() => setShowVault(true)}
          onAuditOpen={() => setShowAudit(true)}
          onPublishOpen={() => setShowPublish(true)}
          onCookieOpen={() => setShowCookieManager(true)}
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

      <CookieManager
        isOpen={showCookieManager}
        onClose={() => setShowCookieManager(false)}
      />

      <TrashModal
        isOpen={showTrash}
        onClose={() => setShowTrash(false)}
      />

      <MockManager
        isOpen={showMocks}
        onClose={() => setShowMocks(false)}
      />

      <MonitorManager
        isOpen={showMonitors}
        onClose={() => setShowMonitors(false)}
      />

      <VaultManager
        isOpen={showVault}
        onClose={() => setShowVault(false)}
      />

      <AuditViewer
        isOpen={showAudit}
        onClose={() => setShowAudit(false)}
      />

      <PublishManager
        isOpen={showPublish}
        onClose={() => setShowPublish(false)}
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
