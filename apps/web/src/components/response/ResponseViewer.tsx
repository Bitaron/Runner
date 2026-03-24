'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Tabs, TabPanel } from '../ui/Tabs';
import { Button } from '../ui/Button';
import { Copy, Check, Download, Clock, HardDrive, Cookie } from 'lucide-react';
import type { Response, Cookie as CookieType } from '@apiforge/shared';

interface ResponseViewerProps {
  response: Response | null;
  isLoading: boolean;
  consoleLogs: string[];
  testResults: Array<{ name: string; passed: boolean; error?: string }>;
}

export const ResponseViewer: React.FC<ResponseViewerProps> = ({
  response,
  isLoading,
  consoleLogs,
  testResults,
}) => {
  const [activeTab, setActiveTab] = useState('body');
  const [bodyView, setBodyView] = useState<'pretty' | 'raw' | 'preview'>('pretty');
  const [copied, setCopied] = useState(false);

  const tabs = [
    { id: 'body', label: 'Body' },
    { id: 'headers', label: 'Headers' },
    { id: 'cookies', label: 'Cookies' },
    { id: 'console', label: 'Console' },
    { id: 'tests', label: 'Tests' },
  ];

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-green-500';
    if (status >= 300 && status < 400) return 'text-yellow-500';
    if (status >= 400 && status < 500) return 'text-orange-500';
    if (status >= 500) return 'text-red-500';
    return 'text-gray-500';
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms} ms`;
    return `${(ms / 1000).toFixed(2)} s`;
  };

  const handleCopy = () => {
    if (response?.body) {
      navigator.clipboard.writeText(response.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (!response?.body) return;

    const isBase64 = response.contentType.includes('image') || response.contentType.includes('pdf') || response.contentType.includes('octet-stream');
    
    let blob: Blob;
    let filename = 'response';
    let contentType = response.contentType;

    if (isBase64 && !response.body.startsWith('{') && !response.body.startsWith('[')) {
      const binaryString = atob(response.body);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      blob = new Blob([bytes], { type: contentType });
      
      const extension = contentType.split('/')[1]?.split(';')[0] || 'bin';
      filename = `response.${extension}`;
    } else {
      if (response.contentType.includes('json')) {
        contentType = 'application/json';
        filename = 'response.json';
      } else if (response.contentType.includes('xml')) {
        contentType = 'application/xml';
        filename = 'response.xml';
      } else if (response.contentType.includes('html')) {
        contentType = 'text/html';
        filename = 'response.html';
      } else {
        filename = 'response.txt';
      }
      
      blob = new Blob([response.body], { type: contentType });
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSaveToFile = () => {
    handleDownload();
  };

  const tryParseJson = (body: string) => {
    try {
      return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      return body;
    }
  };

  const getContentTypeLabel = (contentType: string) => {
    if (contentType.includes('json')) return 'JSON';
    if (contentType.includes('html')) return 'HTML';
    if (contentType.includes('xml')) return 'XML';
    if (contentType.includes('text')) return 'Text';
    if (contentType.includes('image')) return 'Image';
    if (contentType.includes('pdf')) return 'PDF';
    return 'Unknown';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-[#ff6b35] border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400">Sending request...</p>
        </div>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <p>Click Send to get a response</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-4 p-3 border-b border-[#3d3d3d]">
        <span className={cn('text-lg font-bold', getStatusColor(response.status))}>
          {response.status} {response.statusText}
        </span>
        
        <div className="flex items-center gap-1 text-gray-400">
          <Clock className="w-4 h-4" />
          <span className="text-sm">{formatTime(response.time)}</span>
        </div>
        
        <div className="flex items-center gap-1 text-gray-400">
          <HardDrive className="w-4 h-4" />
          <span className="text-sm">{formatBytes(response.size)}</span>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Button variant="ghost" size="sm" onClick={handleCopy}>
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
          
          <Button variant="ghost" size="sm" onClick={handleSaveToFile}>
            <Download className="w-4 h-4" />
            Save
          </Button>
        </div>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'body' && (
          <TabPanel className="h-full">
            <div className="flex items-center gap-4 mb-2">
              <div className="flex gap-1">
                {(['pretty', 'raw', 'preview'] as const).map((view) => (
                  <button
                    key={view}
                    onClick={() => setBodyView(view)}
                    className={cn(
                      'px-3 py-1 text-xs font-medium rounded capitalize',
                      bodyView === view
                        ? 'bg-[#3d3d3d] text-white'
                        : 'text-gray-400 hover:text-white'
                    )}
                  >
                    {view}
                  </button>
                ))}
              </div>
              
              <span className="text-xs text-gray-500">
                {getContentTypeLabel(response.contentType)} | {formatBytes(response.size)}
              </span>
            </div>

            {bodyView === 'pretty' && (
              <pre className="p-4 bg-[#1e1e1e] rounded-md overflow-auto h-[calc(100%-40px)]">
                <code className="text-sm font-mono text-gray-200 whitespace-pre">
                  {tryParseJson(response.body)}
                </code>
              </pre>
            )}

            {bodyView === 'raw' && (
              <pre className="p-4 bg-[#1e1e1e] rounded-md overflow-auto h-[calc(100%-40px)]">
                <code className="text-sm font-mono text-gray-200 whitespace-pre">
                  {response.body}
                </code>
              </pre>
            )}

            {bodyView === 'preview' && (
              <div className="bg-[#1e1e1e] rounded-md h-[calc(100%-40px)] overflow-auto">
                {response.contentType.includes('image') ? (
                  <img
                    src={`data:${response.contentType};base64,${Buffer.from(response.body).toString('base64')}`}
                    alt="Response preview"
                    className="max-w-full h-auto"
                  />
                ) : (
                  <iframe
                    srcDoc={response.body}
                    className="w-full h-full border-0"
                    title="Response preview"
                  />
                )}
              </div>
            )}
          </TabPanel>
        )}

        {activeTab === 'headers' && (
          <TabPanel>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-[#3d3d3d]">
                  <th className="py-2 font-medium">Name</th>
                  <th className="py-2 font-medium">Value</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(response.headers).map(([key, value]) => (
                  <tr key={key} className="border-b border-[#2d2d2d]">
                    <td className="py-2 text-[#61affe]">{key}</td>
                    <td className="py-2 text-gray-300 font-mono">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabPanel>
        )}

        {activeTab === 'cookies' && (
          <TabPanel>
            {response.cookies.length === 0 ? (
              <p className="text-gray-500 text-sm">No cookies in response</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-[#3d3d3d]">
                    <th className="py-2 font-medium">Name</th>
                    <th className="py-2 font-medium">Value</th>
                    <th className="py-2 font-medium">Domain</th>
                    <th className="py-2 font-medium">Path</th>
                  </tr>
                </thead>
                <tbody>
                  {response.cookies.map((cookie, index) => (
                    <tr key={index} className="border-b border-[#2d2d2d]">
                      <td className="py-2 text-[#61affe]">{cookie.name}</td>
                      <td className="py-2 text-gray-300 font-mono truncate max-w-xs">{cookie.value}</td>
                      <td className="py-2 text-gray-400">{cookie.domain || '-'}</td>
                      <td className="py-2 text-gray-400">{cookie.path || '/'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </TabPanel>
        )}

        {activeTab === 'console' && (
          <TabPanel>
            {consoleLogs.length === 0 ? (
              <p className="text-gray-500 text-sm">No console output</p>
            ) : (
              <div className="space-y-1">
                {consoleLogs.map((log, index) => (
                  <div
                    key={index}
                    className="p-2 bg-[#1e1e1e] rounded font-mono text-sm text-gray-300"
                  >
                    {log}
                  </div>
                ))}
              </div>
            )}
          </TabPanel>
        )}

        {activeTab === 'tests' && (
          <TabPanel>
            {testResults.length === 0 ? (
              <p className="text-gray-500 text-sm">No tests run</p>
            ) : (
              <div className="space-y-2">
                {testResults.map((result, index) => (
                  <div
                    key={index}
                    className={cn(
                      'p-3 rounded flex items-center gap-2',
                      result.passed ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                    )}
                  >
                    <span className="text-lg">{result.passed ? '✓' : '✗'}</span>
                    <span>{result.name}</span>
                    {result.error && (
                      <span className="text-xs text-red-400 ml-auto">{result.error}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabPanel>
        )}
      </div>
    </div>
  );
};
