'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Tabs, TabPanel } from '../ui/Tabs';
import { CollectionOverview } from './CollectionOverview';
import { CollectionAuth } from './CollectionAuth';
import { CollectionVariables } from './CollectionVariables';
import { CollectionScripts } from './CollectionScripts';
import { ChevronRight, FileJson, Clock, Layers, GitFork, History, RotateCcw } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from '../sync/SyncStatus';
import type { Collection, Folder as FolderType, CollectionVersion } from '@apiforge/shared';

interface CollectionPanelProps {
  collection: Collection;
  folder?: FolderType;
  onClose: () => void;
  onUpdateCollection: (updates: Partial<Collection>) => void;
  onUpdateFolder?: (folderId: string, updates: Partial<FolderType>) => void;
}

export const CollectionPanel: React.FC<CollectionPanelProps> = ({
  collection,
  folder,
  onClose,
  onUpdateCollection,
  onUpdateFolder,
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [versions, setVersions] = useState<CollectionVersion[]>([]);
  const [isForking, setIsForking] = useState(false);

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'auth', label: 'Authorization' },
    { id: 'variables', label: 'Variables' },
    { id: 'scripts', label: 'Scripts' },
    { id: 'versions', label: 'Versions' },
    { id: 'runs', label: 'Runs' },
  ];

  const handleTabClick = (tabId: string) => {
    if (tabId === 'runs') {
      return;
    }
    if (tabId === 'versions') {
      loadVersions();
    }
    setActiveTab(tabId);
  };

  const loadVersions = useCallback(async () => {
    try {
      const res = await apiClient.get<CollectionVersion[]>(`/api/collections/${collection._id}/versions`);
      if (res.success && res.data) setVersions(res.data as CollectionVersion[]);
    } catch {}
  }, [collection._id]);

  useEffect(() => { if (activeTab === 'versions') loadVersions(); }, [activeTab, loadVersions]);

  const handleFork = async () => {
    const name = prompt('Fork name', `${collection.name} (fork)`);
    if (!name) return;
    setIsForking(true);
    try {
      const res = await apiClient.post<Collection>(`/api/collections/${collection._id}/fork`, { name, workspaceId: collection.workspaceId });
      if (res.success) toast.success(`Forked as "${(res.data as Collection).name}"`);
      else toast.error(res.error || 'Fork failed');
    } catch { toast.error('Fork failed'); }
    setIsForking(false);
  };

  const handleRestoreVersion = async (v: CollectionVersion) => {
    if (!confirm(`Restore version ${v.version} from ${new Date(v.createdAt).toLocaleString()}?`)) return;
    const res = await apiClient.post(`/api/collections/${collection._id}/versions/${v._id}/restore`);
    if (res.success) {
      toast.success(`Restored version ${v.version}`);
      loadVersions();
      // refresh collection data
      const fresh = await apiClient.get<Collection>(`/api/collections/${collection._id}`);
      if (fresh.success && fresh.data) onUpdateCollection(fresh.data as Collection);
    } else toast.error(res.error || 'Restore failed');
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e]">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#3d3d3d]">
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <ChevronRight className="w-5 h-5 rotate-90" />
        </button>
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-[#d4a574]" />
          <span className="text-gray-400 text-sm">Collection</span>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-600" />
        <span className="text-white font-medium truncate flex-1">{folder ? folder.name : collection.name}</span>
        {!folder && (
          <button onClick={handleFork} disabled={isForking} className="flex items-center gap-1 px-2 py-1 text-xs bg-[#2d2d2d] hover:bg-[#3d3d3d] text-gray-300 rounded border border-[#3d3d3d]">
            <GitFork className="w-3.5 h-3.5" /> {isForking ? 'Forking...' : 'Fork'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-[#3d3d3d]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
              activeTab === tab.id
                ? 'border-[#ff6b35] text-white'
                : 'border-transparent text-gray-400 hover:text-white',
              tab.id === 'runs' && 'opacity-50 cursor-not-allowed'
            )}
          >
            {tab.label}
            {tab.id === 'runs' && (
              <span className="ml-1 text-xs">(Coming soon)</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'overview' && (
          <CollectionOverview
            collection={collection}
            folder={folder}
            onUpdateCollection={onUpdateCollection}
            onUpdateFolder={onUpdateFolder}
          />
        )}
        {activeTab === 'auth' && (
          <CollectionAuth
            collection={collection}
            folder={folder}
            onUpdateCollection={onUpdateCollection}
            onUpdateFolder={onUpdateFolder}
          />
        )}
        {activeTab === 'variables' && (
          <CollectionVariables
            collection={collection}
            folder={folder}
            onUpdateCollection={onUpdateCollection}
            onUpdateFolder={onUpdateFolder}
          />
        )}
        {activeTab === 'scripts' && (
          <CollectionScripts
            collection={collection}
            folder={folder}
            onUpdateCollection={onUpdateCollection}
            onUpdateFolder={onUpdateFolder}
          />
        )}
        {activeTab === 'versions' && (
          <div className="p-4 space-y-2">
            {versions.length === 0 ? (
              <div className="text-center py-10 text-gray-500">
                <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No versions yet</p>
                <p className="text-xs">Versions are created on each save</p>
              </div>
            ) : (
              versions.map(v => (
                <div key={v._id} className="flex items-center gap-3 p-3 bg-[#2d2d2d] rounded border border-[#3d3d3d]">
                  <History className="w-4 h-4 text-gray-400" />
                  <div className="flex-1">
                    <div className="text-sm text-white">Version {v.version}</div>
                    <div className="text-xs text-gray-500">{new Date(v.createdAt).toLocaleString()} by {v.createdBy.slice(0, 8)}</div>
                  </div>
                  <button onClick={() => handleRestoreVersion(v)} className="flex items-center gap-1 px-2 py-1 text-xs bg-[#ff6b35] text-white rounded hover:bg-[#e55a2b]">
                    <RotateCcw className="w-3 h-3" /> Restore
                  </button>
                </div>
              ))
            )}
          </div>
        )}
        {activeTab === 'runs' && (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Collection Runs</p>
              <p className="text-sm mt-1">Coming soon...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
