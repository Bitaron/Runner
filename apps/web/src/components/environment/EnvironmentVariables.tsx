'use client';

import React, { useState, useCallback } from 'react';
import { Eye, Plus, RefreshCw, Save, Trash2, Copy, Pencil, Share2, MoreVertical } from 'lucide-react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Select } from '../ui/Select';
import { cn } from '@/lib/utils';
import type { Environment, Variable } from '@apiforge/shared';

interface EnvironmentVariablesProps {
  environment: Environment;
  onUpdate: (updates: Partial<Environment>) => void;
  isGlobals?: boolean;
}

export const EnvironmentVariables: React.FC<EnvironmentVariablesProps> = ({
  environment,
  onUpdate,
  isGlobals = false,
}) => {
  const [variables, setVariables] = useState<Variable[]>(environment.variables || []);
  const [localVariables, setLocalVariables] = useState<Variable[]>(environment.variables || []);
  const [hasChanges, setHasChanges] = useState(false);

  const handleVariableChange = (index: number, field: keyof Variable, value: string | boolean) => {
    const newVars = [...variables];
    newVars[index] = { ...newVars[index], [field]: value };
    setVariables(newVars);
    setHasChanges(true);
  };

  const handleLocalVariableChange = (index: number, field: keyof Variable, value: string | boolean) => {
    const newVars = [...localVariables];
    newVars[index] = { ...newVars[index], [field]: value };
    setLocalVariables(newVars);
    setHasChanges(true);
  };

  const handleAddVariable = () => {
    const newVar: Variable = { key: '', value: '', type: 'default', enabled: true };
    setVariables([...variables, newVar]);
    setLocalVariables([...localVariables, newVar]);
    setHasChanges(true);
  };

  const handleRemoveVariable = (index: number) => {
    const newVars = variables.filter((_, i) => i !== index);
    const newLocalVars = localVariables.filter((_, i) => i !== index);
    setVariables(newVars);
    setLocalVariables(newLocalVars);
    setHasChanges(true);
  };

  const handlePersistAll = () => {
    setVariables([...localVariables]);
    setHasChanges(true);
  };

  const handleResetAll = () => {
    setLocalVariables([...variables]);
    setHasChanges(false);
  };

  const handleSave = () => {
    onUpdate({ variables: localVariables });
    setVariables([...localVariables]);
    setHasChanges(false);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">
          Variables defined here can be referenced in requests using {'{{variable_name}}'}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleResetAll}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Reset All
          </Button>
          <Button variant="ghost" size="sm" onClick={handlePersistAll}>
            <Save className="w-4 h-4 mr-1" />
            Persist All
          </Button>
          <Button 
            size="sm" 
            onClick={handleSave}
            disabled={!hasChanges}
            className={cn(hasChanges && "bg-[#ff6b35] hover:bg-[#e55a2b]")}
          >
            Save
            {hasChanges && <span className="ml-1">•</span>}
          </Button>
        </div>
      </div>

      {/* Initial Values (synced to server) */}
      <div>
        <h3 className="text-sm font-medium text-gray-300 mb-2">Initial Values</h3>
        <p className="text-xs text-gray-500 mb-3">Synced to Postman servers and shared with your team</p>
        
        <div className="space-y-2">
          {variables.map((variable, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={variable.enabled}
                onChange={(e) => handleVariableChange(index, 'enabled', e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-[#2d2d2e]"
              />
              <Input
                value={variable.key}
                onChange={(e) => handleVariableChange(index, 'key', e.target.value)}
                placeholder="Variable name"
                className="flex-1"
              />
              <Input
                value={variable.value}
                onChange={(e) => handleVariableChange(index, 'value', e.target.value)}
                placeholder="Initial value"
                className="flex-1"
              />
              <select
                value={variable.type}
                onChange={(e) => handleVariableChange(index, 'type', e.target.value)}
                className="px-2 py-1.5 bg-[#2d2d2e] border border-[#3d3d3d] rounded text-sm text-gray-300"
              >
                <option value="default">Default</option>
                <option value="secret">Secret</option>
              </select>
              <Button variant="ghost" size="sm" onClick={() => handleRemoveVariable(index)}>
                <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-400" />
              </Button>
            </div>
          ))}
          
          <Button variant="ghost" size="sm" onClick={handleAddVariable}>
            <Plus className="w-4 h-4 mr-1" />
            Add Variable
          </Button>
        </div>
      </div>

      {/* Current Values (local only) */}
      <div>
        <h3 className="text-sm font-medium text-gray-300 mb-2">Current Values</h3>
        <p className="text-xs text-gray-500 mb-3">Local only - never synced to servers</p>
        
        <div className="space-y-2">
          {localVariables.map((variable, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="w-4" />
              <Input
                value={variable.key}
                disabled
                placeholder="Variable name"
                className="flex-1"
              />
              <Input
                value={variable.value}
                onChange={(e) => handleLocalVariableChange(index, 'value', e.target.value)}
                placeholder="Current value"
                type={variable.type === 'secret' ? 'password' : 'text'}
                className="flex-1"
              />
              <div className="w-20" />
              <div className="w-8" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

interface EnvironmentListProps {
  environments: Environment[];
  currentEnvironment: Environment | null;
  onSelectEnvironment: (env: Environment) => void;
  onAddEnvironment: () => void;
  onSelectGlobals: () => void;
}

export const EnvironmentList: React.FC<EnvironmentListProps> = ({
  environments,
  currentEnvironment,
  onSelectEnvironment,
  onAddEnvironment,
  onSelectGlobals,
}) => {
  return (
    <div className="p-2 space-y-1">
      {/* Environments */}
      {environments.map((env) => (
        <div
          key={env._id}
          onClick={() => onSelectEnvironment(env)}
          className={cn(
            'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer group',
            currentEnvironment?._id === env._id 
              ? 'bg-[#3d3d3e] border-l-2 border-[#ff6b35]' 
              : 'hover:bg-[#333334]'
          )}
        >
          <Eye className="w-4 h-4 text-gray-400" />
          <span className="flex-1 text-sm truncate">{env.name}</span>
          <button 
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#4d4d4d] rounded"
            onClick={(e) => e.stopPropagation()}
          >
            <Pencil className="w-3.5 h-3.5 text-gray-400" />
          </button>
          <button 
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#4d4d4d] rounded"
            onClick={(e) => e.stopPropagation()}
          >
            <Copy className="w-3.5 h-3.5 text-gray-400" />
          </button>
          <button 
            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#4d4d4d] rounded"
            onClick={(e) => e.stopPropagation()}
          >
            <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-400" />
          </button>
        </div>
      ))}

      <button
        onClick={onAddEnvironment}
        className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-[#333334] rounded transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add Environment
      </button>

      {/* Globals */}
      <div className="pt-2 mt-2 border-t border-[#3a3a3b]">
        <button
          onClick={onSelectGlobals}
          className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-[#333334] rounded transition-colors"
        >
          <Eye className="w-4 h-4" />
          <span>Globals</span>
        </button>
      </div>
    </div>
  );
};