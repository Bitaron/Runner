'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { RequestBuilder } from '@/components/request/RequestBuilder';
import { ResponseViewer } from '@/components/response/ResponseViewer';
import { TeamManagement } from '@/components/team';
import { GlobalSearch, SearchShortcut } from '@/components/search';
import { WebSocketRequest } from '@/components/websocket';
import { SyncStatus } from '@/components/sync/SyncStatus';
import { useCollectionsStore } from '@/stores/collectionsStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/api';
import { syncManager } from '@/lib/syncManager';
import type { ApiRequest, Collection, Response, Workspace } from '@apiforge/shared';
import { v4 as uuidv4 } from 'uuid';
import { User, LogOut, Plus, Users, Search, Wifi, X } from 'lucide-react';

export default function WorkspacePage() {
  const [currentRequest, setCurrentRequest] = useState<ApiRequest | null>(null);
  const [response, setResponse] = useState<Response | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const [testResults, setTestResults] = useState<Array<{ name: string; passed: boolean; error?: string }>>([]);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showWebSocket, setShowWebSocket] = useState(false);
  const [activePanel, setActivePanel] = useState<'http' | 'websocket'>('http');

  const { collections, addCollection, addRequest, updateRequest, addToHistory, createNewRequest } = useCollectionsStore();
  const { currentWorkspace, workspaces, setWorkspaces, setCurrentWorkspace } = useWorkspaceStore();
  const { user, tokens, isAnonymous, logout } = useAuthStore();

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

  const handleSelectRequest = useCallback((request: ApiRequest, collectionId?: string) => {
    setCurrentRequest(request);
    setResponse(null);
    setConsoleLogs([]);
    setTestResults([]);
    setActivePanel('http');
  }, []);

  const handleSelectHistory = useCallback((request: ApiRequest) => {
    setCurrentRequest(request);
    setResponse(null);
    setConsoleLogs([]);
    setTestResults([]);
    setActivePanel('http');
  }, []);

  const handleRequestChange = useCallback((updatedRequest: ApiRequest) => {
    setCurrentRequest(updatedRequest);
    
    if (updatedRequest.collectionId) {
      updateRequest(updatedRequest._id, updatedRequest);
    }
  }, [updateRequest]);

  const handleNewRequest = useCallback(() => {
    const userId = user?._id || 'anonymous';
    const workspaceId = currentWorkspace?._id || 'default';
    const newReq = createNewRequest(workspaceId, userId);
    setCurrentRequest(newReq);
    setResponse(null);
    setConsoleLogs([]);
    setTestResults([]);
    setActivePanel('http');
  }, [user, currentWorkspace, createNewRequest]);

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
        className="w-72 flex-shrink-0"
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-[#1e1e1e] border-b border-[#3d3d3d]">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-white">APIForge</h1>
            {currentWorkspace && (
              <span className="text-sm text-gray-400">{currentWorkspace.name}</span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSearch(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 bg-[#2d2d2d] rounded hover:bg-[#3d3d3d] transition-colors"
            >
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden sm:inline px-1.5 py-0.5 text-xs bg-[#3d3d3d] rounded">⌘K</kbd>
            </button>
            
            <button
              onClick={() => setShowTeamModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-[#3d3d3d] rounded transition-colors"
            >
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Team</span>
            </button>

            <button
              onClick={() => setActivePanel(activePanel === 'http' ? 'websocket' : 'http')}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded transition-colors ${
                activePanel === 'websocket' 
                  ? 'bg-[#ff6b35] text-white' 
                  : 'text-gray-400 hover:text-white hover:bg-[#3d3d3d]'
              }`}
            >
              <Wifi className="w-4 h-4" />
              <span className="hidden sm:inline">WebSocket</span>
            </button>

            {!isAnonymous && <SyncStatus />}

            {isAnonymous && (
              <span className="text-xs text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded">
                Guest Mode
              </span>
            )}
            
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">{user?.name || 'User'}</span>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-white transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
            
            <button
              onClick={handleNewRequest}
              className="px-3 py-1.5 text-sm bg-[#ff6b35] text-white rounded hover:bg-[#e55a2b] transition-colors flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Request</span>
            </button>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-2 overflow-hidden">
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
        </div>
      </div>

      <TeamManagement
        isOpen={showTeamModal}
        onClose={() => setShowTeamModal(false)}
      />

      <GlobalSearch
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
        onSelectRequest={handleSelectRequest}
      />
    </div>
  );
}
