'use client';

import React, { useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, ExternalLink } from 'lucide-react';

interface VariableTooltipProps {
  variableName: string;
  resolvedValue: string | null;
  scope: 'global' | 'environment' | 'collection' | 'local' | 'data';
  isUnresolved?: boolean;
  onEdit?: () => void;
}

export const VariableTooltip: React.FC<VariableTooltipProps> = ({
  variableName,
  resolvedValue,
  scope,
  isUnresolved = false,
  onEdit,
}) => {
  const scopeColors = {
    global: 'bg-purple-600',
    environment: 'bg-blue-600',
    collection: 'bg-yellow-600',
    local: 'bg-green-600',
    data: 'bg-[#ff6b35]',
  };

  return (
    <div className="absolute z-50 mt-1 w-64 bg-[#2d2d2e] border border-[#3d3d3d] rounded-lg shadow-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-white">{variableName}</span>
      </div>
      
      {isUnresolved ? (
        <div className="flex items-center gap-2 text-red-400">
          <AlertTriangle className="w-4 h-4" />
          <span className="text-sm">Unresolved variable</span>
        </div>
      ) : (
        <>
          <div className="mb-2">
            <p className="text-xs text-gray-500 mb-1">Resolved value</p>
            <p className="text-sm text-gray-300 font-mono bg-[#1e1e1e] px-2 py-1 rounded truncate">
              {resolvedValue || '(empty)'}
            </p>
          </div>
          
          <div className="flex items-center justify-between">
            <span className={cn('px-2 py-0.5 text-xs text-white rounded', scopeColors[scope])}>
              {scope.charAt(0).toUpperCase() + scope.slice(1)}
            </span>
            {onEdit && (
              <button 
                onClick={onEdit}
                className="flex items-center gap-1 text-xs text-[#ff6b35] hover:underline"
              >
                Edit <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

interface VariableHighlighterProps {
  text: string;
  variables: Array<{ key: string; value: string; scope: VariableTooltipProps['scope'] }>;
  onVariableClick?: (variableName: string) => void;
}

export const VariableHighlighter: React.FC<VariableHighlighterProps> = ({
  text,
  variables,
  onVariableClick,
}) => {
  const [hoveredVar, setHoveredVar] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const variableRegex = /\{\{([^}]+)\}\}/g;
  const parts: Array<{ type: 'text' | 'variable'; value: string }> = [];
  let lastIndex = 0;
  let match;

  while ((match = variableRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'variable', value: match[1] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) });
  }

  const handleMouseEnter = (varName: string, e: React.MouseEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setTooltipPos({ x: rect.left, y: rect.bottom + 4 });
    setHoveredVar(varName);
  };

  const getVariableInfo = (varName: string) => {
    const variable = variables.find(v => v.key === varName);
    return variable || null;
  };

  return (
    <div className="relative">
      <span className="font-mono">
        {parts.map((part, index) => {
          if (part.type === 'text') {
            return <span key={index}>{part.value}</span>;
          }
          
          const varInfo = getVariableInfo(part.value);
          const isUnresolved = !varInfo;
          
          return (
            <span key={index}>
              <span
                className={cn(
                  'px-1.5 py-0.5 rounded cursor-pointer transition-colors',
                  isUnresolved 
                    ? 'bg-red-500/20 text-red-400' 
                    : 'bg-[#ff6b35]/20 text-[#ff6b35] hover:bg-[#ff6b35]/30'
                )}
                onMouseEnter={(e) => handleMouseEnter(part.value, e)}
                onMouseLeave={() => setHoveredVar(null)}
                onClick={() => onVariableClick?.(part.value)}
              >
                {`{{${part.value}}}`}
              </span>
              {hoveredVar === part.value && varInfo && (
                <div 
                  className="fixed"
                  style={{ left: tooltipPos.x, top: tooltipPos.y }}
                >
                  <VariableTooltip
                    variableName={part.value}
                    resolvedValue={varInfo.value}
                    scope={varInfo.scope}
                    isUnresolved={false}
                  />
                </div>
              )}
              {hoveredVar === part.value && isUnresolved && (
                <div 
                  className="fixed"
                  style={{ left: tooltipPos.x, top: tooltipPos.y }}
                >
                  <VariableTooltip
                    variableName={part.value}
                    resolvedValue={null}
                    scope="local"
                    isUnresolved={true}
                  />
                </div>
              )}
            </span>
          );
        })}
      </span>
    </div>
  );
};