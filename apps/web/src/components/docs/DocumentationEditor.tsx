'use client';

import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Tabs, TabPanel } from '@/components/ui/Tabs';
import { Eye, Edit3, Copy, Check, Bold, Italic, Code, Link, List, Heading2 } from 'lucide-react';

interface DocumentationEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const DocumentationEditor: React.FC<DocumentationEditorProps> = ({
  value,
  onChange,
  placeholder = 'Write documentation in Markdown...',
}) => {
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');
  const [copied, setCopied] = useState(false);

  const insertMarkdown = (before: string, after: string = '', placeholder: string = '') => {
    const textarea = document.querySelector('textarea[data-docs-editor]') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end) || placeholder;
    const newText = value.substring(0, start) + before + selectedText + after + value.substring(end);
    
    onChange(newText);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + before.length,
        start + before.length + selectedText.length
      );
    }, 0);
  };

  const toolbarButtons = [
    { icon: Heading2, action: () => insertMarkdown('## ', '', 'Heading'), title: 'Heading' },
    { icon: Bold, action: () => insertMarkdown('**', '**', 'bold'), title: 'Bold' },
    { icon: Italic, action: () => insertMarkdown('*', '*', 'italic'), title: 'Italic' },
    { icon: Code, action: () => insertMarkdown('`', '`', 'code'), title: 'Inline Code' },
    { icon: Link, action: () => insertMarkdown('[', '](url)', 'link text'), title: 'Link' },
    { icon: List, action: () => insertMarkdown('- ', '', 'list item'), title: 'List' },
  ];

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const previewContent = useMemo(() => {
    if (!value.trim()) {
      return (
        <p className="text-gray-500 italic">Nothing to preview</p>
      );
    }
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="text-2xl font-bold text-gray-100 mb-4">{children}</h1>,
          h2: ({ children }) => <h2 className="text-xl font-bold text-gray-100 mb-3 mt-6">{children}</h2>,
          h3: ({ children }) => <h3 className="text-lg font-semibold text-gray-200 mb-2 mt-4">{children}</h3>,
          p: ({ children }) => <p className="text-gray-300 mb-4 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="list-disc list-inside text-gray-300 mb-4 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside text-gray-300 mb-4 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="text-gray-300">{children}</li>,
          code: ({ className, children, ...props }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="bg-[#2d2d2d] px-1.5 py-0.5 rounded text-sm font-mono text-[#49cc90]">
                  {children}
                </code>
              );
            }
            return (
              <code className="block bg-[#1e1e1e] p-4 rounded-lg overflow-x-auto text-sm font-mono text-gray-200 mb-4">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <pre className="bg-[#1e1e1e] p-4 rounded-lg overflow-x-auto mb-4">{children}</pre>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-[#ff6b35] pl-4 italic text-gray-400 mb-4">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a href={href} className="text-[#61affe] hover:underline" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto mb-4">
              <table className="min-w-full border border-[#3d3d3d]">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-[#2d2d2d]">{children}</thead>,
          th: ({ children }) => (
            <th className="px-4 py-2 text-left text-gray-200 font-medium border-b border-[#3d3d3d]">{children}</th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-2 text-gray-300 border-b border-[#3d3d3d]">{children}</td>
          ),
          hr: () => <hr className="border-[#3d3d3d] my-6" />,
          img: ({ src, alt }) => (
            <img src={src} alt={alt || ''} className="max-w-full h-auto rounded-lg mb-4" />
          ),
        }}
      >
        {value}
      </ReactMarkdown>
    );
  }, [value]);

  return (
    <div className="border border-[#3d3d3d] rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-[#252526] border-b border-[#3d3d3d]">
        <Tabs
          tabs={[
            { id: 'write', label: 'Write', icon: <Edit3 className="w-4 h-4" /> },
            { id: 'preview', label: 'Preview', icon: <Eye className="w-4 h-4" /> },
          ]}
          activeTab={activeTab}
          onChange={(tab) => setActiveTab(tab as 'write' | 'preview')}
        />
        
        <div className="flex items-center gap-1">
          {activeTab === 'write' && toolbarButtons.map((btn, i) => (
            <button
              key={i}
              onClick={btn.action}
              title={btn.title}
              className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#3d3d3d] rounded transition-colors"
            >
              <btn.icon className="w-4 h-4" />
            </button>
          ))}
          <button
            onClick={handleCopy}
            title="Copy Markdown"
            className="p-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#3d3d3d] rounded transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {activeTab === 'write' ? (
        <textarea
          data-docs-editor
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full h-64 p-4 bg-[#1e1e1e] text-gray-200 placeholder-gray-500 font-mono text-sm resize-none focus:outline-none"
        />
      ) : (
        <div className="h-64 overflow-y-auto p-4 bg-[#1e1e1e]">
          {previewContent}
        </div>
      )}

      <div className="px-3 py-2 bg-[#252526] border-t border-[#3d3d3d]">
        <p className="text-xs text-gray-500">
          Supports Markdown with GitHub Flavored Markdown extensions
        </p>
      </div>
    </div>
  );
};

interface CollectionDocsEditorProps {
  description: string;
  onDescriptionChange: (description: string) => void;
}

export const CollectionDocsEditor: React.FC<CollectionDocsEditorProps> = ({
  description,
  onDescriptionChange,
}) => {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-300">
        Description
      </label>
      <DocumentationEditor
        value={description}
        onChange={onDescriptionChange}
        placeholder="Describe this collection..."
      />
    </div>
  );
};

interface RequestDocsEditorProps {
  documentation: string;
  onDocumentationChange: (documentation: string) => void;
}

export const RequestDocsEditor: React.FC<RequestDocsEditorProps> = ({
  documentation,
  onDocumentationChange,
}) => {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-300">
        Documentation
      </label>
      <DocumentationEditor
        value={documentation}
        onChange={onDocumentationChange}
        placeholder="Add documentation for this request..."
      />
    </div>
  );
};
