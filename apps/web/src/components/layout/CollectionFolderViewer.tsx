'use client';

import React from 'react';
import { ChevronRight, FileJson, FolderOpen, Plus, MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Collection, Folder, ApiRequest } from '@apiforge/shared';
import { Button } from '../ui/Button';

interface CollectionFolderViewerProps {
  type: 'collection' | 'folder';
  collection: Collection;
  folder?: Folder;
  onSelectRequest: (request: ApiRequest) => void;
  onCreateRequest?: () => void;
}

export const CollectionFolderViewer: React.FC<CollectionFolderViewerProps> = ({
  type,
  collection,
  folder,
  onSelectRequest,
  onCreateRequest,
}) => {
  const getMethodColor = (method: string) => {
    const colors: Record<string, string> = {
      GET: 'bg-green-600 text-white',
      POST: 'bg-[#ff6b35] text-white',
      PUT: 'bg-blue-600 text-white',
      PATCH: 'bg-yellow-600 text-white',
      DELETE: 'bg-red-600 text-white',
      HEAD: 'bg-gray-600 text-white',
      OPTIONS: 'bg-purple-600 text-white',
    };
    return colors[method] || 'bg-gray-600 text-white';
  };

  const requests = type === 'collection' ? collection.requests : folder?.requests || [];
  const subfolders = type === 'collection' ? collection.folders : folder?.folders || [];
  const currentName = type === 'collection' ? collection.name : folder?.name || '';

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#3d3d3d]">
        <div className="flex items-center gap-1 text-sm text-gray-400">
          <span className="hover:text-[#ff6b35] cursor-pointer">Collections</span>
          <ChevronRight className="w-4 h-4" />
          <span className="hover:text-[#ff6b35] cursor-pointer truncate max-w-[150px]">{collection.name}</span>
          {type === 'folder' && folder && (
            <>
              <ChevronRight className="w-4 h-4" />
              <span className="text-gray-200 truncate max-w-[150px]">{folder.name}</span>
            </>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1">
          {onCreateRequest && (
            <Button variant="secondary" size="sm" className="gap-1" onClick={onCreateRequest}>
              <Plus className="w-3.5 h-3.5" />
              Add Request
            </Button>
          )}
          <Button variant="ghost" size="sm" className="p-1">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {subfolders.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Folders</h3>
              <div className="space-y-1">
                {subfolders.map((subfolder) => (
                  <div
                    key={subfolder._id}
                    className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-[#2d2d2d] cursor-pointer transition-colors"
                  >
                    <FolderOpen className="w-4 h-4 text-blue-400" />
                    <span className="text-sm text-gray-300">{subfolder.name}</span>
                    <span className="ml-auto text-xs text-gray-500">{subfolder.requests.length} requests</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {requests.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Requests</h3>
              <div className="space-y-1">
                {requests.map((request) => (
                  <div
                    key={request._id}
                    onClick={() => onSelectRequest(request)}
                    className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-[#2d2d2d] cursor-pointer transition-colors"
                  >
                    <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded", getMethodColor(request.method))}>
                      {request.method}
                    </span>
                    <span className="text-sm text-gray-300 truncate flex-1">{request.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {requests.length === 0 && subfolders.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              <p className="mb-2">No requests in this {type}</p>
              {onCreateRequest && (
                <Button variant="secondary" size="sm" onClick={onCreateRequest}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Request
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
