'use client';

import React from 'react';
import { X, Plus, FolderOpen, FileJson } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ApiRequest, Collection, Folder } from '@apiforge/shared';

interface RequestTabItem {
  id: string;
  type: 'request';
  request: ApiRequest;
}

interface CollectionTabItem {
  id: string;
  type: 'collection';
  collection: Collection;
}

interface FolderTabItem {
  id: string;
  type: 'folder';
  collection: Collection;
  folder: Folder;
}

type TabItem = RequestTabItem | CollectionTabItem | FolderTabItem;

interface RequestTabsProps {
  tabs: TabItem[];
  activeTabId: string | null;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onNewTab: () => void;
  getMethodColor: (method: string) => string;
}

export const RequestTabs: React.FC<RequestTabsProps> = ({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onNewTab,
  getMethodColor,
}) => {
  const getTabIcon = (tab: TabItem) => {
    if (tab.type === 'request') {
      return (
        <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded", getMethodColor(tab.request.method))}>
          {tab.request.method}
        </span>
      );
    } else if (tab.type === 'collection') {
      return <FolderOpen className="w-4 h-4 text-[#ff6b35]" />;
    } else {
      return <FileJson className="w-4 h-4 text-blue-400" />;
    }
  };

  const getTabTitle = (tab: TabItem) => {
    if (tab.type === 'request') {
      return tab.request.name || tab.request.url || 'Untitled';
    } else if (tab.type === 'collection') {
      return tab.collection.name;
    } else {
      return tab.folder.name;
    }
  };

  const getTabBreadcrumb = (tab: TabItem) => {
    if (tab.type === 'request') {
      return null;
    } else if (tab.type === 'collection') {
      return (
        <span className="text-xs text-gray-500 ml-1">
          / {tab.collection.name}
        </span>
      );
    } else {
      return (
        <span className="text-xs text-gray-500 ml-1">
          / {tab.collection.name} / {tab.folder.name}
        </span>
      );
    }
  };

  return (
    <div className="flex items-center h-10 bg-[#1e1e1e] border-b border-[#3d3d3d] overflow-x-auto">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          onClick={() => onTabSelect(tab.id)}
          className={cn(
            "flex items-center gap-2 h-10 px-3 border-r border-[#3d3d3d] cursor-pointer group whitespace-nowrap",
            activeTabId === tab.id
              ? "bg-[#262627] border-b-2 border-b-[#ff6b35]"
              : "hover:bg-[#262627]"
          )}
        >
          {getTabIcon(tab)}
          <div className="flex items-center">
            <span className="text-sm text-gray-300 max-w-[120px] truncate">
              {getTabTitle(tab)}
            </span>
            {getTabBreadcrumb(tab)}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTabClose(tab.id);
            }}
            className="p-1 text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
      <button
        onClick={onNewTab}
        className="flex items-center justify-center w-10 h-10 text-gray-400 hover:text-white hover:bg-[#262627] transition-colors"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
};
