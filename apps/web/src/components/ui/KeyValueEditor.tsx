'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { Input } from './Input';
import type { KeyValue } from '@apiforge/shared';

interface KeyValueEditorProps {
  items: KeyValue[];
  onChange: (items: KeyValue[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  showDescription?: boolean;
  className?: string;
}

export const KeyValueEditor: React.FC<KeyValueEditorProps> = ({
  items,
  onChange,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
  showDescription = true,
  className,
}) => {
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

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase">
        <span className="w-8"></span>
        <span className="flex-1">Key</span>
        <span className="flex-1">Value</span>
        {showDescription && <span className="flex-1">Description</span>}
        <span className="w-8"></span>
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
          
          <Input
            value={item.key}
            onChange={(e) => updateItem(index, 'key', e.target.value)}
            placeholder={keyPlaceholder}
            className="flex-1"
          />
          
          <Input
            value={item.value}
            onChange={(e) => updateItem(index, 'value', e.target.value)}
            placeholder={valuePlaceholder}
            className="flex-1"
          />
          
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
    </div>
  );
};
