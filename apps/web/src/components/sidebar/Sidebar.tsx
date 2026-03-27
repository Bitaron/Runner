'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { useCollectionsStore } from '@/stores/collectionsStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import {
  ChevronRight,
  ChevronDown,
  Plus,
  FolderOpen,
  FileJson,
  Clock,
  Settings,
  Trash2,
  MoreVertical,
  Search,
  Layers,
  Download,
  Grid3X3,
  Eye,
} from 'lucide-react';
import type { Collection, Folder, ApiRequest, Environment } from '@apiforge/shared';
import { Dropdown } from '../ui/Dropdown';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

interface SidebarProps {
  onSelectRequest: (request: ApiRequest, collectionId?: string, folderId?: string) => void;
  onSelectHistory: (request: ApiRequest) => void;
  onSelectCollection?: (collection: Collection) => void;
  onSelectFolder?: (collection: Collection, folder: Folder) => void;
  onSelectEnvironment?: (environment: Environment) => void;
  onSelectGlobals?: () => void;
  className?: string;
  onImport?: () => void;
  onNewCollection?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  onSelectRequest,
  onSelectHistory,
  onSelectCollection,
  onSelectFolder,
  onSelectEnvironment,
  onSelectGlobals,
  className,
  onImport,
  onNewCollection,
}) => {
  const [activeTab, setActiveTab] = useState<'collections' | 'history' | 'environments'>('collections');
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(new Set());
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewCollectionModal, setShowNewCollectionModal] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const { collections, addCollection, removeCollection } = useCollectionsStore();
  const { history } = useCollectionsStore();
  const { environments, currentEnvironment, setCurrentEnvironment } = useWorkspaceStore();

  const iconRailItems = [
    { id: 'collections', icon: Layers, label: 'Collections' },
    { id: 'environments', icon: Eye, label: 'Environments' },
    { id: 'history', icon: Clock, label: 'History' },
  ];

  const toggleCollection = (id: string) => {
    const newExpanded = new Set(expandedCollections);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedCollections(newExpanded);
  };

  const toggleFolder = (id: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedFolders(newExpanded);
  };

  const getMethodClass = (method: string) => {
    return cn('http-method', method.toLowerCase());
  };

  const handleCreateCollection = () => {
    if (!newCollectionName.trim()) return;
    
    const newCollection: Collection = {
      _id: `collection:${crypto.randomUUID()}`,
      type: 'collection',
      workspaceId: '',
      name: newCollectionName,
      variables: [],
      folders: [],
      requests: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: '',
    };
    
    addCollection(newCollection);
    setNewCollectionName('');
    setShowNewCollectionModal(false);
  };

  const renderFolder = (folder: Folder, collection: Collection, parentFolderId?: string, depth = 0) => {
    const isExpanded = expandedFolders.has(folder._id);
    const folderRequests = folder.requests.filter((r) =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.url.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <div key={folder._id} style={{ marginLeft: depth * 16 }}>
        <div
          className="flex items-center gap-1 px-2 py-1 hover:bg-[#333334] rounded cursor-pointer group"
        >
          <ChevronRight 
            className={cn('w-4 h-4 transition-transform', isExpanded && 'rotate-90')} 
            onClick={(e) => {
              e.stopPropagation();
              toggleFolder(folder._id);
            }}
          />
          <FolderOpen className="w-4 h-4 text-[#d4a574]" />
          <span 
            className="flex-1 text-sm truncate hover:text-[#ff6b35] transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onSelectFolder?.(collection, folder);
            }}
          >
            {folder.name}
          </span>
          <Dropdown
            trigger={
              <MoreVertical
                className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              />
            }
            items={[
              { id: 'rename', label: 'Rename' },
              { id: 'delete', label: 'Delete', danger: true },
            ]}
          />
        </div>
        {isExpanded && (
          <>
            {folderRequests.map((request) => (
              <div
                key={request._id}
                className="flex items-center gap-2 px-2 py-1 hover:bg-[#333334] rounded cursor-pointer ml-6"
                onClick={() => onSelectRequest(request, collectionId, folder._id)}
              >
                <span className={getMethodClass(request.method)}>{request.method}</span>
                <span className="flex-1 text-sm truncate">{request.name}</span>
              </div>
            ))}
            {folder.folders.map((subFolder) => renderFolder(subFolder, collection, folder._id, depth + 1))}
          </>
        )}
      </div>
    );
  };

  const renderCollection = (collection: Collection) => {
    const isExpanded = expandedCollections.has(collection._id);
    const filteredRequests = collection.requests.filter(
      (r) =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.url.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <div key={collection._id}>
        <div
          className="flex items-center gap-1 px-2 py-1 hover:bg-[#333334] rounded cursor-pointer group"
        >
          <ChevronRight 
            className={cn('w-4 h-4 transition-transform', isExpanded && 'rotate-90')} 
            onClick={(e) => {
              e.stopPropagation();
              toggleCollection(collection._id);
            }}
          />
          <FolderOpen className="w-4 h-4 text-[#d4a574]" />
          <span 
            className="flex-1 text-sm truncate hover:text-[#ff6b35] transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onSelectCollection?.(collection);
            }}
          >
            {collection.name}
          </span>
          <Dropdown
            trigger={
              <MoreVertical
                className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              />
            }
            items={[
              { id: 'rename', label: 'Rename' },
              { id: 'addFolder', label: 'Add Folder' },
              { id: 'addRequest', label: 'Add Request' },
              { id: 'export', label: 'Export' },
              { id: 'delete', label: 'Delete', danger: true },
            ]}
          />
        </div>
        {isExpanded && (
          <>
            {filteredRequests.map((request) => (
              <div
                key={request._id}
                className="flex items-center gap-2 px-2 py-1 hover:bg-[#333334] rounded cursor-pointer ml-6"
                onClick={() => onSelectRequest(request, collection._id)}
              >
                <span className={getMethodClass(request.method)}>{request.method}</span>
                <span className="flex-1 text-sm truncate">{request.name}</span>
              </div>
            ))}
            {collection.folders.map((folder) => renderFolder(folder, collection))}
          </>
        )}
      </div>
    );
  };

  return (
    <div className={cn('flex h-full bg-[#262627]', className)}>
      {/* Icon rail */}
      <div className="w-10 flex flex-col items-center py-2 border-r border-[#3a3a3b] bg-[#1e1e1e]">
        {iconRailItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === 'collections') setActiveTab('collections');
                else if (item.id === 'environments') setActiveTab('environments');
                else if (item.id === 'history') setActiveTab('history');
              }}
              className={cn(
                "p-2 mb-1 rounded transition-colors",
                activeTab === item.id
                  ? "text-[#ff6b35] bg-[#3d3d3e]"
                  : "text-gray-400 hover:text-white hover:bg-[#3d3d3e]"
              )}
              title={item.label}
            >
              <Icon className="w-5 h-5" />
            </button>
          );
        })}
      </div>

      {/* Main sidebar content */}
      <div className="flex-1 flex flex-col border-r border-[#3a3a3b]">
        {/* New + Import buttons */}
        <div className="flex items-center gap-2 px-2 py-2 border-b border-[#3a3a3b]">
          <button
            onClick={() => onNewCollection ? onNewCollection() : setShowNewCollectionModal(true)}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium bg-[#ff6b35] text-white rounded hover:bg-[#e55a2b] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New
          </button>
          <button
            onClick={onImport}
            className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-gray-300 bg-[#3d3d3d] rounded hover:bg-[#4d4d4d] transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Import
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[#3a3a3b]">
          <button
            onClick={() => setActiveTab('collections')}
            className={cn(
              'flex-1 py-1.5 text-xs font-medium rounded transition-colors',
              activeTab === 'collections' ? 'bg-[#3d3d3e] text-white' : 'text-gray-400 hover:text-white'
            )}
          >
            Collections
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={cn(
              'flex-1 py-1.5 text-xs font-medium rounded transition-colors',
              activeTab === 'history' ? 'bg-[#3d3d3e] text-white' : 'text-gray-400 hover:text-white'
            )}
          >
            History
          </button>
          <button
            onClick={() => setActiveTab('environments')}
            className={cn(
              'flex-1 py-1.5 text-xs font-medium rounded transition-colors',
              activeTab === 'environments' ? 'bg-[#3d3d3e] text-white' : 'text-gray-400 hover:text-white'
            )}
          >
            Env
          </button>
        </div>
      </div>

      <div className="p-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="w-full pl-9 pr-3 py-1.5 bg-[#1e1e1e] border border-[#3d3d3d] rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[#ff6b35]"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'collections' && (
          <div className="p-2">
            <button
              onClick={() => setShowNewCollectionModal(true)}
              className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-[#333334] rounded transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Collection
            </button>
            {collections.map((collection) => renderCollection(collection))}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="p-2">
            {history.length === 0 ? (
              <p className="text-center text-gray-500 text-sm py-4">No history yet</p>
            ) : (
              history.map((request, index) => (
                <div
                  key={`${request._id}-${index}`}
                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-[#333334] rounded cursor-pointer"
                  onClick={() => onSelectHistory(request)}
                >
                  <Clock className="w-4 h-4 text-gray-500" />
                  <span className={getMethodClass(request.method)}>{request.method}</span>
                  <span className="flex-1 text-sm truncate">{request.name || request.url || 'Untitled'}</span>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'environments' && (
          <div className="p-2">
            {environments.length === 0 ? (
              <p className="text-center text-gray-500 text-sm py-4">No environments</p>
            ) : (
              environments.map((env) => (
                <div
                  key={env._id}
                  onClick={() => onSelectEnvironment?.(env)}
                  className={cn(
                    'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer group',
                    currentEnvironment?._id === env._id
                      ? 'bg-[#3d3d3e] border-l-2 border-[#ff6b35]'
                      : 'hover:bg-[#333334] text-gray-300'
                  )}
                >
                  <Eye className="w-4 h-4 text-gray-400" />
                  <span className="flex-1 text-sm truncate">{env.name}</span>
                </div>
              ))
            )}
            <button
              onClick={() => {
                const newEnv: Environment = {
                  _id: `environment:${crypto.randomUUID()}`,
                  type: 'environment',
                  workspaceId: currentWorkspace?._id || '',
                  name: 'New Environment',
                  variables: [],
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  isGlobal: false,
                };
                useWorkspaceStore.getState().addEnvironment(newEnv);
              }}
              className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-[#333334] rounded transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Environment
            </button>
            <div className="pt-2 mt-2 border-t border-[#3a3a3b]">
              <button
                onClick={() => onSelectGlobals?.()}
                className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-[#333334] rounded transition-colors"
              >
                <Eye className="w-4 h-4" />
                <span>Globals</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="p-2 border-t border-[#3a3a3b]">
        <button className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-[#333334] rounded transition-colors">
          <Settings className="w-4 h-4" />
          Settings
        </button>
      </div>

      <Modal
        isOpen={showNewCollectionModal}
        onClose={() => setShowNewCollectionModal(false)}
        title="New Collection"
      >
        <div className="space-y-4">
          <Input
            label="Collection Name"
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.target.value)}
            placeholder="My Collection"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowNewCollectionModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateCollection}>Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
