'use client';

import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { syncManager, type SyncEvent } from '@/lib/syncManager';

interface SyncNotification {
  id: string;
  message: string;
  timestamp: number;
}

export const SyncStatus: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<SyncNotification[]>([]);

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
        timestamp: event.timestamp,
      };

      setNotifications((prev) => [notification, ...prev.slice(0, 4)]);
    };

    const unsubscribe = syncManager.onEvent(handleEvent);
    setIsConnected(syncManager.isConnected);

    const interval = setInterval(() => {
      setIsConnected(syncManager.isConnected);
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setNotifications((prev) => prev.slice(0, -1));
    }, 5000);

    return () => clearTimeout(timeout);
  }, [notifications]);

  return (
    <div className="relative">
      <button
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium transition-colors',
          isConnected
            ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
            : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
        )}
      >
        {isConnected ? (
          <>
            <Wifi className="w-3.5 h-3.5" />
            <span>Synced</span>
          </>
        ) : (
          <>
            <WifiOff className="w-3.5 h-3.5" />
            <span>Offline</span>
          </>
        )}
      </button>

      {notifications.length > 0 && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-[#2d2d2e] border border-[#3d3d3d] rounded-lg shadow-xl z-50">
          <div className="p-2 border-b border-[#3d3d3d]">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Users className="w-3.5 h-3.5" />
              <span>Team Updates</span>
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-[#3d3d3e]"
              >
                <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-gray-300">{notification.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
