'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useCollectionsStore } from '@/stores/collectionsStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

interface SyncEvent {
  type: 'create' | 'update' | 'delete';
  entityType: 'collection' | 'request' | 'folder' | 'environment' | 'workspace';
  entityId: string;
  data?: unknown;
  userId: string;
  timestamp: number;
  workspaceId: string;
}

export const useWebSocket = () => {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { tokens, user } = useAuthStore();
  const { setCollections, addCollection, updateCollection, removeCollection } = useCollectionsStore();
  const { setCurrentWorkspace } = useWorkspaceStore();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000/ws';
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');
      
      // Authenticate
      if (tokens?.accessToken) {
        ws.send(JSON.stringify({
          type: 'auth',
          token: tokens.accessToken,
        }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        switch (message.type) {
          case 'auth_success':
            console.log('WebSocket authenticated');
            // Subscribe to current workspace
            const currentWorkspace = useWorkspaceStore.getState().currentWorkspace;
            if (currentWorkspace) {
              ws.send(JSON.stringify({
                type: 'subscribe',
                workspaceId: currentWorkspace._id,
              }));
            }
            break;

          case 'event':
            handleSyncEvent(message as SyncEvent);
            break;

          case 'subscribed':
            console.log('Subscribed to workspace:', message.workspaceId);
            break;

          case 'error':
            console.error('WebSocket error:', message.error);
            break;

          case 'pong':
            // Heartbeat response
            break;
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      wsRef.current = null;
      
      // Reconnect after 5 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        if (user) {
          connect();
        }
      }, 5000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    wsRef.current = ws;
  }, [tokens, user]);

  const handleSyncEvent = useCallback((event: SyncEvent) => {
    // Don't process our own events
    if (event.userId === user?._id) return;

    console.log('Received sync event:', event);

    switch (event.entityType) {
      case 'collection':
        if (event.type === 'create' && event.data) {
          addCollection(event.data as Parameters<typeof addCollection>[0]);
        } else if (event.type === 'update' && event.data) {
          updateCollection(event.entityId, event.data as Parameters<typeof updateCollection>[1]);
        } else if (event.type === 'delete') {
          removeCollection(event.entityId);
        }
        break;

      case 'workspace':
        if (event.type === 'update' && event.data) {
          setCurrentWorkspace(event.data as Parameters<typeof setCurrentWorkspace>[0]);
        }
        break;
    }
  }, [user, addCollection, updateCollection, removeCollection, setCurrentWorkspace]);

  const sendEvent = useCallback((event: Omit<SyncEvent, 'userId' | 'timestamp'>) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;

    wsRef.current.send(JSON.stringify({
      type: 'broadcast',
      workspaceId: event.workspaceId,
      event: {
        ...event,
        userId: user?._id,
        timestamp: Date.now(),
      },
    }));
  }, [user]);

  const subscribeToWorkspace = useCallback((workspaceId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'subscribe',
        workspaceId,
      }));
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (user && !tokens?.isAnonymous) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [user, tokens, connect, disconnect]);

  // Heartbeat
  useEffect(() => {
    const interval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return {
    connect,
    disconnect,
    sendEvent,
    subscribeToWorkspace,
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
  };
};

export default useWebSocket;
