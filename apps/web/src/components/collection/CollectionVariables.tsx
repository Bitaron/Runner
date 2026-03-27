'use client';

import React, { useState } from 'react';
import { Plus, RefreshCw, Save } from 'lucide-react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { KeyValueEditor } from '../ui/KeyValueEditor';
import type { Collection, Folder, Variable } from '@apiforge/shared';

interface CollectionVariablesProps {
  collection: Collection;
  folder?: Folder;
  onUpdateCollection: (updates: Partial<Collection>) => void;
  onUpdateFolder?: (folderId: string, updates: Partial<Folder>) => void;
}

export const CollectionVariables: React.FC<CollectionVariablesProps> = ({
  collection,
  folder,
  onUpdateCollection,
  onUpdateFolder,
}) => {
  const [variables, setVariables] = useState<Variable[]>(folder ? folder.variables : collection.variables || []);
  const [localVariables, setLocalVariables] = useState<Variable[]>(folder ? folder.variables : collection.variables || []);

  const handleVariableChange = (index: number, field: keyof Variable, value: string | boolean) => {
    const newVars = [...variables];
    newVars[index] = { ...newVars[index], [field]: value };
    setVariables(newVars);
  };

  const handleLocalVariableChange = (index: number, field: keyof Variable, value: string | boolean) => {
    const newVars = [...localVariables];
    newVars[index] = { ...newVars[index], [field]: value };
    setLocalVariables(newVars);
  };

  const handleAddVariable = () => {
    const newVar: Variable = { key: '', value: '', type: 'default', enabled: true };
    setVariables([...variables, newVar]);
    setLocalVariables([...localVariables, newVar]);
  };

  const handleRemoveVariable = (index: number) => {
    const newVars = variables.filter((_, i) => i !== index);
    const newLocalVars = localVariables.filter((_, i) => i !== index);
    setVariables(newVars);
    setLocalVariables(newLocalVars);
  };

  const handlePersistAll = () => {
    if (folder && onUpdateFolder) {
      onUpdateFolder(folder._id, { variables });
    } else {
      onUpdateCollection({ variables });
    }
  };

  const handleResetAll = () => {
    setLocalVariables(variables.map(v => ({ ...v, value: v.value })));
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">
          Variables defined here can be referenced in requests using &#123;&#123;variable_name&#125;&#125;
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
                ×
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
