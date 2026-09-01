'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Modal } from '@/components/ui/Modal';
import { apiClient } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { Clock, User, FileJson } from 'lucide-react';
import type { AuditEntry } from '@apiforge/shared';

export const AuditViewer: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const { currentWorkspace } = useWorkspaceStore();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<AuditEntry[]>('/api/audit', currentWorkspace ? { workspaceId: currentWorkspace._id } : undefined);
      if (res.success && res.data) setEntries(res.data as AuditEntry[]);
    } catch {}
    setLoading(false);
  }, [currentWorkspace]);

  useEffect(() => { if (isOpen) load(); }, [isOpen, load]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Audit Log" size="lg">
      <div className="space-y-2 max-h-[60vh] overflow-y-auto">
        {loading ? (
          <p className="text-center text-gray-500 py-8">Loading...</p>
        ) : entries.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>No audit entries</p>
            <p className="text-xs">Actions on collections, environments and auth are logged here</p>
          </div>
        ) : (
          entries.map(e => (
            <div key={e._id} className="p-3 bg-[#1e1e1e] rounded border border-[#2d2d2d] flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#2d2d2d] flex items-center justify-center">
                <User className="w-4 h-4 text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white truncate">{e.action} <span className="text-gray-500">· {e.entityType}:{e.entityId.slice(0, 8)}</span></div>
                <div className="text-xs text-gray-500 flex items-center gap-2">
                  <span>{e.userEmail || e.userId.slice(0, 8)}</span>
                  <span>·</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(e.timestamp).toLocaleString()}</span>
                  {e.workspaceId && <span>· ws:{e.workspaceId.slice(0, 6)}</span>}
                </div>
              </div>
              {e.details && <div className="text-xs font-mono text-gray-400 max-w-[150px] truncate">{JSON.stringify(e.details)}</div>}
            </div>
          ))
        )}
      </div>
    </Modal>
  );
};
