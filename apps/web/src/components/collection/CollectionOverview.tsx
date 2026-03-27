'use client';

import React, { useState } from 'react';
import { FileJson, Layers, FolderOpen, Clock, User } from 'lucide-react';
import { Input } from '../ui/Input';
import type { Collection, Folder } from '@apiforge/shared';

interface CollectionOverviewProps {
  collection: Collection;
  folder?: Folder;
  onUpdateCollection: (updates: Partial<Collection>) => void;
  onUpdateFolder?: (folderId: string, updates: Partial<Folder>) => void;
}

export const CollectionOverview: React.FC<CollectionOverviewProps> = ({
  collection,
  folder,
  onUpdateCollection,
  onUpdateFolder,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [name, setName] = useState(folder ? folder.name : collection.name);
  const [description, setDescription] = useState(folder?.description || collection.description || '');

  const handleNameSave = () => {
    if (folder && onUpdateFolder) {
      onUpdateFolder(folder._id, { name });
    } else {
      onUpdateCollection({ name });
    }
    setIsEditingName(false);
  };

  const handleDescriptionSave = () => {
    if (folder && onUpdateFolder) {
      onUpdateFolder(folder._id, { description });
    } else {
      onUpdateCollection({ description });
    }
  };

  const getRequestCount = () => {
    if (folder) {
      return folder.requests.length;
    }
    let count = collection.requests.length;
    const countInFolders = (folders: Folder[]): number => {
      return folders.reduce((acc, f) => {
        return acc + f.requests.length + countInFolders(f.folders);
      }, 0);
    };
    return count + countInFolders(collection.folders);
  };

  const getFolderCount = () => {
    if (folder) {
      return folder.folders.length;
    }
    const countFolders = (folders: Folder[]): number => {
      return folders.reduce((acc, f) => {
        return acc + 1 + countFolders(f.folders);
      }, 0);
    };
    return countFolders(collection.folders);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return `${Math.floor(days / 30)} months ago`;
  };

  const target = folder || collection;

  return (
    <div className="p-4 space-y-6">
      {/* Name */}
      <div>
        {isEditingName ? (
          <div className="flex items-center gap-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleNameSave}
              onKeyDown={(e) => e.key === 'Enter' && handleNameSave()}
              autoFocus
              className="text-xl font-bold"
            />
          </div>
        ) : (
          <h2
            onClick={() => setIsEditingName(true)}
            className="text-xl font-bold text-white cursor-pointer hover:text-[#ff6b35] transition-colors"
          >
            {target.name}
          </h2>
        )}
      </div>

      {/* Description */}
      <div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={handleDescriptionSave}
          placeholder="Add a description..."
          className="w-full p-3 bg-[#2d2d2e] border border-[#3d3d3d] rounded-md text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:border-[#ff6b35] resize-none min-h-[80px]"
        />
      </div>

      {/* Stats */}
      <div className="flex items-center gap-6 p-4 bg-[#2d2d2e] rounded-lg">
        <div className="flex items-center gap-2">
          <FileJson className="w-5 h-5 text-gray-400" />
          <span className="text-sm text-gray-300">{getRequestCount()} requests</span>
        </div>
        <div className="flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-gray-400" />
          <span className="text-sm text-gray-300">{getFolderCount()} folders</span>
        </div>
      </div>

      {/* Created info */}
      <div className="space-y-3 pt-4 border-t border-[#3d3d3d]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <User className="w-4 h-4" />
            <span>Created by</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#ff6b35] flex items-center justify-center text-white text-xs">
              {target.createdBy?.[0]?.toUpperCase() || 'U'}
            </div>
            <span className="text-sm text-gray-300">{target.createdBy || 'Unknown'}</span>
            <span className="text-sm text-gray-500">{formatDate(target.createdAt)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Clock className="w-4 h-4" />
            <span>Last modified</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#ff6b35] flex items-center justify-center text-white text-xs">
              {target.createdBy?.[0]?.toUpperCase() || 'U'}
            </div>
            <span className="text-sm text-gray-300">{target.createdBy || 'Unknown'}</span>
            <span className="text-sm text-gray-500">{getRelativeTime(target.updatedAt)}</span>
          </div>
        </div>
      </div>

      {/* Collection ID */}
      <div className="pt-4 border-t border-[#3d3d3d]">
        <p className="text-xs text-gray-500">
          Collection ID: <code className="bg-[#2d2d2e] px-2 py-1 rounded">{collection._id}</code>
        </p>
      </div>
    </div>
  );
};
