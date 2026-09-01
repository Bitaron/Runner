'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { apiClient } from '@/lib/api';
import { toast } from '@/components/sync/SyncStatus';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { Globe, Copy, Trash2 } from 'lucide-react';
import type { PublishedDoc, Collection } from '@apiforge/shared';

export const PublishManager: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [docs, setDocs] = useState<PublishedDoc[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selected, setSelected] = useState('');
  const { currentWorkspace } = useWorkspaceStore();

  const load = useCallback(async () => {
    if (!currentWorkspace) return;
    const [pRes, cRes] = await Promise.all([
      apiClient.get<PublishedDoc[]>('/api/publish', { workspaceId: currentWorkspace._id }),
      apiClient.get<Collection[]>('/api/collections', { workspaceId: currentWorkspace._id }),
    ]);
    if (pRes.success && pRes.data) setDocs(pRes.data as PublishedDoc[]);
    if (cRes.success && cRes.data) {
      setCollections(cRes.data as Collection[]);
      if ((cRes.data as Collection[]).length) {
        setSelected(prev => prev || (cRes.data as Collection[])[0]._id);
      }
    }
  }, [currentWorkspace]);

  useEffect(() => { if (isOpen) load(); }, [isOpen, load]);

  const handlePublish = async () => {
    if (!selected || !currentWorkspace) return;
    const res = await apiClient.post<PublishedDoc>('/api/publish', { collectionId: selected, workspaceId: currentWorkspace._id, isPublic: true });
    if (res.success) { toast.success('Published'); load(); }
    else toast.error(res.error || 'Failed');
  };

  const handleUnpublish = async (id: string) => {
    if (!confirm('Unpublish?')) return;
    await apiClient.delete(`/api/publish/${id}`);
    load();
  };

  const copyLink = (slug: string) => {
    const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/publish/slug/${slug}`;
    navigator.clipboard.writeText(apiUrl);
    toast.success('Link copied');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Publish Docs (Public)" size="lg">
      <div className="space-y-4">
        <div className="flex gap-2">
          <Select value={selected} onChange={(e) => setSelected(e.target.value)} options={collections.map(c => ({ value: c._id, label: c.name }))} className="flex-1" />
          <Button onClick={handlePublish}>Publish</Button>
        </div>
        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {docs.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No published docs — publish a collection to get a public link</p>
          ) : docs.map(d => (
            <div key={d._id} className="p-3 bg-[#1e1e1e] rounded border border-[#3d3d3d] flex items-center gap-3">
              <Globe className="w-5 h-5 text-blue-400" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white truncate">{collections.find(c => c._id === d.collectionId)?.name || d.collectionId}</div>
                <div className="text-xs font-mono text-gray-500 truncate">/api/publish/slug/{d.slug}</div>
                <div className="text-xs text-gray-500">{new Date(d.createdAt).toLocaleString()} · {d.isPublic ? 'public' : 'private'}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => copyLink(d.slug)}><Copy className="w-4 h-4" /></Button>
              <Button variant="ghost" size="sm" onClick={() => handleUnpublish(d._id)} className="text-red-400"><Trash2 className="w-4 h-4" /></Button>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500">Public docs are accessible via <code>GET /api/publish/slug/:slug</code> without auth. Secrets are redacted.</p>
      </div>
    </Modal>
  );
};
