'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronRight, Eye, Pencil, Copy, Trash2, Share2, MoreVertical, Check } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { EnvironmentVariables } from './EnvironmentVariables';
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
  const [isEditingName, setIsEditingName] = useState(false);
  const [name, setName] = useState(environment.name);
  const [isActive, setIsActive] = useState(false);

  const handleNameSave = () => {
    onUpdate({ name });
    setIsEditingName(false);
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e]">
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
          <div className="px-4 py-3 border-b border-[#3d3d3d]">
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
                <Button variant="ghost" size="sm" title="Duplicate" onClick={onDuplicate}>
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
                onClick={() => setIsActive(!isActive)}
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