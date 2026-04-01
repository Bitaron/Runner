import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { verifyAccessToken, TokenPayload } from '../utils/jwt';
import { getDb } from '../config/database';
import type { Workspace, Team } from '@apiforge/shared';

interface ExtendedWebSocket extends WebSocket {
  userId?: string;
  userPayload?: TokenPayload;
  subscribedWorkspaces: Set<string>;
  isAlive: boolean;
}

interface SyncEvent {
  type: 'create' | 'update' | 'delete';
  entityType: 'collection' | 'request' | 'folder' | 'environment' | 'workspace';
  entityId: string;
  data?: unknown;
  userId?: string;
  userName?: string;
  timestamp?: number;
  workspaceId?: string;
}

interface BroadcastMessage {
  type: 'event' | 'user_joined' | 'user_left' | 'create' | 'update' | 'delete';
  workspaceId?: string;
  userId?: string;
  userName?: string;
  [key: string]: unknown;
}

let wss: WebSocketServer;
const connectedClients: Map<string, ExtendedWebSocket> = new Map();

export const initSyncWebSocket = (server: HttpServer): void => {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: ExtendedWebSocket, req) => {
    ws.subscribedWorkspaces = new Set();
    ws.isAlive = true;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleMessage(ws, message);
      } catch (error) {
        ws.send(JSON.stringify({ type: 'error', error: 'Invalid message format' }));
      }
    });

    ws.on('close', () => {
      if (ws.userId) {
        connectedClients.delete(ws.userId);
        broadcastUserStatus(ws, 'left');
      }
      console.log('Client disconnected');
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const extWs = ws as ExtendedWebSocket;
      if (!extWs.isAlive) {
        return extWs.terminate();
      }
      extWs.isAlive = false;
      extWs.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });

  console.log('Sync WebSocket server started on /ws');
};

interface IncomingMessage {
  type: string;
  token?: string;
  workspaceId?: string;
  event?: Omit<SyncEvent, 'userId' | 'userName' | 'timestamp' | 'workspaceId'>;
}

const handleMessage = async (ws: ExtendedWebSocket, message: IncomingMessage): Promise<void> => {
  switch (message.type) {
    case 'auth':
      if (!message.token) {
        ws.send(JSON.stringify({ type: 'error', error: 'Token required' }));
        return;
      }
      try {
        const payload = verifyAccessToken(message.token);
        ws.userId = payload.userId;
        ws.userPayload = payload;
        connectedClients.set(payload.userId, ws);
        
        ws.send(JSON.stringify({ 
          type: 'auth_success', 
          userId: payload.userId,
          email: payload.email 
        }));
      } catch {
        ws.send(JSON.stringify({ type: 'error', error: 'Invalid token' }));
      }
      break;

    case 'subscribe':
      if (!message.workspaceId) {
        ws.send(JSON.stringify({ type: 'error', error: 'Workspace ID required' }));
        return;
      }
      ws.subscribedWorkspaces.add(message.workspaceId);
      broadcastUserStatus(ws, 'joined', message.workspaceId);
      ws.send(JSON.stringify({ 
        type: 'subscribed', 
        workspaceId: message.workspaceId 
      }));
      break;

    case 'unsubscribe':
      if (!message.workspaceId) {
        ws.send(JSON.stringify({ type: 'error', error: 'Workspace ID required' }));
        return;
      }
      ws.subscribedWorkspaces.delete(message.workspaceId);
      broadcastUserStatus(ws, 'left', message.workspaceId);
      ws.send(JSON.stringify({ 
        type: 'unsubscribed', 
        workspaceId: message.workspaceId 
      }));
      break;

    case 'broadcast':
      if (!message.event || !message.workspaceId) {
        ws.send(JSON.stringify({ type: 'error', error: 'Event and workspace ID required' }));
        return;
      }
      if (!ws.userId) {
        ws.send(JSON.stringify({ type: 'error', error: 'Not authenticated' }));
        return;
      }
      broadcastSyncEvent(ws.userId, message.workspaceId, {
        ...message.event,
        userId: ws.userId,
        timestamp: Date.now(),
      } as SyncEvent);
      break;

    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }));
      break;

    default:
      ws.send(JSON.stringify({ type: 'error', error: 'Unknown message type' }));
  }
};

const broadcastUserStatus = (ws: ExtendedWebSocket, status: 'joined' | 'left', workspaceId?: string): void => {
  if (!ws.userId || !workspaceId) return;

  const message: BroadcastMessage = {
    type: status === 'joined' ? 'user_joined' : 'user_left',
    workspaceId,
    userId: ws.userId,
    userName: ws.userPayload?.email?.split('@')[0] || 'User',
  };

  const messageStr = JSON.stringify(message);
  
  connectedClients.forEach((client) => {
    if (client !== ws && client.readyState === WebSocket.OPEN && client.subscribedWorkspaces.has(workspaceId)) {
      client.send(messageStr);
    }
  });
};

export const broadcastSyncEvent = async (
  senderId: string,
  workspaceId: string,
  event: SyncEvent
): Promise<void> => {
  const canAccess = await checkWorkspaceAccess(senderId, workspaceId);
  if (!canAccess) {
    console.warn(`User ${senderId} not authorized to broadcast to workspace ${workspaceId}`);
    return;
  }

  const message: BroadcastMessage = {
    ...event,
    type: 'event',
  } as BroadcastMessage;

  const messageStr = JSON.stringify(message);

  connectedClients.forEach((client) => {
    if (
      client.userId !== senderId &&
      client.readyState === WebSocket.OPEN &&
      client.subscribedWorkspaces.has(workspaceId)
    ) {
      client.send(messageStr);
    }
  });
};

const checkWorkspaceAccess = async (userId: string, workspaceId: string): Promise<boolean> => {
  try {
    const db = getDb();
    
    const workspaceResult = await db.view('app', 'by_type', {
      key: 'workspace',
      include_docs: true,
    });

    const workspaces = workspaceResult.rows
      .map((row) => row.doc as Workspace)
      .filter((w) => w._id === workspaceId);

    if (workspaces.length === 0) return false;

    const workspace = workspaces[0];
    
    if (workspace.ownerType === 'user' && workspace.ownerId === userId) {
      return true;
    }

    if (workspace.ownerType === 'team') {
      const teamResult = await db.view('app', 'by_type', {
        key: 'team',
        include_docs: true,
      });

      const teams = teamResult.rows
        .map((row) => row.doc as Team)
        .filter((t) => t._id === workspace.ownerId);

      if (teams.length === 0) return false;

      const team = teams[0];
      return team.ownerId === userId || team.members.some((m) => m.userId === userId);
    }

    return false;
  } catch (error) {
    console.error('Error checking workspace access:', error);
    return false;
  }
};

export const sendToUser = (userId: string, message: unknown): void => {
  const client = connectedClients.get(userId);
  if (client && client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(message));
  }
};

export const sendToWorkspace = (workspaceId: string, message: unknown): void => {
  const messageStr = JSON.stringify(message);
  
  connectedClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client.subscribedWorkspaces.has(workspaceId)) {
      client.send(messageStr);
    }
  });
};

export const getConnectedUsers = (workspaceId?: string): string[] => {
  const users: string[] = [];
  
  connectedClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      if (!workspaceId || client.subscribedWorkspaces.has(workspaceId)) {
        users.push(client.userId || 'unknown');
      }
    }
  });
  
  return users;
};
