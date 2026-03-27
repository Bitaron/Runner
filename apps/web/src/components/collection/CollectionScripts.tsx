'use client';

import React, { useState, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { Play, Code } from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '@/lib/utils';
import type { Collection, Folder } from '@apiforge/shared';

interface CollectionScriptsProps {
  collection: Collection;
  folder?: Folder;
  onUpdateCollection: (updates: Partial<Collection>) => void;
  onUpdateFolder?: (folderId: string, updates: Partial<Folder>) => void;
}

const SNIPPETS = [
  { name: 'Set a variable', code: 'pm.collectionVariables.set("variable_name", "value");' },
  { name: 'Get a variable', code: 'const value = pm.collectionVariables.get("variable_name");\nconsole.log(value);' },
  { name: 'Send a request', code: 'pm.sendRequest("https://example.com/api", function(err, res) {\n  if (!err) {\n    console.log(res.status);\n  }\n});' },
  { name: 'Check status code', code: 'pm.test("Status is 200", function() {\n  pm.response.to.have.status(200);\n});' },
  { name: 'Log response', code: 'console.log(pm.response.json());' },
  { name: 'Set environment variable', code: 'pm.environment.set("variable_name", "value");' },
  { name: 'Get environment variable', code: 'const value = pm.environment.get("variable_name");' },
  { name: 'Check response time', code: 'pm.test("Response time is less than 200ms", function() {\n  pm.expect(pm.response.responseTime).to.be.below(200);\n});' },
];

export const CollectionScripts: React.FC<CollectionScriptsProps> = ({
  collection,
  folder,
  onUpdateCollection,
  onUpdateFolder,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'pre-request' | 'post-response'>('pre-request');
  const [showSnippets, setShowSnippets] = useState(true);

  const preRequestScript = folder?.preRequestScript || collection.preRequestScript || '';
  const testScript = folder?.testScript || collection.testScript || '';

  const handlePreRequestChange = useCallback((value: string | undefined) => {
    if (folder && onUpdateFolder) {
      onUpdateFolder(folder._id, { preRequestScript: value || '' });
    } else {
      onUpdateCollection({ preRequestScript: value || '' });
    }
  }, [folder, onUpdateFolder, onUpdateCollection]);

  const handleTestScriptChange = useCallback((value: string | undefined) => {
    if (folder && onUpdateFolder) {
      onUpdateFolder(folder._id, { testScript: value || '' });
    } else {
      onUpdateCollection({ testScript: value || '' });
    }
  }, [folder, onUpdateFolder, onUpdateCollection]);

  const handleSnippetClick = (code: string) => {
    if (activeSubTab === 'pre-request') {
      handlePreRequestChange(preRequestScript + '\n' + code);
    } else {
      handleTestScriptChange(testScript + '\n' + code);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tabs */}
      <div className="flex items-center border-b border-[#3d3d3d]">
        <button
          onClick={() => setActiveSubTab('pre-request')}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
            activeSubTab === 'pre-request'
              ? 'border-[#ff6b35] text-white'
              : 'border-transparent text-gray-400 hover:text-white'
          )}
        >
          Pre-request
        </button>
        <button
          onClick={() => setActiveSubTab('post-response')}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
            activeSubTab === 'post-response'
              ? 'border-[#ff6b35] text-white'
              : 'border-transparent text-gray-400 hover:text-white'
          )}
        >
          Post-response
        </button>
        <div className="ml-auto flex items-center gap-2 pr-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSnippets(!showSnippets)}
          >
            <Code className="w-4 h-4 mr-1" />
            Snippets
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Editor */}
        <div className="flex-1">
          <Editor
            height="100%"
            defaultLanguage="javascript"
            theme="vs-dark"
            value={activeSubTab === 'pre-request' ? preRequestScript : testScript}
            onChange={activeSubTab === 'pre-request' ? handlePreRequestChange : handleTestScriptChange}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              wordWrap: 'on',
            }}
          />
        </div>

        {/* Snippets Panel */}
        {showSnippets && (
          <div className="w-64 border-l border-[#3d3d3d] bg-[#1e1e1e] overflow-y-auto">
            <div className="p-2 border-b border-[#3d3d3d]">
              <h3 className="text-sm font-medium text-gray-300">Snippets</h3>
            </div>
            <div className="p-2 space-y-1">
              {SNIPPETS.map((snippet, index) => (
                <button
                  key={index}
                  onClick={() => handleSnippetClick(snippet.code)}
                  className="w-full text-left px-2 py-1.5 text-xs text-gray-300 hover:bg-[#3d3d3d] rounded transition-colors"
                >
                  {snippet.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-4 py-2 border-t border-[#3d3d3d] bg-[#262627]">
        <p className="text-xs text-gray-500">
          Scripts here run for every request in this {folder ? 'folder' : 'collection'}.
          {folder && ' Collection-level scripts run first, then folder scripts.'}
        </p>
      </div>
    </div>
  );
};
