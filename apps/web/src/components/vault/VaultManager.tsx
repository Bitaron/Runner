'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { apiClient } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useCollectionsStore } from '@/stores/collectionsStore';
import { Lock, Eye, EyeOff, Shield, Key } from 'lucide-react';
import type { Collection, Environment } from '@apiforge/shared';

export const VaultManager: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [envs, setEnvs] = useState<Environment[]>([]);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const { currentWorkspace } = useWorkspaceStore();

  const load = useCallback(async () => {
    if (!currentWorkspace) return;
    const [cRes, eRes] = await Promise.all([
      apiClient.get<Collection[]>('/api/collections', { workspaceId: currentWorkspace._id }),
      apiClient.get<Environment[]>('/api/environments', { workspaceId: currentWorkspace._id }),
    ]);
    if (cRes.success && cRes.data) setCollections(cRes.data as Collection[]);
    if (eRes.success && eRes.data) setEnvs(eRes.data as Environment[]);
  }, [currentWorkspace]);

  useEffect(() => { if (isOpen) load(); }, [isOpen, load]);

  const toggle = (key: string) => {
    setRevealed(prev => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  };

  const secrets: Array<{ scope: string; key: string; value: string; id: string }> = [];
  collections.forEach(c => {
    c.variables.filter(v => v.type === 'secret').forEach(v => secrets.push({ scope: `Collection: ${c.name}`, key: v.key, value: v.value, id: `c-${c._id}-${v.key}` }));
    const walk = (folders: Collection['folders'], prefix: string) => {
      folders.forEach(f => {
        f.variables.filter(v => v.type === 'secret').forEach(v => secrets.push({ scope: `${prefix} / ${f.name}`, key: v.key, value: v.value, id: `f-${f._id}-${v.key}` }));
        walk(f.folders, `${prefix} / ${f.name}`);
      });
    };
    walk(c.folders, c.name);
  });
  envs.forEach(e => {
    e.variables.filter(v => v.type === 'secret').forEach(v => secrets.push({ scope: `Env: ${e.name}`, key: v.key, value: v.value, id: `e-${e._id}-${v.key}` }));
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Vault — Encrypted Secrets" size="lg">
      <div className="space-y-4">
        <div className="flex items-center gap-2 p-3 bg-[#1e1e1e] rounded border border-[#3d3d3d] text-xs text-gray-400">
          <Shield className="w-4 h-4 text-green-400" />
          Secrets are encrypted at rest with AES-256-GCM (VAULT_KEY). They are decrypted only for authenticated workspace members.
        </div>
        <div className="max-h-[50vh] overflow-y-auto space-y-2">
          {secrets.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <Lock className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No secrets</p>
              <p className="text-xs">Mark a variable as <code>secret</code> to store it encrypted</p>
            </div>
          ) : (
            secrets.map(s => (
              <div key={s.id} className="flex items-center gap-3 p-3 bg-[#1e1e1e] rounded border border-[#2d2d2d]">
                <Key className="w-4 h-4 text-amber-400" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-500 truncate">{s.scope}</div>
                  <div className="text-sm text-white font-mono">{s.key}</div>
                </div>
                <div className="font-mono text-sm text-gray-300 truncate max-w-[150px]">{revealed.has(s.id) ? s.value : '•'.repeat(8)}</div>
                <Button variant="ghost" size="sm" onClick={() => toggle(s.id)}>
                  {revealed.has(s.id) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            ))
          )}
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-[#3d3d3d]">
          <span className="text-xs text-gray-500">{secrets.length} secrets · encrypted</span>
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
};
