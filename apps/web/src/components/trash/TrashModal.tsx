'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { apiClient } from '@/lib/api';
import { toast } from '@/components/sync/SyncStatus';
import { Trash2, RotateCcw, Clock, FileJson, Globe, Layers } from 'lucide-react';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useCollectionsStore } from '@/stores/collectionsStore';
import type { TrashItem } from '@apiforge/shared';

interface TrashModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TrashModal: React.FC<TrashModalProps> = ({ isOpen, onClose }) => {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(false);
  const { currentWorkspace } = useWorkspaceStore();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<TrashItem[]>('/api/trash', currentWorkspace ? { workspaceId: currentWorkspace._id } : undefined);
      if (res.success && res.data) setItems(res.data as TrashItem[]);
    } catch {}
    setLoading(false);
  }, [currentWorkspace]);

  useEffect(() => { if (isOpen) load(); }, [isOpen, load]);

  const handleRestore = async (item: TrashItem) => {
    try {
      const res = await apiClient.post(`/api/trash/${item._id}/restore`);
      if (res.success) {
        toast.success(`Restored ${item.type}`);
        // reload collections/environments
        if (currentWorkspace) {
          const [cols, envs] = await Promise.all([
            apiClient.get('/api/collections', { workspaceId: currentWorkspace._id }),
            apiClient.get('/api/environments', { workspaceId: currentWorkspace._id }),
          ]);
          if (cols.success && cols.data) useCollectionsStore.getState().setCollections(cols.data as unknown as import('@apiforge/shared').Collection[]);
          if (envs.success && envs.data) useWorkspaceStore.getState().setEnvironments(envs.data as unknown as import('@apiforge/shared').Environment[]);
        }
        load();
      } else toast.error(res.error || 'Restore failed');
    } catch { toast.error('Restore failed'); }
  };

  const handleDelete = async (item: TrashItem) => {
    if (!confirm(`Permanently delete ${item.type} "${(item.data as unknown as Record<string, unknown>).name || item.deletedId}"?`)) return;
    try {
      const res = await apiClient.delete(`/api/trash/${item._id}`);
      if (res.success) { toast.success('Permanently deleted'); load(); }
      else toast.error(res.error || 'Delete failed');
    } catch { toast.error('Delete failed'); }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'collection': return <Layers className="w-4 h-4 text-[#d4a574]" />;
      case 'request': return <Globe className="w-4 h-4 text-[#61affe]" />;
      case 'environment': return <FileJson className="w-4 h-4 text-green-400" />;
      default: return <Trash2 className="w-4 h-4" />;
    }
  };

  const daysLeft = (expiresAt: string) => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    const days = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    return days;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Trash (30 days)" size="lg">
      <div className="space-y-3 max-h-[60vh] overflow-y-auto">
        {loading ? (
          <p className="text-center text-gray-500 py-8">Loading...</p>
        ) : items.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <Trash2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>Trash is empty</p>
            <p className="text-xs mt-1">Deleted collections, requests and environments appear here for 30 days</p>
          </div>
        ) : (
          items.map(item => {
            const data = item.data as unknown as Record<string, unknown>;
            const name = (data.name as string) || item.deletedId;
            return (
              <div key={item._id} className="flex items-center gap-3 p-3 bg-[#1e1e1e] rounded border border-[#3d3d3d]">
                {getIcon(item.type)}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white truncate">{name} <span className="text-xs text-gray-500">({item.type})</span></div>
                  <div className="text-xs text-gray-500 flex items-center gap-2">
                    <Clock className="w-3 h-3" /> Deleted {new Date(item.deletedAt).toLocaleDateString()} · {daysLeft(item.expiresAt)}d left
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleRestore(item)}>
                  <RotateCcw className="w-4 h-4 mr-1" /> Restore
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(item)} className="text-red-400 hover:text-red-300">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            );
          })
        )}
      </div>
    </Modal>
  );
};
