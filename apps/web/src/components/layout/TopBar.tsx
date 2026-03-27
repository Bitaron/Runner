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
  User
} from 'lucide-react';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useAuthStore } from '@/stores/authStore';
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

  return (
    <div className="flex flex-col">
      {/* Top navigation bar */}
      <div className="flex items-center justify-between h-10 px-2 bg-[#262627] border-b border-[#3d3d3d]">
        {/* Left section */}
        <div className="flex items-center gap-1">
          <button className="p-2 text-gray-400 hover:text-white hover:bg-[#3d3d3d] rounded transition-colors">
            <Menu className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1">
            <button className="p-2 text-gray-400 hover:text-white hover:bg-[#3d3d3d] rounded transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button className="p-2 text-gray-400 hover:text-white hover:bg-[#3d3d3d] rounded transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <button className="flex items-center gap-1 px-2 py-1 text-sm text-gray-400 hover:text-white hover:bg-[#3d3d3d] rounded transition-colors">
            <Home className="w-4 h-4" />
            <span>Home</span>
          </button>
          <div className="relative">
            <button 
              onClick={() => setShowWorkspaces(!showWorkspaces)}
              className="flex items-center gap-1 px-2 py-1 text-sm text-gray-400 hover:text-white hover:bg-[#3d3d3d] rounded transition-colors"
            >
              <span>Workspaces</span>
              <ChevronDown className="w-3 h-3" />
            </button>
            {showWorkspaces && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-[#2d2d2e] border border-[#3d3d3d] rounded-lg shadow-xl z-50">
                {workspaces.map((ws) => (
                  <button
                    key={ws._id}
                    onClick={() => handleWorkspaceSelect(ws)}
                    className={cn(
                      "w-full px-3 py-2 text-sm text-left hover:bg-[#3d3d3d] transition-colors",
                      currentWorkspace?._id === ws._id ? "text-[#ff6b35]" : "text-gray-300"
                    )}
                  >
                    {ws.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="flex items-center gap-1 px-2 py-1 text-sm text-gray-400 hover:text-white hover:bg-[#3d3d3d] rounded transition-colors">
            <span>API Network</span>
          </button>
        </div>

        {/* Center section - Search */}
        <div className="flex-1 max-w-xl mx-4">
          <button
            onClick={onSearchOpen}
            className="flex items-center gap-2 w-full px-3 py-1.5 bg-[#1e1e1e] border border-[#3d3d3d] rounded-full text-sm text-gray-400 hover:border-[#ff6b35] transition-colors"
          >
            <Search className="w-4 h-4" />
            <span>Search</span>
            <kbd className="ml-auto px-1.5 py-0.5 text-xs bg-[#3d3d3d] rounded">⌘K</kbd>
          </button>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-1">
          <button 
            onClick={onTeamOpen}
            className="p-2 text-gray-400 hover:text-white hover:bg-[#3d3d3d] rounded transition-colors"
            title="Invite team members"
          >
            <Users className="w-4 h-4" />
          </button>
          <button 
            onClick={onSettingsOpen}
            className="p-2 text-gray-400 hover:text-white hover:bg-[#3d3d3d] rounded transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button 
            className="p-2 text-gray-400 hover:text-white hover:bg-[#3d3d3d] rounded transition-colors"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
          </button>
          <button className="flex items-center gap-1 px-3 py-1 text-sm bg-[#ff6b35] text-white rounded hover:bg-[#e55a2b] transition-colors">
            <Zap className="w-4 h-4" />
            Upgrade
          </button>
          <div className="flex items-center gap-2 ml-2 border-l border-[#3d3d3d] pl-2">
            <div className="relative" ref={userMenuRef}>
              <button 
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-white hover:bg-[#3d3d3d] rounded transition-colors p-1"
              >
                <div className="w-6 h-6 rounded-full bg-[#ff6b35] flex items-center justify-center text-white text-xs font-medium">
                  {user?.name?.[0] || 'U'}
                </div>
                <ChevronDown className="w-3 h-3" />
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
                    <User className="w-4 h-4" />
                    Profile Settings
                  </button>
                  <button 
                    onClick={() => {
                      logout();
                      window.location.href = '/login';
                    }}
                    className="w-full px-3 py-2 text-sm text-left text-gray-300 hover:bg-[#3d3d3d] flex items-center gap-2 transition-colors border-t border-[#3d3d3d]"
                  >
                    <LogOut className="w-4 h-4" />
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
