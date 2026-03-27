'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { RequestBuilder } from '@/components/request/RequestBuilder';
import { ResponseViewer } from '@/components/response/ResponseViewer';
import { TeamManagement } from '@/components/team';
import { GlobalSearch, SearchShortcut } from '@/components/search';
import { WebSocketRequest } from '@/components/websocket';
import { SyncStatus } from '@/components/sync/SyncStatus';
import { TopBar } from '@/components/layout/TopBar';
import { RequestTabs } from '@/components/layout/RequestTabs';
import { BottomBar } from '@/components/layout/BottomBar';
import { HelpModal } from '@/components/layout/HelpModal';
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
  request: ApiRequest;
}

export default function WorkspacePage() {
  const [tabs, setTabs] = useState<RequestTab[]>([]);
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

  const currentTab = tabs.find(t => t.id === activeTabId);
  const currentRequest = currentTab?.request || null;

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
    const newTab: RequestTab = {
      id: uuidv4(),
      request: newReq,
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setResponse(null);
    setConsoleLogs([]);
    setTestResults([]);
    setActivePanel('http');
  }, [user, currentWorkspace, createNewRequest]);

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
    const existingTab = tabs.find(t => t.request._id === request._id);
    if (existingTab) {
      setActiveTabId(existingTab.id);
    } else {
      const newTab: RequestTab = {
        id: uuidv4(),
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

  const handleRequestChange = useCallback((updatedRequest: ApiRequest) => {
    setTabs(prev => prev.map(t => 
      t.id === activeTabId 
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
        }}
        onSelectFolder={(collection, folder) => {
          setSelectedCollection(collection);
          setSelectedFolder(folder);
        }}
        onSelectEnvironment={(environment) => {
          setSelectedEnvironment(environment);
          setShowGlobals(false);
        }}
        onSelectGlobals={() => {
          setSelectedEnvironment(null);
          setShowGlobals(true);
        }}
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

        <div className={cn(
          "flex-1 overflow-hidden",
          layout === 'horizontal' ? "grid grid-cols-2" : "flex flex-col"
        )}>
          {layout === 'horizontal' ? (
            <>
              <div className="border-r border-[#3d3d3d] overflow-y-auto">
                {activePanel === 'http' ? (
                  <RequestBuilder
                    request={currentRequest}
                    onRequestChange={handleRequestChange}
                    onSend={handleSendRequest}
                    isLoading={isLoading}
                  />
                ) : (
                  <WebSocketRequest />
                )}
              </div>
              <div className="overflow-y-auto">
                {activePanel === 'http' ? (
                  <ResponseViewer
                    response={response}
                    isLoading={isLoading}
                    consoleLogs={consoleLogs}
                    testResults={testResults}
                  />
                ) : (
                  <WebSocketRequest />
                )}
              </div>
            </>
          ) : (
            <>
              <div className="h-1/2 border-b border-[#3d3d3d] overflow-y-auto">
                {activePanel === 'http' ? (
                  <RequestBuilder
                    request={currentRequest}
                    onRequestChange={handleRequestChange}
                    onSend={handleSendRequest}
                    isLoading={isLoading}
                  />
                ) : (
                  <WebSocketRequest />
                )}
              </div>
              <div className="h-1/2 overflow-y-auto">
                {activePanel === 'http' ? (
                  <ResponseViewer
                    response={response}
                    isLoading={isLoading}
                    consoleLogs={consoleLogs}
                    testResults={testResults}
                  />
                ) : (
                  <WebSocketRequest />
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
    </div>
  );
}
