'use client';

import React, { useEffect, useState } from 'react';
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
  visualizerHtml?: string | null;
}

const toBase64 = (body: string | ArrayBuffer | Uint8Array): string => {
  let bytes: Uint8Array;
  if (body instanceof ArrayBuffer) {
    bytes = new Uint8Array(body);
  } else if (body instanceof Uint8Array) {
    bytes = body;
  } else {
    bytes = new TextEncoder().encode(body);
  }

  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    for (let j = 0; j < chunk.length; j++) {
      binary += String.fromCharCode(chunk[j]);
    }
  }
  return btoa(binary);
};

export const ResponseViewer: React.FC<ResponseViewerProps> = ({
  response,
  isLoading,
  consoleLogs,
  testResults,
  visualizerHtml,
}) => {
  const [activeTab, setActiveTab] = useState('body');
  const [bodyView, setBodyView] = useState<'pretty' | 'raw' | 'preview'>('pretty');
  const [copied, setCopied] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!isLoading) {
      setElapsedMs(0);
      return undefined;
    }
    const start = Date.now();
    setElapsedMs(0);
    const intervalId = setInterval(() => {
      setElapsedMs(Date.now() - start);
    }, 100);
    return () => clearInterval(intervalId);
  }, [isLoading]);

  const tabs = [
    { id: 'body', label: 'Body' },
    { id: 'headers', label: 'Headers' },
    { id: 'cookies', label: 'Cookies' },
    { id: 'visualize', label: 'Visualize' },
    { id: 'tests', label: 'Tests' },
  ];

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-green-400';
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
          <div className="flex items-center gap-2">
            <p className="text-gray-400">Sending request...</p>
            <span className="text-sm text-[#ff6b35] font-mono">{(elapsedMs / 1000).toFixed(1)}s</span>
          </div>
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
    <div className="flex flex-col h-full min-w-0">
      <div className="flex items-center gap-2 sm:gap-4 p-3 border-b border-[#3d3d3d] min-w-0 flex-wrap">
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

        <div className="flex items-center gap-2 ml-auto shrink-0">
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
                      'px-3 py-1 text-xs font-medium capitalize border-b-2 transition-colors duration-200',
                      bodyView === view
                        ? 'text-white border-[#ff6b35]'
                        : 'text-gray-400 hover:text-gray-200 border-transparent'
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
                    src={`data:${response.contentType};base64,${toBase64(response.body)}`}
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

        {activeTab === 'visualize' && (
          <TabPanel>
            {visualizerHtml ? (
              <div className="p-2 h-full flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">Rendered via <code>pm.visualizer.set()</code></span>
                  <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(visualizerHtml)}>Copy HTML</Button>
                </div>
                <iframe
                  srcDoc={visualizerHtml}
                  className="flex-1 w-full min-h-[300px] bg-white rounded border border-[#3d3d3d]"
                  title="Visualizer"
                  sandbox="allow-scripts"
                />
              </div>
            ) : (() => {
              let parsed: unknown = null;
              let isJsonArray = false;
              let tableRows: Record<string, unknown>[] = [];
              let tableHeaders: string[] = [];
              let chartData: { label: string; value: number }[] = [];
              try {
                parsed = JSON.parse(response.body);
                if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
                  isJsonArray = true;
                  tableRows = parsed as Record<string, unknown>[];
                  tableHeaders = Array.from(new Set(tableRows.flatMap(r => Object.keys(r)))).slice(0, 6);
                  // try to find numeric field for chart
                  const numericKey = tableHeaders.find(k => tableRows.some(r => typeof r[k] === 'number'));
                  if (numericKey) chartData = tableRows.slice(0, 10).map((r, i) => ({ label: String(r[tableHeaders[0]] ?? i), value: Number(r[numericKey]) || 0 }));
                }
              } catch {}
              return (
                <div className="p-4 space-y-4">
                  <p className="text-gray-400 text-sm">Visualize your response — use <code className="bg-[#2d2d2d] px-1 rounded">pm.visualizer.set(template, data)</code> in Tests to render custom HTML (Handlebars supported).</p>
                  {isJsonArray ? (
                    <>
                      <div>
                        <h4 className="text-white font-medium mb-2">Table View <span className="text-xs text-gray-500">({tableRows.length} rows)</span></h4>
                        <div className="overflow-x-auto rounded border border-[#3d3d3d]">
                          <table className="w-full text-sm">
                            <thead><tr className="bg-[#2d2d2d] text-left text-gray-400">{tableHeaders.map(h => <th key={h} className="px-2 py-1 font-medium">{h}</th>)}</tr></thead>
                            <tbody>{tableRows.slice(0, 20).map((row, idx) => <tr key={idx} className="border-t border-[#2d2d2d]">{tableHeaders.map(h => <td key={h} className="px-2 py-1 text-gray-300 font-mono truncate max-w-[150px]">{String(row[h] ?? '')}</td>)}</tr>)}</tbody>
                          </table>
                        </div>
                      </div>
                      {chartData.length > 0 && (
                        <div>
                          <h4 className="text-white font-medium mb-2">Chart</h4>
                          <div className="bg-[#1e1e1e] p-3 rounded border border-[#3d3d3d] flex items-end gap-1 h-32">
                            {chartData.map((d, i) => {
                              const max = Math.max(...chartData.map(x => x.value), 1);
                              const h = (d.value / max) * 100;
                              return <div key={i} className="flex-1 flex flex-col items-center gap-1"><div className="w-full bg-[#ff6b35] rounded-t" style={{ height: `${h}%`, minHeight: '4px' }} title={`${d.label}: ${d.value}`} /><span className="text-[10px] text-gray-500 truncate w-full text-center">{d.label.slice(0, 8)}</span></div>;
                            })}
                          </div>
                        </div>
                      )}
                      <div>
                        <h4 className="text-white font-medium mb-2">JSON Tree</h4>
                        <pre className="p-3 bg-[#1e1e1e] rounded border border-[#3d3d3d] overflow-auto max-h-[200px] text-xs font-mono text-gray-200">{JSON.stringify(parsed, null, 2)}</pre>
                      </div>
                    </>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { title: 'JSON Tree', description: response.contentType.includes('json') ? 'Parsed JSON shown below' : 'Response is not JSON' },
                        { title: 'Table View', description: isJsonArray ? 'Array detected' : 'Requires JSON array of objects' },
                        { title: 'Chart', description: isJsonArray && chartData.length ? 'Bar chart of numeric field' : 'Requires numeric array' },
                        { title: 'HTML Preview', description: response.contentType.includes('html') ? 'See Preview tab' : 'Requires HTML response' },
                      ].map(({ title, description }) => (
                        <div key={title} className="p-4 bg-[#1e1e1e] rounded-lg border border-[#3d3d3d] text-left">
                          <h4 className="text-white font-medium mb-1">{title}</h4>
                          <p className="text-gray-500 text-sm">{description}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {response.contentType.includes('json') && !isJsonArray && (
                    <pre className="p-3 bg-[#1e1e1e] rounded border border-[#3d3d3d] overflow-auto max-h-[300px] text-xs font-mono text-gray-200">{tryParseJson(response.body)}</pre>
                  )}
                </div>
              );
            })()}
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
                      result.passed ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-500'
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
