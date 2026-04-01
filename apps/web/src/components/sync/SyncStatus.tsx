'use client';

import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, Users, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { syncManager, type SyncEvent } from '@/lib/syncManager';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface SyncNotification {
  id: string;
  message: string;
  timestamp: number;
}

export const SyncStatus: React.FC = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [isSynced, setIsSynced] = useState(false);
  const [notifications, setNotifications] = useState<SyncNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    // Check initial online status
    setIsOnline(navigator.onLine);

    // Listen for browser online/offline events
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check WebSocket sync status
    setIsSynced(syncManager.isConnected);

    // Poll for WebSocket status
    const interval = setInterval(() => {
      setIsSynced(syncManager.isConnected);
    }, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const handleEvent = (event: SyncEvent) => {
      const entityName = event.entityType === 'collection' ? 'Collection' :
                         event.entityType === 'request' ? 'Request' :
                         event.entityType === 'folder' ? 'Folder' :
                         event.entityType === 'environment' ? 'Environment' : 'Item';
      
      const action = event.type === 'create' ? 'created' :
                     event.type === 'update' ? 'updated' : 'deleted';
      
      const notification: SyncNotification = {
        id: `${event.entityId}-${event.timestamp}`,
        message: `${entityName} ${action}`,
        timestamp: event.timestamp || Date.now(),
      };

      setNotifications((prev) => [notification, ...prev.slice(0, 4)]);
    };

    const unsubscribe = syncManager.onEvent(handleEvent);

    return () => {
      unsubscribe();
    };
  }, []);

  const isConnected = isOnline && isSynced;

  return (
    <div className="relative">
      <button
        onClick={() => setShowNotifications(!showNotifications)}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors',
          isConnected
            ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
            : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
        )}
      >
        {isOnline ? (
          isSynced ? (
            <>
              <Wifi className="w-3.5 h-3.5" />
              <span>Synced</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5" />
              <span>Connecting...</span>
            </>
          )
        ) : (
          <>
            <WifiOff className="w-3.5 h-3.5" />
            <span>Offline</span>
          </>
        )}
      </button>

      {showNotifications && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-[#2d2d2e] border border-[#3d3d3d] rounded-lg shadow-xl z-50">
          <div className="flex items-center justify-between p-2 border-b border-[#3d3d3d]">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Users className="w-3.5 h-3.5" />
              <span>Team Updates</span>
            </div>
            <button
              onClick={() => setShowNotifications(false)}
              className="p-1 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-3 py-4 text-center text-gray-500 text-sm">
                No updates yet
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[#3d3d3e]"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-gray-300">{notification.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Toast notification system
let toastId = 0;
const toastListeners: Set<(toast: Toast) => void> = new Set();

export const toast = {
  success: (message: string) => {
    const newToast: Toast = { id: `toast-${++toastId}`, type: 'success', message };
    toastListeners.forEach(listener => listener(newToast));
  },
  error: (message: string) => {
    const newToast: Toast = { id: `toast-${++toastId}`, type: 'error', message };
    toastListeners.forEach(listener => listener(newToast));
  },
  info: (message: string) => {
    const newToast: Toast = { id: `toast-${++toastId}`, type: 'info', message };
    toastListeners.forEach(listener => listener(newToast));
  },
};

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const listener = (toast: Toast) => {
      setToasts(prev => [...prev.slice(-2), toast]);
      
      // Auto dismiss after 5 seconds
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toast.id));
      }, 5000);
    };

    toastListeners.add(listener);
    return () => {
      toastListeners.delete(listener);
    };
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl min-w-[300px] animate-slide-in',
            t.type === 'success' && 'bg-green-500/90 text-white',
            t.type === 'error' && 'bg-red-500/90 text-white',
            t.type === 'info' && 'bg-blue-500/90 text-white'
          )}
        >
          <span className="flex-1">{t.message}</span>
          <button
            onClick={() => removeToast(t.id)}
            className="p-1 hover:bg-white/20 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      <style jsx>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};