'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { apiClient } from '@/lib/api';
import { getMethodColor } from '@/lib/methodColors';
import { Search, FileJson, Globe, Folder, X, Loader2 } from 'lucide-react';
import { useCollectionsStore } from '@/stores/collectionsStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { ApiRequest, Collection, Folder as FolderType } from '@apiforge/shared';

interface SearchResult {
  type: 'collection' | 'request' | 'folder' | 'environment' | 'history';
  id: string;
  name: string;
  url?: string;
  collectionId?: string;
  collectionName?: string;
  method?: string;
  workspaceId?: string;
}

interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
}

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRequest: (request: ApiRequest, collectionId?: string) => void;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ isOpen, onClose, onSelectRequest }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchType, setSearchType] = useState<'all' | 'request' | 'collection' | 'environment' | 'history'>('all');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { collections } = useCollectionsStore();

  const isMac =
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
  const shortcutHint = isMac ? '⌘K' : 'Ctrl K';

  const breadcrumbPaths = useMemo(() => {
    const map = new Map<string, string>();
    const walk = (folders: FolderType[], path: string[]) => {
      folders.forEach((folder) => {
        const nextPath = [...path, folder.name];
        folder.requests.forEach((r) => map.set(r._id, nextPath.join(' › ')));
        walk(folder.folders, nextPath);
      });
    };
    collections.forEach((c) => {
      walk(c.folders, [c.name]);
    });
    return map;
  }, [collections]);

  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiClient.get<SearchResponse>('/api/search', {
        q: searchQuery,
        type: searchType,
      });
      
      if (response.success && response.data) {
        setResults(response.data.results);
        setSelectedIndex(0);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [searchType]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      handleSearch(query);
    }, 300);

    return () => clearTimeout(debounce);
  }, [query, handleSearch]);

  const handleSelect = (result: SearchResult) => {
    if (result.type === 'request') {
      const request = collections
        .flatMap((c) => [c, ...c.folders.flatMap((f) => [f, ...f.folders])])
        .flatMap((f) => f.requests)
        .find((r) => r._id === result.id);

      if (request) {
        onSelectRequest(request, result.collectionId);
      }
    } else if (result.type === 'environment') {
      const env = useWorkspaceStore.getState().environments.find(e => e._id === result.id);
      if (env) useWorkspaceStore.getState().setCurrentEnvironment(env);
    } else if (result.type === 'history') {
      // history selection: try to find matching request in local history or collections
      const hist = useCollectionsStore.getState().history.find(h => h._id === result.id) as ApiRequest | undefined;
      // fall back to server history result's url/method to create temp request
      if (hist) onSelectRequest(hist);
      else {
        const temp: ApiRequest = {
          _id: `request:${result.id}`,
          type: 'request',
          workspaceId: result.workspaceId || '',
          name: result.name,
          method: (result.method as ApiRequest['method']) || 'GET',
          url: result.url || '',
          params: [],
          headers: [],
          body: { mode: 'none' },
          auth: { type: 'none', inheritFromParent: true },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: '',
        };
        onSelectRequest(temp);
      }
    }
    onClose();
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      handleSelect(results[selectedIndex]);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'collection':
        return <FileJson className="w-4 h-4 text-[#d4a574]" />;
      case 'folder':
        return <Folder className="w-4 h-4 text-yellow-500" />;
      case 'request':
        return <Globe className="w-4 h-4 text-[#61affe]" />;
      case 'environment':
        return <Search className="w-4 h-4 text-green-400" />;
      case 'history':
        return <Search className="w-4 h-4 text-orange-400" />;
      default:
        return <Search className="w-4 h-4" />;
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Search" size="lg">
      <div className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search by name or URL..."
              autoComplete="off"
              spellCheck={false}
              className="w-full pl-10 pr-4 py-3 bg-[#2d2d2d] border border-[#3d3d3d] rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[#ff6b35]"
              autoFocus
            />
            {isLoading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 animate-spin" />
            )}
          </div>
          <Select
            value={searchType}
            onChange={(e) => setSearchType(e.target.value as typeof searchType)}
            options={[
              { value: 'all', label: 'All' },
              { value: 'request', label: 'Requests' },
              { value: 'collection', label: 'Collections' },
              { value: 'environment', label: 'Environments' },
              { value: 'history', label: 'History' },
            ]}
            className="w-36"
          />
        </div>

        <div className="max-h-96 overflow-y-auto">
          {results.length > 0 ? (
            <div className="space-y-1">
              {results.map((result, index) => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => handleSelect(result)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    index === selectedIndex
                      ? 'bg-[#3d3d3d]'
                      : 'hover:bg-[#2d2d2d]'
                  }`}
                >
                  {getIcon(result.type)}
                  <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                      {result.method && (
                        <span
                          className="text-xs font-bold"
                          style={{ color: getMethodColor(result.method) }}
                        >
                          {result.method}
                        </span>
                      )}
                      <span className="text-gray-200 truncate">{result.name}</span>
                    </div>
                    {(breadcrumbPaths.get(result.id) || result.collectionName) && (
                      <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                        <FileJson className="w-3 h-3 shrink-0" />
                        <span className="truncate">
                          {breadcrumbPaths.get(result.id) ?? result.collectionName}
                        </span>
                      </div>
                    )}
                  </div>
                  {result.url && (
                    <span className="text-xs text-gray-500 truncate max-w-48">
                      {result.url}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : query.trim() && !isLoading ? (
            <div className="text-center py-8 text-gray-500">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No results found for &quot;{query}&quot;</p>
              <p className="text-sm mt-1">Try a different search term</p>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Start typing to search</p>
              <div className="text-sm mt-4 space-y-1">
                <p className="text-gray-600">Search by:</p>
                <p>Request name or URL</p>
                <p>Collection name</p>
                <p>Folder name</p>
                <p>Variable names</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500 border-t border-[#3d3d3d] pt-3">
          <div className="flex items-center gap-4">
            <span>↑↓ Navigate</span>
            <span>Enter Select</span>
            <span>Esc Close</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <kbd className="border border-[#3d3d3d] rounded px-1.5 py-0.5 text-[10px] font-mono bg-[#2d2d2d] text-gray-500">
                {shortcutHint}
              </kbd>
              to toggle
            </span>
            <span>{results.length} results</span>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export const SearchShortcut: React.FC<{ onOpen: () => void }> = ({ onOpen }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpen]);

  return null;
};
