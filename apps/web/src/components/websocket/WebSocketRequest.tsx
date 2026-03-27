'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Tabs, TabPanel } from '@/components/ui/Tabs';
import { KeyValueEditor } from '@/components/ui/KeyValueEditor';
import { Send, Wifi, WifiOff, Trash2, Clock, Loader2 } from 'lucide-react';
import type { KeyValue } from '@apiforge/shared';

interface WebSocketMessage {
  type: 'sent' | 'received' | 'message' | 'ping' | 'pong' | 'close';
  data?: string;
  timestamp: number;
}

interface WebSocketRequestProps {
  initialUrl?: string;
  onClose?: () => void;
}

interface LogEntry {
  id: string;
  type: 'sent' | 'received' | 'info' | 'error';
  message: string;
  timestamp: Date;
  data?: unknown;
}

export const WebSocketRequest: React.FC<WebSocketRequestProps> = ({ initialUrl = '', onClose }) => {
  const [url, setUrl] = useState(initialUrl);
  const [protocols, setProtocols] = useState('');
  const [headers, setHeaders] = useState<KeyValue[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [activeTab, setActiveTab] = useState('messages');
  
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((type: LogEntry['type'], message: string, data?: unknown) => {
    setLogs((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        type,
        message,
        timestamp: new Date(),
        data,
      },
    ]);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, logs, scrollToBottom]);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const connect = useCallback(() => {
    if (!url.trim()) {
      addLog('error', 'URL is required');
      return;
    }

    setIsConnecting(true);
    addLog('info', `Connecting to ${url}...`);

    try {
      const wsProtocols = protocols.trim() ? protocols.split(',').map((p) => p.trim()) : undefined;
      const ws = new WebSocket(url, wsProtocols);

      ws.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        addLog('info', 'Connection established');
      };

      ws.onmessage = (event) => {
        let data = event.data;
        try {
          data = JSON.parse(event.data);
        } catch {
          // Keep as string
        }

        const message: WebSocketMessage = {
          type: 'message',
          data: typeof data === 'string' ? data : JSON.stringify(data),
          timestamp: Date.now(),
        };
        
        setMessages((prev) => [...prev, message]);
        addLog('received', typeof data === 'string' ? data : JSON.stringify(data, null, 2), data);
      };

      ws.onerror = (error) => {
        addLog('error', 'WebSocket error occurred');
        console.error('WebSocket error:', error);
      };

      ws.onclose = (event) => {
        setIsConnected(false);
        setIsConnecting(false);
        addLog('info', `Connection closed (code: ${event.code})`);
      };

      wsRef.current = ws;
    } catch (error) {
      setIsConnecting(false);
      addLog('error', `Failed to connect: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [url, protocols, addLog]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const sendMessage = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      addLog('error', 'Not connected');
      return;
    }

    if (!messageInput.trim()) return;

    wsRef.current.send(messageInput);
    
    const message: WebSocketMessage = {
      type: 'message',
      data: messageInput,
      timestamp: Date.now(),
    };
    
    setMessages((prev) => [...prev, message]);
    addLog('sent', messageInput);
    setMessageInput('');
  }, [messageInput, addLog]);

  const clearMessages = () => {
    setMessages([]);
    setLogs([]);
  };

  const getLogIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'sent':
        return <Send className="w-4 h-4 text-[#49cc90]" />;
      case 'received':
        return <Wifi className="w-4 h-4 text-[#61affe]" />;
      case 'error':
        return <WifiOff className="w-4 h-4 text-red-500" />;
      case 'info':
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const tabs = [
    { id: 'messages', label: 'Messages' },
    { id: 'headers', label: 'Headers' },
    { id: 'logs', label: 'Logs' },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-3 border-b border-[#3d3d3d]">
        <div className={cn(
          'w-3 h-3 rounded-full',
          isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-500'
        )} />
        
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="wss://echo.websocket.org"
          className="flex-1 font-mono text-sm"
          disabled={isConnected}
        />
        
        {isConnected ? (
          <Button variant="danger" onClick={disconnect}>
            Disconnect
          </Button>
        ) : (
          <Button onClick={connect} disabled={isConnecting}>
            {isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
                Connecting
              </>
            ) : (
              <>
                <Wifi className="w-4 h-4 mr-1" />
                Connect
              </>
            )}
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2 px-3 py-2 bg-[#252526] border-b border-[#3d3d3d]">
        <Input
          value={protocols}
          onChange={(e) => setProtocols(e.target.value)}
          placeholder="Protocols (comma separated)"
          className="flex-1 text-sm"
          disabled={isConnected}
        />
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <div className="flex-1 overflow-hidden">
        {activeTab === 'messages' && (
          <TabPanel className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {messages.length === 0 ? (
                <p className="text-center text-gray-500 py-8">
                  No messages yet. Connect and send a message to see it here.
                </p>
              ) : (
                messages.map((msg, index) => (
                  <div
                    key={index}
                    className={cn(
                      'p-3 rounded-lg font-mono text-sm',
                      msg.type === 'sent' ? 'bg-[#49cc90]/10 ml-8' : 'bg-[#61affe]/10 mr-8'
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn(
                        'text-xs font-medium',
                        msg.type === 'sent' ? 'text-[#49cc90]' : 'text-[#61affe]'
                      )}>
                        {msg.type === 'sent' ? 'SENT' : 'RECEIVED'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <pre className="whitespace-pre-wrap break-all text-gray-200">
                      {typeof msg.data === 'string' ? msg.data : JSON.stringify(msg.data, null, 2)}
                    </pre>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-3 border-t border-[#3d3d3d] flex gap-2">
              <textarea
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Type a message..."
                className="flex-1 px-3 py-2 bg-[#2d2d2d] border border-[#3d3d3d] rounded-md font-mono text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[#ff6b35] resize-none"
                rows={2}
                disabled={!isConnected}
              />
              <Button
                onClick={sendMessage}
                disabled={!isConnected || !messageInput.trim()}
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </TabPanel>
        )}

        {activeTab === 'headers' && (
          <TabPanel>
            <KeyValueEditor
              items={headers}
              onChange={setHeaders}
              keyPlaceholder="Header Name"
              valuePlaceholder="Header Value"
              showDescription={false}
            />
          </TabPanel>
        )}

        {activeTab === 'logs' && (
          <TabPanel className="h-full overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No logs yet</p>
            ) : (
              <div className="space-y-1">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-2 p-2 hover:bg-[#2d2d2d] rounded"
                  >
                    {getLogIcon(log.type)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'text-xs font-medium',
                          log.type === 'sent' && 'text-[#49cc90]',
                          log.type === 'received' && 'text-[#61affe]',
                          log.type === 'error' && 'text-red-500',
                          log.type === 'info' && 'text-gray-400',
                        )}>
                          {log.type.toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-500">
                          {log.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-300 font-mono truncate">{log.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabPanel>
        )}
      </div>

      <div className="flex items-center justify-between px-3 py-2 border-t border-[#3d3d3d]">
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>{messages.length} messages</span>
          <span>{logs.filter((l) => l.type === 'error').length} errors</span>
        </div>
        <Button variant="ghost" size="sm" onClick={clearMessages}>
          <Trash2 className="w-4 h-4 mr-1" />
          Clear
        </Button>
      </div>
    </div>
  );
};
