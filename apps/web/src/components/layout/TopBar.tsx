'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Menu, 
  ChevronLeft, 
  ChevronRight, 
  Home, 
  Search, 
  Users, 
  Settings, 
  Bell, 
  ChevronDown,
  Plus,
  Zap,
  LogOut,
  User,
  Check
} from 'lucide-react';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';

interface TopBarProps {
  onSearchOpen: () => void;
  onTeamOpen: () => void;
  onSettingsOpen: () => void;
  onNewRequest: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  onSearchOpen,
  onTeamOpen,
  onSettingsOpen,
  onNewRequest,
}) => {
  const [showWorkspaces, setShowWorkspaces] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { currentWorkspace, workspaces, setCurrentWorkspace } = useWorkspaceStore();
  const { user, logout, isAnonymous } = useAuthStore();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleWorkspaceSelect = (workspace: typeof currentWorkspace) => {
    if (workspace) {
      setCurrentWorkspace(workspace);
    }
    setShowWorkspaces(false);
  };

  const initials = user?.name
    ? user.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'U'
    : 'U';

  return (
    <div className="flex flex-col">
      {/* Top navigation bar */}
      <div className="flex items-center justify-between h-10 px-2 bg-[#262627] border-b border-[#3d3d3d]">
        {/* Left section */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            aria-label="Open menu"
            className="p-2 text-gray-400 hover:text-white hover:bg-[#3d3d3d] rounded transition-colors"
          >
            <Menu className="w-4 h-4" aria-hidden="true" />
          </button>
          <div className="flex items-center gap-1">
            <button
              aria-label="Go back"
              className="p-2 text-gray-400 hover:text-white hover:bg-[#3d3d3d] rounded transition-colors"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              aria-label="Go forward"
              className="p-2 text-gray-400 hover:text-white hover:bg-[#3d3d3d] rounded transition-colors"
            >
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
          <button className="hidden items-center gap-1 px-2 py-1 text-sm whitespace-nowrap text-gray-400 hover:text-white hover:bg-[#3d3d3d] rounded transition-colors md:flex">
            <Home className="w-4 h-4" />
            <span>Home</span>
          </button>
          <div className="relative">
            <button 
              onClick={() => setShowWorkspaces(!showWorkspaces)}
              className="flex items-center gap-1 px-2 py-1 text-sm whitespace-nowrap text-gray-400 hover:text-white hover:bg-[#3d3d3d] rounded transition-colors"
            >
              <span>Workspaces</span>
              <ChevronDown className="w-3 h-3" aria-hidden="true" />
            </button>
            {showWorkspaces && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-[#2d2d2e] border border-[#3d3d3d] rounded-lg shadow-xl z-50">
                {workspaces.map((ws) => {
                  const isActive = currentWorkspace?._id === ws._id;
                  return (
                    <button
                      key={ws._id}
                      onClick={() => handleWorkspaceSelect(ws)}
                      aria-current={isActive ? 'true' : undefined}
                      className={cn(
                        "w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left hover:bg-[#3d3d3d] transition-colors",
                        isActive ? "text-[#ff6b35]" : "text-gray-300"
                      )}
                    >
                      <span className="truncate">{ws.name}</span>
                      {isActive && <Check className="w-4 h-4 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <button className="hidden items-center gap-1 px-2 py-1 text-sm whitespace-nowrap text-gray-400 hover:text-white hover:bg-[#3d3d3d] rounded transition-colors lg:flex">
            <span>API Network</span>
          </button>
        </div>

        {/* Center section - Search */}
        <div className="flex-1 min-w-0 max-w-xl mx-4">
          <button
            onClick={onSearchOpen}
            className="flex items-center gap-2 w-full px-3 py-1.5 bg-[#1e1e1e] border border-[#3d3d3d] rounded-full text-sm text-gray-400 hover:border-[#ff6b35] transition-colors"
          >
            <Search className="w-4 h-4" aria-hidden="true" />
            <span>Search</span>
            <kbd className="ml-auto px-1.5 py-0.5 text-xs bg-[#3d3d3d] rounded">⌘K</kbd>
          </button>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onTeamOpen}
            aria-label="Invite team members"
            className="p-2 text-gray-400 hover:text-white hover:bg-[#3d3d3d] rounded transition-colors"
            title="Invite team members"
          >
            <Users className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            onClick={onSettingsOpen}
            aria-label="Open settings"
            className="p-2 text-gray-400 hover:text-white hover:bg-[#3d3d3d] rounded transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            disabled
            aria-disabled="true"
            aria-label="Notifications (coming soon)"
            className="p-2 text-gray-400 rounded cursor-not-allowed opacity-50"
            title="Notifications (coming soon)"
          >
            <Bell className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            aria-label="Upgrade plan"
            className="hidden items-center gap-1 px-3 py-1 text-sm whitespace-nowrap border border-[#3d3d3d] text-gray-300 hover:bg-[#3d3d3d]/50 rounded transition-colors xl:flex"
          >
            <Zap className="w-4 h-4" aria-hidden="true" />
            Upgrade
          </button>
          <div className="flex items-center gap-2 ml-2 border-l border-[#3d3d3d] pl-2">
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                title={user?.name || user?.email || undefined}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-white hover:bg-[#3d3d3d] rounded transition-colors p-1"
              >
                <div className="w-6 h-6 shrink-0 overflow-hidden rounded-full bg-[#ff6b35] flex items-center justify-center text-white text-xs font-medium">
                  {initials}
                </div>
                <ChevronDown className="w-3 h-3" aria-hidden="true" />
              </button>
              {showUserMenu && (
                <div className="absolute top-full right-0 mt-1 w-56 bg-[#2d2d2e] border border-[#3d3d3d] rounded-lg shadow-xl z-50">
                  <div className="px-3 py-2 border-b border-[#3d3d3d]">
                    <p className="text-sm text-white font-medium">{user?.name || 'User'}</p>
                    <p className="text-xs text-gray-500">{user?.email || 'Anonymous'}</p>
                    {isAnonymous && (
                      <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-[#ff6b35]/20 text-[#ff6b35] rounded">Anonymous</span>
                    )}
                  </div>
                  <button className="w-full px-3 py-2 text-sm text-left text-gray-300 hover:bg-[#3d3d3d] flex items-center gap-2 transition-colors">
                    <User className="w-4 h-4" aria-hidden="true" />
                    Profile Settings
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await apiClient.post('/api/auth/logout');
                      } catch {
                        // Server unreachable; clear local state anyway
                      }
                      logout();
                      window.location.href = '/login';
                    }}
                    className="w-full px-3 py-2 text-sm text-left text-gray-300 hover:bg-[#3d3d3d] flex items-center gap-2 transition-colors border-t border-[#3d3d3d]"
                  >
                    <LogOut className="w-4 h-4" aria-hidden="true" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Secondary bar */}
      <div className="flex items-center justify-between h-10 px-4 bg-[#262627] border-b border-[#3d3d3d]">
        <div className="flex items-center gap-4">
          <span className="text-sm text-white font-medium">{currentWorkspace?.name || 'Workspace'}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onNewRequest}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-[#ff6b35] text-white rounded hover:bg-[#e55a2b] transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Request</span>
          </button>
        </div>
      </div>
    </div>
  );
};
