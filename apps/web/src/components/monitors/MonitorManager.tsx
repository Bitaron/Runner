'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { apiClient } from '@/lib/api';
import { toast } from '@/components/sync/SyncStatus';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { Clock, Play, Trash2 } from 'lucide-react';
import type { Monitor, Collection } from '@apiforge/shared';

export const MonitorManager: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState('');
  const [schedule, setSchedule] = useState('every 1h');
  const [name, setName] = useState('');
  const { currentWorkspace } = useWorkspaceStore();

  const load = useCallback(async () => {
    if (!currentWorkspace) return;
    const [mRes, cRes] = await Promise.all([
      apiClient.get<Monitor[]>('/api/monitors', { workspaceId: currentWorkspace._id }),
      apiClient.get<Collection[]>('/api/collections', { workspaceId: currentWorkspace._id }),
    ]);
    if (mRes.success && mRes.data) setMonitors(mRes.data as Monitor[]);
    if (cRes.success && cRes.data) {
      setCollections(cRes.data as Collection[]);
      if (!selectedCollection && (cRes.data as Collection[]).length) setSelectedCollection((cRes.data as Collection[])[0]._id);
    }
  }, [currentWorkspace, selectedCollection]);

  useEffect(() => { if (isOpen) load(); }, [isOpen, load]);

  const handleCreate = async () => {
    if (!selectedCollection || !currentWorkspace) return;
    const res = await apiClient.post<Monitor>('/api/monitors', {
      collectionId: selectedCollection,
      workspaceId: currentWorkspace._id,
      name: name || 'Monitor',
      schedule,
    });
    if (res.success) { toast.success('Monitor created'); setName(''); load(); }
    else toast.error(res.error || 'Failed');
  };

  const handleRun = async (id: string) => {
    const res = await apiClient.post(`/api/monitors/${id}/run`);
    if (res.success) {
      const data = (res.data as unknown as { results: Array<{ name: string; status: number }> }).results;
      toast.success(`Run done — ${data?.length || 0} requests`);
      load();
    } else toast.error(res.error || 'Run failed');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete monitor?')) return;
    await apiClient.delete(`/api/monitors/${id}`);
    load();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Monitors (Scheduled Runs)" size="lg">
      <div className="space-y-4">
        <div className="flex gap-2">
          <Select value={selectedCollection} onChange={(e) => setSelectedCollection(e.target.value)} options={collections.map(c => ({ value: c._id, label: c.name }))} className="flex-1" />
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="w-32" />
          <Select value={schedule} onChange={(e) => setSchedule(e.target.value)} options={[{ value: 'every 5m', label: 'Every 5m' }, { value: 'every 1h', label: 'Every 1h' }, { value: 'every 1d', label: 'Daily' }, { value: '* * * * *', label: 'Cron * * * * *' }]} className="w-32" />
          <Button onClick={handleCreate}>Create</Button>
        </div>
        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {monitors.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No monitors — schedule collection runs</p>
          ) : monitors.map(m => (
            <div key={m._id} className="p-3 bg-[#1e1e1e] rounded border border-[#3d3d3d] flex items-center gap-3">
              <Clock className="w-5 h-5 text-orange-400" />
              <div className="flex-1">
                <div className="text-sm text-white">{m.name} <span className="text-xs text-gray-500">· {m.schedule}</span></div>
                <div className="text-xs text-gray-500">Collection: {collections.find(c => c._id === m.collectionId)?.name || m.collectionId} · Last: {m.lastRun ? new Date(m.lastRun).toLocaleString() : 'never'} · Next: {m.nextRun ? new Date(m.nextRun).toLocaleTimeString() : '-'}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => handleRun(m._id)}><Play className="w-4 h-4" /></Button>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(m._id)} className="text-red-400"><Trash2 className="w-4 h-4" /></Button>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500">Runs are stubbed — `POST /api/monitors/:id/run` executes up to 10 requests via the collection. Cron is stored as `nextRun`; a background worker can trigger runs.</p>
      </div>
    </Modal>
  );
};
