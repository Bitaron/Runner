import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { URL } from 'url';

interface ProxyClient extends WebSocket {
  targetWs?: WebSocket;
  isAlive: boolean;
}

let proxyWss: WebSocketServer | null = null;

export const initWsProxy = (server: HttpServer): void => {
  proxyWss = new WebSocketServer({ server, path: '/ws-proxy' });

  proxyWss.on('connection', (clientWs: ProxyClient, req) => {
    clientWs.isAlive = true;
    clientWs.on('pong', () => { clientWs.isAlive = true; });

    // Also support target via query param for direct connect (fallback)
    let queryTarget: string | null = null;
    let queryProtocols: string[] | undefined;
    let queryHeaders: Record<string, string> | undefined;
    try {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      queryTarget = url.searchParams.get('target');
      const proto = url.searchParams.get('protocols');
      if (proto) queryProtocols = proto.split(',').map(p => p.trim()).filter(Boolean);
      const hdr = url.searchParams.get('headers');
      if (hdr) {
        try { queryHeaders = JSON.parse(Buffer.from(hdr, 'base64').toString('utf8')); } catch {}
      }
    } catch {}

    let connected = false;
    const connectToTarget = (target: string, protocols?: string[], headers?: Record<string, string>) => {
      if (connected) return;
      connected = true;
      try {
        const parsed = new URL(target);
        if (!['ws:', 'wss:'].includes(parsed.protocol)) {
          clientWs.send(JSON.stringify({ type: 'error', error: 'Target must be ws:// or wss://' }));
          clientWs.close(1008, 'Invalid target');
          return;
        }
      } catch {
        clientWs.send(JSON.stringify({ type: 'error', error: 'Invalid target URL' }));
        clientWs.close(1008, 'Invalid target');
        return;
      }

      const cleanHeaders: Record<string, string> = {};
      if (headers) {
        for (const [k, v] of Object.entries(headers)) {
          if (!k || !v) continue;
          const lower = k.toLowerCase();
          // block hop-by-hop and forbidden headers
          if (['host','connection','upgrade','sec-websocket-key','sec-websocket-version','sec-websocket-extensions'].includes(lower)) continue;
          cleanHeaders[k] = String(v);
        }
      }

      const targetWs = new WebSocket(target, protocols, { headers: cleanHeaders }) as WebSocket;
      (clientWs as ProxyClient).targetWs = targetWs;

      const sendToClient = (data: unknown) => {
        if (clientWs.readyState === WebSocket.OPEN) clientWs.send(typeof data === 'string' ? data : JSON.stringify(data));
      };

      targetWs.on('open', () => {
        sendToClient(JSON.stringify({ type: 'open', target }));
      });
      targetWs.on('message', (data) => {
        // relay raw data
        const msg = typeof data === 'string' ? data : data.toString();
        // try to keep as string; wrap as {type:'message', data:msg}
        if (clientWs.readyState === WebSocket.OPEN) clientWs.send(msg);
      });
      targetWs.on('close', (code, reason) => {
        sendToClient(JSON.stringify({ type: 'close', code, reason: reason.toString() }));
        if (clientWs.readyState === WebSocket.OPEN) clientWs.close(code, reason.toString());
      });
      targetWs.on('error', (err) => {
        sendToClient(JSON.stringify({ type: 'error', error: err.message }));
      });

      clientWs.on('message', (data) => {
        const str = data.toString();
        // If client sends JSON with type 'close', handle; otherwise forward raw
        try {
          const parsed = JSON.parse(str);
          if (parsed && parsed.type === 'close') {
            targetWs.close(parsed.code || 1000, parsed.reason);
            return;
          }
          if (parsed && parsed.type === 'ping') {
            if (targetWs.readyState === WebSocket.OPEN) targetWs.ping();
            return;
          }
        } catch {}
        if (targetWs.readyState === WebSocket.OPEN) targetWs.send(str);
      });

      clientWs.on('close', () => {
        if (targetWs.readyState === WebSocket.OPEN || targetWs.readyState === WebSocket.CONNECTING) targetWs.close();
      });
      clientWs.on('error', () => {
        if (targetWs.readyState === WebSocket.OPEN) targetWs.close();
      });
      targetWs.on('close', () => {
        if (clientWs.readyState === WebSocket.OPEN) clientWs.close();
      });
    };

    // If queryTarget provided, connect immediately
    if (queryTarget) {
      connectToTarget(queryTarget, queryProtocols, queryHeaders);
    }

    clientWs.on('message', (data) => {
      if (connected) return; // already connected, handler above will have been set; but this listener still fires for first message
      const str = data.toString();
      try {
        const msg = JSON.parse(str);
        if (msg.type === 'connect' && msg.target) {
          connectToTarget(msg.target, msg.protocols, msg.headers);
        }
      } catch {
        // if not json and we are not connected via query, treat as target URL directly?
        if (!connected && (str.startsWith('ws://') || str.startsWith('wss://'))) {
          connectToTarget(str);
        }
      }
    });

    // timeout if no connect within 10s
    setTimeout(() => {
      if (!connected) {
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify({ type: 'error', error: 'No target specified. Send {type:"connect", target:"wss://..."}' }));
          // don't close immediately, allow client to retry
        }
      }
    }, 10000);
  });

  const interval = setInterval(() => {
    proxyWss?.clients.forEach((ws) => {
      const ext = ws as ProxyClient;
      if (!ext.isAlive) return ext.terminate();
      ext.isAlive = false;
      ext.ping();
    });
  }, 30000);

  proxyWss.on('close', () => clearInterval(interval));

  console.log('WebSocket proxy server started on /ws-proxy');
};

export const getProxyWss = () => proxyWss;
