'use client';

import React from 'react';
import { X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ApiRequest } from '@apiforge/shared';

interface TabItem {
  id: string;
  request: ApiRequest;
}

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
          <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded", getMethodColor(tab.request.method))}>
            {tab.request.method}
          </span>
          <span className="text-sm text-gray-300 max-w-[150px] truncate">
            {tab.request.name || tab.request.url || 'Untitled'}
          </span>
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
