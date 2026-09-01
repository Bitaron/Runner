'use client';

import React, { useEffect, useState } from 'react';
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
  Rows,
  Globe,
  Lock,
  Shield,
  BookOpen
} from 'lucide-react';
import { syncManager } from '@/lib/syncManager';

interface BottomBarProps {
  layout: 'horizontal' | 'vertical';
  onLayoutChange: (layout: 'horizontal' | 'vertical') => void;
  onHelpOpen: () => void;
  onConsoleOpen: () => void;
  onTrashOpen?: () => void;
  onMocksOpen?: () => void;
  onMonitorsOpen?: () => void;
  onVaultOpen?: () => void;
  onAuditOpen?: () => void;
  onPublishOpen?: () => void;
  onCookieOpen?: () => void;
}

export const BottomBar: React.FC<BottomBarProps> = ({
  layout,
  onLayoutChange,
  onHelpOpen,
  onConsoleOpen,
  onTrashOpen,
  onMocksOpen,
  onMonitorsOpen,
  onVaultOpen,
  onAuditOpen,
  onPublishOpen,
  onCookieOpen,
}) => {
  // Subscribe reactively; reading syncManager.isConnected during render
  // alone never re-renders when the socket opens/closes.
  const [isConnected, setIsConnected] = useState(syncManager.isConnected);

  useEffect(
    () => syncManager.onConnectionChange(setIsConnected),
    []
  );

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
        {/* Mocks */}
        <button 
          onClick={onMocksOpen}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-[#3d3d3d] rounded transition-colors"
          title="Mock Servers"
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Mocks</span>
        </button>
        {/* Monitors / Runner */}
        <button 
          onClick={onMonitorsOpen}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-400 hover:text-white hover:bg-[#3d3d3d] rounded transition-colors"
          title="Monitors / Runner"
        >
          <Rocket className="w-3.5 h-3.5" />
          <span>Runner</span>
        </button>

        {/* Cookies */}
        <button 
          onClick={onCookieOpen}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-[#3d3d3d] rounded transition-colors"
          title="Cookie Jar"
          aria-label="Cookies"
        >
          <Cookie className="w-3.5 h-3.5" />
        </button>

        {/* Vault */}
        <button 
          onClick={onVaultOpen}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-[#3d3d3d] rounded transition-colors"
          title="Vault (encrypted secrets)"
          aria-label="Vault"
        >
          <Lock className="w-3.5 h-3.5" />
        </button>

        {/* Audit */}
        <button 
          onClick={onAuditOpen}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-[#3d3d3d] rounded transition-colors"
          title="Audit Log"
          aria-label="Audit"
        >
          <Shield className="w-3.5 h-3.5" />
        </button>

        {/* Publish */}
        <button 
          onClick={onPublishOpen}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-[#3d3d3d] rounded transition-colors"
          title="Publish Docs"
          aria-label="Publish"
        >
          <BookOpen className="w-3.5 h-3.5" />
        </button>

        {/* Trash */}
        <button 
          onClick={onTrashOpen}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-[#3d3d3d] rounded transition-colors"
          title="Trash (30 days)"
          aria-label="Trash"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
