'use client';

import type { Collection, ApiRequest, Folder, Environment, Workspace } from '@apiforge/shared';

export type EntityType = 'collection' | 'request' | 'folder' | 'environment' | 'workspace';
export type EventType = 'create' | 'update' | 'delete';

export interface SyncEvent {
  type: EventType;
  entityType: EntityType;
  entityId: string;
  data?: unknown;
  userId: string;
  timestamp: number;
  workspaceId: string;
}

type EventHandler = (event: SyncEvent) => void;

const BASE_RECONNECT_DELAY = 5000;
const MAX_RECONNECT_DELAY = 30000;

class SyncManager {
  private ws: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectBaseDelay = BASE_RECONNECT_DELAY;
  private reconnectMaxDelay = MAX_RECONNECT_DELAY;
  private refCount = 0;
  private handlers: Set<EventHandler> = new Set();
  private _isConnected = false;
  private _userId: string | null = null;
  private _workspaceId: string | null = null;
  private _wsUrl: string | null = null;
  private _token: string | null = null;

  get isConnected(): boolean {
    return this._isConnected;
  }

  connect(wsUrl: string, token: string, userId: string, workspaceId: string): void {
    this.refCount++;
    this._userId = userId;
    this._wsUrl = wsUrl;
    this._token = token;

    if (this.ws && this.ws.readyState !== WebSocket.CLOSED) {
      const workspaceChanged = this._workspaceId !== workspaceId;
      this._workspaceId = workspaceId;
      if (workspaceChanged && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'subscribe', workspaceId }));
      }
      return;
    }

    this._workspaceId = workspaceId;

    this.openSocket();
  }

  private openSocket(): void {
    if (!this._wsUrl) return;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.ws = new WebSocket(this._wsUrl);

    this.ws.onopen = () => {
      console.log('SyncManager: WebSocket connected');
      this._isConnected = true;
      this.reconnectAttempts = 0;

      this.ws?.send(JSON.stringify({ type: 'auth', token: this._token }));
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'auth_success') {
          console.log('SyncManager: Authenticated');
          this.ws?.send(JSON.stringify({ type: 'subscribe', workspaceId: this._workspaceId }));
        } else if (message.type === 'event') {
          const syncEvent = message as SyncEvent;
          if (syncEvent.userId !== this._userId) {
            this.handlers.forEach((handler) => handler(syncEvent));
          }
        } else if (message.type === 'subscribed') {
          console.log('SyncManager: Subscribed to workspace');
        }
      } catch (error) {
        console.error('SyncManager: Failed to parse message', error);
      }
    };

    this.ws.onclose = () => {
      console.log('SyncManager: WebSocket disconnected');
      this._isConnected = false;
      if (this.refCount > 0) {
        this.attemptReconnect();
      }
    };

    this.ws.onerror = (error) => {
      console.error('SyncManager: WebSocket error', error);
    };
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts || !this._userId || !this._wsUrl || !this._token) {
      console.log('SyncManager: Max reconnect attempts reached or missing credentials');
      return;
    }

    const delay = Math.min(
      this.reconnectBaseDelay * 2 ** this.reconnectAttempts + Math.random() * this.reconnectBaseDelay,
      this.reconnectMaxDelay
    );

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.reconnectAttempts++;
      console.log(`SyncManager: Reconnecting (attempt ${this.reconnectAttempts})`);
      this.openSocket();
    }, delay);
  }

  disconnect(): void {
    this.refCount = Math.max(0, this.refCount - 1);
    if (this.refCount > 0) return;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      const ws = this.ws;
      this.ws = null;
      ws.onclose = null;
      ws.close();
    }
    this._isConnected = false;
  }

  sendEvent(event: Omit<SyncEvent, 'userId' | 'timestamp'>): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.warn('SyncManager: WebSocket not connected');
      return;
    }

    const fullEvent: SyncEvent = {
      ...event,
      userId: this._userId || '',
      timestamp: Date.now(),
    };

    this.ws.send(JSON.stringify({
      type: 'broadcast',
      workspaceId: event.workspaceId,
      event: fullEvent,
    }));
  }

  onEvent(handler: EventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  emitCollectionEvent(type: EventType, collection: Collection): void {
    this.sendEvent({
      type,
      entityType: 'collection',
      entityId: collection._id,
      data: collection,
      workspaceId: collection.workspaceId,
    });
  }

  emitRequestEvent(type: EventType, request: ApiRequest, workspaceId: string): void {
    this.sendEvent({
      type,
      entityType: 'request',
      entityId: request._id,
      data: request,
      workspaceId,
    });
  }

  emitFolderEvent(type: EventType, folder: Folder, collection: Collection): void {
    this.sendEvent({
      type,
      entityType: 'folder',
      entityId: folder._id,
      data: { folder, collectionId: collection._id },
      workspaceId: collection.workspaceId,
    });
  }

  emitEnvironmentEvent(type: EventType, environment: Environment, workspaceId: string): void {
    this.sendEvent({
      type,
      entityType: 'environment',
      entityId: environment._id,
      data: environment,
      workspaceId,
    });
  }

  emitWorkspaceEvent(type: EventType, workspace: Workspace): void {
    this.sendEvent({
      type,
      entityType: 'workspace',
      entityId: workspace._id,
      data: workspace,
      workspaceId: workspace._id,
    });
  }
}

export const syncManager = new SyncManager();
