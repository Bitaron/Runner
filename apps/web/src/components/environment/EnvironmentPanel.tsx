'use client';

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronRight, Eye, Pencil, Copy, Trash2, Share2, MoreVertical, Check } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { EnvironmentVariables } from './EnvironmentVariables';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { Environment, Variable } from '@apiforge/shared';

interface EnvironmentPanelProps {
  environment: Environment;
  isGlobals?: boolean;
  onClose: () => void;
  onUpdate: (updates: Partial<Environment>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export const EnvironmentPanel: React.FC<EnvironmentPanelProps> = ({
  environment,
  isGlobals = false,
  onClose,
  onUpdate,
  onDelete,
  onDuplicate,
}) => {
  const { currentEnvironment, setCurrentEnvironment } = useWorkspaceStore();
  const [isEditingName, setIsEditingName] = useState(false);
  const [name, setName] = useState(environment.name);
  const [justDuplicated, setJustDuplicated] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const duplicateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isActive = !isGlobals && currentEnvironment?._id === environment._id;

  useEffect(() => {
    return () => {
      if (duplicateTimeoutRef.current) clearTimeout(duplicateTimeoutRef.current);
    };
  }, []);

  const handleNameSave = () => {
    onUpdate({ name });
    setIsEditingName(false);
  };

  const handleDuplicate = () => {
    if (isGlobals) return;
    onDuplicate();
    setJustDuplicated(true);
    headerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (duplicateTimeoutRef.current) clearTimeout(duplicateTimeoutRef.current);
    duplicateTimeoutRef.current = setTimeout(() => setJustDuplicated(false), 2000);
  };

  return (
    <div className="flex flex-col h-full w-full max-w-[500px] sm:w-[320px] md:w-[380px] lg:w-[500px] bg-[#1e1e1e]">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#3d3d3d]">
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <ChevronRight className="w-5 h-5 rotate-90" />
        </button>
        <div className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-[#ff6b35]" />
          <span className="text-gray-400 text-sm">{isGlobals ? 'Globals' : 'Environment'}</span>
        </div>
        {!isGlobals && (
          <>
            <ChevronRight className="w-4 h-4 text-gray-600" />
            <span className="text-white font-medium truncate">{environment.name}</span>
          </>
        )}
      </div>

      {/* Environment content */}
      {!isGlobals ? (
        <>
          {/* Environment Name Header */}
          <div
            ref={headerRef}
            className={cn(
              'relative px-4 py-3 border-b border-[#3d3d3d] transition-colors',
              justDuplicated && 'bg-[#ff6b35]/10'
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                {isEditingName ? (
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={handleNameSave}
                    onKeyDown={(e) => e.key === 'Enter' && handleNameSave()}
                    autoFocus
                    className="text-xl font-bold"
                  />
                ) : (
                  <h2
                    onClick={() => setIsEditingName(true)}
                    className="text-xl font-bold text-white cursor-pointer hover:text-[#ff6b35] transition-colors"
                  >
                    {environment.name}
                  </h2>
                )}
                <p className="text-sm text-gray-500">Personal</p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" title="Share">
                  <Share2 className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" title="Duplicate" onClick={handleDuplicate}>
                  <Copy className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" title="Delete" onClick={onDelete}>
                  <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-400" />
                </Button>
                <Button variant="ghost" size="sm" title="More">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            {/* Active toggle */}
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => setCurrentEnvironment(isActive ? null : environment)}
                className={cn(
                  'flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors',
                  isActive 
                    ? 'bg-[#ff6b35] text-white' 
                    : 'bg-[#3d3d3d] text-gray-300 hover:bg-[#4d4d4d]'
                )}
              >
                <Check className="w-4 h-4" />
                Set as active environment
              </button>
            </div>

            {justDuplicated && (
              <div className="absolute top-3 right-4 flex items-center gap-1 px-2 py-1 rounded bg-[#ff6b35] text-white text-xs font-medium shadow-lg pointer-events-none">
                <Check className="w-3 h-3" />
                Duplicated
              </div>
            )}
          </div>

          {/* Variables */}
          <div className="flex-1 overflow-y-auto">
            <EnvironmentVariables
              environment={environment}
              onUpdate={onUpdate}
              isGlobals={false}
            />
          </div>
        </>
      ) : (
        /* Globals */
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-3 border-b border-[#3d3d3d]">
            <h2 className="text-xl font-bold text-white">Globals</h2>
            <p className="text-sm text-gray-500">Variables accessible across all environments</p>
          </div>
          <EnvironmentVariables
            environment={environment}
            onUpdate={onUpdate}
            isGlobals={true}
          />
        </div>
      )}
    </div>
  );
};