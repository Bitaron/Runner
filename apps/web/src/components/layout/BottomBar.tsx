'use client';

import React from 'react';
import { 
  Wifi, 
  WifiOff, 
  Search, 
  Terminal, 
  Layout, 
  HelpCircle,
  Rocket,
  Cookie,
  Trash2,
  MoreHorizontal,
  Columns,
  Rows
} from 'lucide-react';
import { syncManager } from '@/lib/syncManager';

interface BottomBarProps {
  layout: 'horizontal' | 'vertical';
  onLayoutChange: (layout: 'horizontal' | 'vertical') => void;
  onHelpOpen: () => void;
  onConsoleOpen: () => void;
}

export const BottomBar: React.FC<BottomBarProps> = ({
  layout,
  onLayoutChange,
  onHelpOpen,
  onConsoleOpen,
}) => {
  const isConnected = syncManager.isConnected;

  return (
    <div className="flex items-center justify-between h-8 px-3 bg-[#262627] border-t border-[#3d3d3d]">
      {/* Left section */}
      <div className="flex items-center gap-1">
        {/* Online status */}
        <div
          role="status"
          aria-label={isConnected ? 'Connected' : 'Disconnected'}
          className={`flex items-center gap-1.5 px-2 py-1 rounded ${isConnected ? 'text-green-400' : 'text-red-400'}`}
        >
          {isConnected ? <Wifi className="w-3.5 h-3.5"  aria-hidden="true" /> : <WifiOff className="w-3.5 h-3.5"  aria-hidden="true" />}
          <span className="text-xs">{isConnected ? 'Online' : 'Offline'}</span>
        </div>

        <div className="w-px h-4 bg-[#3d3d3d]" />

        {/* Find/Replace (non-functional) */}
        <button 
          disabled
          aria-disabled="true"
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-[#3d3d3d] rounded transition-colors opacity-50 cursor-not-allowed"
          title="Find/Replace (coming soon)"
        >
          <Search className="w-3.5 h-3.5"  aria-hidden="true" />
          <span>Find</span>
        </button>

        {/* Console */}
        <button 
          onClick={onConsoleOpen}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-[#3d3d3d] rounded transition-colors"
        >
          <Terminal className="w-3.5 h-3.5"  aria-hidden="true" />
          <span>Console</span>
        </button>

        <div className="w-px h-4 bg-[#3d3d3d]" />

        {/* Layout toggle */}
        <button
          onClick={() => onLayoutChange(layout === 'horizontal' ? 'vertical' : 'horizontal')}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-[#3d3d3d] rounded transition-colors"
          title={layout === 'horizontal' ? 'Switch to vertical layout' : 'Switch to horizontal layout'}
        >
          {layout === 'horizontal' ? (
            <>
              <Columns className="w-3.5 h-3.5" />
              <span>Horizontal</span>
            </>
          ) : (
            <>
              <Rows className="w-3.5 h-3.5" />
              <span>Vertical</span>
            </>
          )}
        </button>

        {/* Help button */}
        <button 
          onClick={onHelpOpen}
          className="flex items-center justify-center w-6 h-6 text-gray-400 hover:text-white hover:bg-[#3d3d3d] rounded-full transition-colors"
          title="Help"
          aria-label="Help"
        >
          <HelpCircle className="w-4 h-4"  aria-hidden="true" />
        </button>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-1">
        {/* Runner (non-functional) */}
        <button 
          disabled
          aria-disabled="true"
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-[#3d3d3d] rounded transition-colors opacity-50 cursor-not-allowed"
          title="Runner (coming soon)"
        >
          <Rocket className="w-3.5 h-3.5" />
          <span>Runner</span>
        </button>

        {/* Capture requests (non-functional) */}
        <button 
          disabled
          aria-disabled="true"
          className="p-1.5 text-gray-400 hover:text-white hover:bg-[#3d3d3d] rounded transition-colors opacity-50 cursor-not-allowed"
          title="Capture requests (coming soon)"
          aria-label="Capture requests"
        >
          <Terminal className="w-3.5 h-3.5"  aria-hidden="true" />
        </button>

        {/* Cookies (non-functional) */}
        <button 
          disabled
          aria-disabled="true"
          className="p-1.5 text-gray-400 hover:text-white hover:bg-[#3d3d3d] rounded transition-colors opacity-50 cursor-not-allowed"
          title="Cookies (coming soon)"
          aria-label="Cookies"
        >
          <Cookie className="w-3.5 h-3.5" />
        </button>

        {/* Vault (non-functional) */}
        <button 
          disabled
          aria-disabled="true"
          className="p-1.5 text-gray-400 hover:text-white hover:bg-[#3d3d3d] rounded transition-colors opacity-50 cursor-not-allowed"
          title="Vault (coming soon)"
          aria-label="Vault"
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>

        {/* Trash */}
        <button 
          className="p-1.5 text-gray-400 hover:text-white hover:bg-[#3d3d3d] rounded transition-colors"
          title="Trash"
          aria-label="Trash"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
