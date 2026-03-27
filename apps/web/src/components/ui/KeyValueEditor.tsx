'use client';

import React, { useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Plus, Trash2, GripVertical, Wand2, X } from 'lucide-react';
import { Input } from './Input';
import { Modal } from './Modal';
import type { KeyValue } from '@apiforge/shared';

interface KeyValueEditorProps {
  items: KeyValue[];
  onChange: (items: KeyValue[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  showDescription?: boolean;
  className?: string;
  variables?: Array<{ key: string; value: string; scope?: 'environment' | 'global' | 'local' }>;
}

export const KeyValueEditor: React.FC<KeyValueEditorProps> = ({
  items,
  onChange,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
  showDescription = true,
  className,
  variables = [],
}) => {
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkEditText, setBulkEditText] = useState('');
  const [autocompleteIndex, setAutocompleteIndex] = useState<{ row: number; field: 'key' | 'value' } | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionFilter, setSuggestionFilter] = useState('');
  const [focusedRow, setFocusedRow] = useState<number>(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const addItem = () => {
    onChange([...items, { key: '', value: '', description: '', disabled: false }]);
  };

  const updateItem = (index: number, field: keyof KeyValue, value: string | boolean) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    onChange(newItems);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const openBulkEdit = () => {
    const text = items
      .map(item => `${item.key}: ${item.value}`)
      .join('\n');
    setBulkEditText(text);
    setShowBulkEdit(true);
  };

  const saveBulkEdit = () => {
    const newItems: KeyValue[] = [];
    const lines = bulkEditText.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        newItems.push({
          key: line.substring(0, colonIndex).trim(),
          value: line.substring(colonIndex + 1).trim(),
          description: '',
          disabled: false,
        });
      } else if (line.trim()) {
        newItems.push({
          key: line.trim(),
          value: '',
          description: '',
          disabled: false,
        });
      }
    }
    
    onChange(newItems);
    setShowBulkEdit(false);
  };

  const getSuggestions = (value: string) => {
    if (!value || value.length < 2 || !variables) return [];
    return variables
      .filter(v => v.key.toLowerCase().includes(value.toLowerCase()))
      .slice(0, 5);
  };

  const insertVariable = (variable: { key: string; value: string }, row: number, field: 'key' | 'value') => {
    const prefix = field === 'key' ? '' : '{{';
    const suffix = field === 'key' ? '' : '}}';
    updateItem(row, field, prefix + variable.key + suffix);
    setShowSuggestions(false);
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase">
          <span className="w-8"></span>
          <span className="flex-1">Key</span>
          <span className="flex-1">Value</span>
          {showDescription && <span className="flex-1">Description</span>}
          <span className="w-8"></span>
        </div>
        {variables && variables.length > 0 && (
          <button
            onClick={openBulkEdit}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-[#ff6b35] transition-colors"
          >
            <Wand2 className="w-3 h-3" />
            Bulk Edit
          </button>
        )}
      </div>
      
      {items.map((item, index) => (
        <div
          key={index}
          className={cn(
            'flex items-center gap-2 group',
            item.disabled && 'opacity-50'
          )}
        >
          <button
            onClick={() => updateItem(index, 'disabled', !item.disabled)}
            className={cn(
              'w-8 flex items-center justify-center cursor-grab text-gray-500 hover:text-gray-300',
              item.disabled && 'line-through'
            )}
          >
            <GripVertical className="w-4 h-4" />
          </button>
          
          <div className="flex-1 relative">
            <Input
              value={item.key}
              onChange={(e) => updateItem(index, 'key', e.target.value)}
              placeholder={keyPlaceholder}
              className="flex-1"
              onFocus={() => setFocusedRow(index)}
              onKeyDown={(e) => {
                if (e.key === '{' || e.key === '{{') {
                  setSuggestionFilter('');
                  setShowSuggestions(true);
                  setAutocompleteIndex({ row: index, field: 'key' });
                }
              }}
            />
            {focusedRow === index && variables && variables.length > 0 && item.key && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-[#2d2d2e] border border-[#3d3d3d] rounded-lg shadow-xl z-10">
                {getSuggestions(item.key).map(v => (
                  <button
                    key={v.key}
                    onClick={() => insertVariable(v, index, 'key')}
                    className="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-[#3d3d3d] flex items-center justify-between"
                  >
                    <span className="font-mono text-[#ff6b35]">{`{{${v.key}}}`}</span>
                    <span className="text-xs text-gray-500 truncate">{v.value}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <div className="flex-1 relative">
            <Input
              value={item.value}
              onChange={(e) => updateItem(index, 'value', e.target.value)}
              placeholder={valuePlaceholder}
              className="flex-1"
              onFocus={() => setFocusedRow(index)}
              onKeyDown={(e) => {
                if (e.key === '{' || e.key === '{{') {
                  setSuggestionFilter('');
                  setShowSuggestions(true);
                  setAutocompleteIndex({ row: index, field: 'value' });
                }
              }}
            />
            {focusedRow === index && variables && variables.length > 0 && item.value && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-[#2d2d2e] border border-[#3d3d3d] rounded-lg shadow-xl z-10">
                {getSuggestions(item.value).map(v => (
                  <button
                    key={v.key}
                    onClick={() => insertVariable(v, index, 'value')}
                    className="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-[#3d3d3d] flex items-center justify-between"
                  >
                    <span className="font-mono text-[#ff6b35]">{`{{${v.key}}}`}</span>
                    <span className="text-xs text-gray-500 truncate">{v.value}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {showDescription && (
            <Input
              value={item.description || ''}
              onChange={(e) => updateItem(index, 'description', e.target.value)}
              placeholder="Description"
              className="flex-1"
            />
          )}
          
          <button
            onClick={() => removeItem(index)}
            className="w-8 flex items-center justify-center text-gray-500 hover:text-[#f44336] transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      
      <button
        onClick={addItem}
        className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add
      </button>

      <Modal
        isOpen={showBulkEdit}
        onClose={() => setShowBulkEdit(false)}
        title="Bulk Edit"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-400">Edit key-value pairs as text. Each line should be in the format: <code className="text-[#ff6b35]">key: value</code></p>
          <textarea
            value={bulkEditText}
            onChange={(e) => setBulkEditText(e.target.value)}
            className="w-full h-64 p-3 bg-[#1e1e1e] border border-[#3d3d3d] rounded-md font-mono text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[#ff6b35] resize-none"
            placeholder="key1: value1&#10;key2: value2"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowBulkEdit(false)}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveBulkEdit}
              className="px-4 py-2 text-sm bg-[#ff6b35] text-white rounded hover:bg-[#e55a2b] transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
