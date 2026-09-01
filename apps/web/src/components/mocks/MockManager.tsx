'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { apiClient } from '@/lib/api';
import { toast } from '@/components/sync/SyncStatus';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useCollectionsStore } from '@/stores/collectionsStore';
import { Globe, Trash2, Copy } from 'lucide-react';
import type { MockServer, Collection } from '@apiforge/shared';

export const MockManager: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [mocks, setMocks] = useState<MockServer[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState('');
  const [name, setName] = useState('');
  const { currentWorkspace } = useWorkspaceStore();

  const load = useCallback(async () => {
    if (!currentWorkspace) return;
    const [mRes, cRes] = await Promise.all([
      apiClient.get<MockServer[]>('/api/mocks', { workspaceId: currentWorkspace._id }),
      apiClient.get<Collection[]>('/api/collections', { workspaceId: currentWorkspace._id }),
    ]);
    if (mRes.success && mRes.data) setMocks(mRes.data as MockServer[]);
    if (cRes.success && cRes.data) {
      setCollections(cRes.data as Collection[]);
      if ((cRes.data as Collection[]).length) {
        setSelectedCollection(prev => prev || (cRes.data as Collection[])[0]._id);
      }
    }
  }, [currentWorkspace]);

  useEffect(() => { if (isOpen) load(); }, [isOpen, load]);

  const handleCreate = async () => {
    if (!selectedCollection || !currentWorkspace) { toast.error('Select collection'); return; }
    const res = await apiClient.post<MockServer>('/api/mocks', {
      collectionId: selectedCollection,
      workspaceId: currentWorkspace._id,
      name: name || 'Mock Server',
    });
    if (res.success) { toast.success('Mock created'); setName(''); load(); }
    else toast.error(res.error || 'Failed');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete mock?')) return;
    await apiClient.delete(`/api/mocks/${id}`);
    toast.success('Mock deleted');
    load();
  };

  const copyUrl = (mock: MockServer) => {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const url = `${base}/api/mocks/${mock._id}/call/`;
    navigator.clipboard.writeText(url);
    toast.success('Mock URL copied');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Mock Servers" size="lg">
      <div className="space-y-4">
        <div className="flex gap-2">
          <Select value={selectedCollection} onChange={(e) => setSelectedCollection(e.target.value)} options={collections.map(c => ({ value: c._id, label: c.name }))} className="flex-1" />
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Mock name" className="w-40" />
          <Button onClick={handleCreate}>Create</Button>
        </div>
        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {mocks.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No mocks — create one to get a mock URL for your collection</p>
          ) : mocks.map(m => (
            <div key={m._id} className="p-3 bg-[#1e1e1e] rounded border border-[#3d3d3d] flex items-center gap-3">
              <Globe className="w-5 h-5 text-green-400" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white">{m.name}</div>
                <div className="text-xs text-gray-500 truncate">Collection: {collections.find(c => c._id === m.collectionId)?.name || m.collectionId} · {new Date(m.createdAt).toLocaleDateString()}</div>
                <div className="text-xs font-mono text-[#61affe] truncate">{process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/mocks/{m._id}/call/&lt;path&gt;</div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => copyUrl(m)}><Copy className="w-4 h-4" /></Button>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(m._id)} className="text-red-400"><Trash2 className="w-4 h-4" /></Button>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500">Mocks return the collection&apos;s example responses or a generic JSON. Use <code>/call/&lt;path&gt;</code> with matching method.</p>
      </div>
    </Modal>
  );
};
