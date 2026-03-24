'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Sidebar } from '@/components/sidebar/Sidebar';
import { RequestBuilder } from '@/components/request/RequestBuilder';
import { ResponseViewer } from '@/components/response/ResponseViewer';
import { useCollectionsStore } from '@/stores/collectionsStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/api';
import type { ApiRequest, Collection, Response } from '@apiforge/shared';
import { v4 as uuidv4 } from 'uuid';

export default function WorkspacePage() {
  const [currentRequest, setCurrentRequest] = useState<ApiRequest | null>(null);
  const [response, setResponse] = useState<Response | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const [testResults, setTestResults] = useState<Array<{ name: string; passed: boolean; error?: string }>>([]);

  const { collections, addCollection, addRequest, updateRequest, addToHistory, createNewRequest } = useCollectionsStore();
  const { currentWorkspace } = useWorkspaceStore();
  const { user, isAnonymous } = useAuthStore();

  const handleSelectRequest = useCallback((request: ApiRequest, collectionId?: string, folderId?: string) => {
    setCurrentRequest(request);
    setResponse(null);
    setConsoleLogs([]);
    setTestResults([]);
  }, []);

  const handleSelectHistory = useCallback((request: ApiRequest) => {
    setCurrentRequest(request);
    setResponse(null);
    setConsoleLogs([]);
    setTestResults([]);
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

  return (
    <div className="flex h-screen overflow-hidden">
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
            {isAnonymous && (
              <span className="text-xs text-yellow-500 bg-yellow-500/10 px-2 py-1 rounded">
                Anonymous Mode
              </span>
            )}
            <button
              onClick={handleNewRequest}
              className="px-3 py-1.5 text-sm bg-[#ff6b35] text-white rounded hover:bg-[#e55a2b] transition-colors"
            >
              + New Request
            </button>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-2 overflow-hidden">
          <div className="border-r border-[#3d3d3d] overflow-y-auto">
            <RequestBuilder
              request={currentRequest}
              onRequestChange={handleRequestChange}
              onSend={handleSendRequest}
              isLoading={isLoading}
            />
          </div>

          <div className="overflow-y-auto">
            <ResponseViewer
              response={response}
              isLoading={isLoading}
              consoleLogs={consoleLogs}
              testResults={testResults}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
