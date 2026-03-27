'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Tabs, TabPanel } from '../ui/Tabs';
import { CollectionOverview } from './CollectionOverview';
import { CollectionAuth } from './CollectionAuth';
import { CollectionVariables } from './CollectionVariables';
import { CollectionScripts } from './CollectionScripts';
import { ChevronRight, FileJson, Clock, Layers } from 'lucide-react';
import type { Collection, Folder as FolderType } from '@apiforge/shared';

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

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'auth', label: 'Authorization' },
    { id: 'variables', label: 'Variables' },
    { id: 'scripts', label: 'Scripts' },
    { id: 'runs', label: 'Runs' },
  ];

  const handleTabClick = (tabId: string) => {
    if (tabId === 'runs') {
      return;
    }
    setActiveTab(tabId);
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
        <span className="text-white font-medium truncate">{folder ? folder.name : collection.name}</span>
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
