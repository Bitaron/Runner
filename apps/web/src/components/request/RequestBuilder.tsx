'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useCollectionsStore } from '@/stores/collectionsStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { Tabs, TabPanel } from '../ui/Tabs';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { KeyValueEditor } from '../ui/KeyValueEditor';
import { Send, Code, Loader2, Settings } from 'lucide-react';
import type { ApiRequest, HttpMethod, RequestBodyMode, AuthConfig, AuthType } from '@apiforge/shared';
import { CodeGenModal } from './CodeGenModal';

const HTTP_METHODS: { value: HttpMethod; label: string }[] = [
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'PATCH', label: 'PATCH' },
  { value: 'DELETE', label: 'DELETE' },
  { value: 'HEAD', label: 'HEAD' },
  { value: 'OPTIONS', label: 'OPTIONS' },
];

const BODY_MODES: { value: RequestBodyMode; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'formdata', label: 'Form Data' },
  { value: 'urlencoded', label: 'URL Encoded' },
  { value: 'raw', label: 'Raw' },
  { value: 'binary', label: 'Binary' },
  { value: 'graphql', label: 'GraphQL' },
];

const AUTH_TYPES: { value: AuthType; label: string }[] = [
  { value: 'none', label: 'No Auth' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'basic', label: 'Basic Auth' },
  { value: 'apikey', label: 'API Key' },
  { value: 'oauth1', label: 'OAuth 1.0' },
  { value: 'oauth2', label: 'OAuth 2.0' },
  { value: 'hawk', label: 'Hawk' },
  { value: 'awsv4', label: 'AWS Signature' },
];

interface RequestBuilderProps {
  request: ApiRequest | null;
  onRequestChange: (request: ApiRequest) => void;
  onSend: () => void;
  isLoading: boolean;
}

export const RequestBuilder: React.FC<RequestBuilderProps> = ({
  request,
  onRequestChange,
  onSend,
  isLoading,
}) => {
  const [activeTab, setActiveTab] = useState('params');
  const [showCodeGen, setShowCodeGen] = useState(false);
  const { currentWorkspace } = useWorkspaceStore();
  const { getInterpolatedValue } = useWorkspaceStore();

  if (!request) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <p>Select or create a request to get started</p>
      </div>
    );
  }

  const tabs = [
    { id: 'params', label: 'Params' },
    { id: 'headers', label: 'Headers' },
    { id: 'body', label: 'Body' },
    { id: 'auth', label: 'Auth' },
    { id: 'scripts', label: 'Scripts' },
  ];

  const handleChange = (field: keyof ApiRequest, value: unknown) => {
    onRequestChange({ ...request, [field]: value, updatedAt: new Date().toISOString() });
  };

  const handleKeyValueChange = (field: 'params' | 'headers', items: typeof request.params) => {
    handleChange(field, items);
  };

  const handleBodyChange = (mode: RequestBodyMode) => {
    const body = { ...request.body, mode };
    handleChange('body', body);
  };

  const handleBodyContentChange = (content: unknown) => {
    const mode = request.body.mode;
    const body = { ...request.body, ...content };
    handleChange('body', body);
  };

  const handleAuthChange = (auth: AuthConfig) => {
    handleChange('auth', auth);
  };

  const interpolateUrl = () => {
    return getInterpolatedValue(request.url);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-3 border-b border-[#3d3d3d]">
        <Select
          value={request.method}
          onChange={(e) => handleChange('method', e.target.value as HttpMethod)}
          options={HTTP_METHODS.map((m) => ({
            value: m.value,
            label: m.label,
            className: cn('font-bold', `http-method.${m.value.toLowerCase()}`),
          }))}
          className="w-28 font-bold"
        />
        
        <Input
          value={request.url}
          onChange={(e) => handleChange('url', e.target.value)}
          placeholder="Enter request URL"
          className="flex-1 font-mono text-sm"
        />
        
        <Button onClick={onSend} disabled={isLoading || !request.url.trim()}>
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          Send
        </Button>
        
        <Button variant="ghost" onClick={() => setShowCodeGen(true)}>
          <Code className="w-4 h-4" />
        </Button>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'params' && (
          <TabPanel>
            <KeyValueEditor
              items={request.params}
              onChange={(items) => handleKeyValueChange('params', items)}
              keyPlaceholder="Parameter"
              valuePlaceholder="Value"
              showDescription={false}
            />
          </TabPanel>
        )}

        {activeTab === 'headers' && (
          <TabPanel>
            <KeyValueEditor
              items={request.headers}
              onChange={(items) => handleKeyValueChange('headers', items)}
              keyPlaceholder="Header"
              valuePlaceholder="Value"
            />
          </TabPanel>
        )}

        {activeTab === 'body' && (
          <TabPanel>
            <div className="flex items-center gap-4 mb-4">
              <span className="text-sm text-gray-400">Body Type:</span>
              <div className="flex gap-2">
                {BODY_MODES.map((mode) => (
                  <button
                    key={mode.value}
                    onClick={() => handleBodyChange(mode.value)}
                    className={cn(
                      'px-3 py-1 text-xs font-medium rounded transition-colors',
                      request.body.mode === mode.value
                        ? 'bg-[#ff6b35] text-white'
                        : 'bg-[#3d3d3d] text-gray-300 hover:bg-[#4d4d4d]'
                    )}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            {request.body.mode === 'none' && (
              <p className="text-gray-500 text-sm">This request does not have a body</p>
            )}

            {request.body.mode === 'raw' && (
              <div className="space-y-2">
                <Select
                  value={request.body.rawType || 'json'}
                  onChange={(e) => handleBodyContentChange({ rawType: e.target.value })}
                  options={[
                    { value: 'json', label: 'JSON' },
                    { value: 'xml', label: 'XML' },
                    { value: 'html', label: 'HTML' },
                    { value: 'text', label: 'Text' },
                  ]}
                  className="w-32"
                />
                <textarea
                  value={request.body.raw || ''}
                  onChange={(e) => handleBodyContentChange({ raw: e.target.value })}
                  placeholder="Enter request body"
                  className="w-full h-64 p-3 bg-[#1e1e1e] border border-[#3d3d3d] rounded-md font-mono text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[#ff6b35] resize-none"
                />
              </div>
            )}

            {(request.body.mode === 'formdata' || request.body.mode === 'urlencoded') && (
              <KeyValueEditor
                items={request.body.mode === 'formdata' ? (request.body.formdata || []) : (request.body.urlencoded || [])}
                onChange={(items) => handleBodyContentChange(
                  request.body.mode === 'formdata' ? { formdata: items } : { urlencoded: items }
                )}
                keyPlaceholder="Key"
                valuePlaceholder="Value"
                showDescription={false}
              />
            )}

            {request.body.mode === 'graphql' && (
              <div className="space-y-2">
                <textarea
                  value={request.body.graphql?.query || ''}
                  onChange={(e) => handleBodyContentChange({ graphql: { ...request.body.graphql, query: e.target.value } })}
                  placeholder="query { ... }"
                  className="w-full h-32 p-3 bg-[#1e1e1e] border border-[#3d3d3d] rounded-md font-mono text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[#ff6b35] resize-none"
                />
                <textarea
                  value={request.body.graphql?.variables || ''}
                  onChange={(e) => handleBodyContentChange({ graphql: { ...request.body.graphql, variables: e.target.value } })}
                  placeholder='{ "variable": "value" }'
                  className="w-full h-24 p-3 bg-[#1e1e1e] border border-[#3d3d3d] rounded-md font-mono text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[#ff6b35] resize-none"
                />
              </div>
            )}

            {request.body.mode === 'binary' && (
              <div className="border-2 border-dashed border-[#3d3d3d] rounded-lg p-8 text-center">
                <input
                  type="file"
                  id="binary-file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleBodyContentChange({ binary: file.name });
                    }
                  }}
                />
                <label htmlFor="binary-file" className="cursor-pointer">
                  <p className="text-gray-400 mb-2">
                    {request.body.binary ? (
                      <span className="text-[#ff6b35]">{request.body.binary}</span>
                    ) : (
                      'Select a file to upload'
                    )}
                  </p>
                  <p className="text-xs text-gray-500">Maximum file size: 10MB</p>
                </label>
              </div>
            )}
          </TabPanel>
        )}

        {activeTab === 'auth' && (
          <TabPanel>
            <div className="space-y-4">
              <Select
                label="Auth Type"
                value={request.auth.type}
                onChange={(e) => handleAuthChange({ ...request.auth, type: e.target.value as AuthType })}
                options={AUTH_TYPES}
              />

              {request.auth.type === 'bearer' && (
                <div className="space-y-3">
                  <Input
                    label="Token"
                    value={request.auth.bearer?.token || ''}
                    onChange={(e) => handleAuthChange({ ...request.auth, bearer: { token: e.target.value } })}
                    placeholder="Enter token"
                  />
                  <Input
                    label="Prefix (optional)"
                    value={request.auth.bearer?.prefix || 'Bearer'}
                    onChange={(e) => handleAuthChange({ ...request.auth, bearer: { ...request.auth.bearer, prefix: e.target.value } })}
                    placeholder="Bearer"
                  />
                </div>
              )}

              {request.auth.type === 'basic' && (
                <div className="space-y-3">
                  <Input
                    label="Username"
                    value={request.auth.basic?.username || ''}
                    onChange={(e) => handleAuthChange({ ...request.auth, basic: { username: e.target.value, password: request.auth.basic?.password || '' } })}
                    placeholder="Username"
                  />
                  <Input
                    label="Password"
                    type="password"
                    value={request.auth.basic?.password || ''}
                    onChange={(e) => handleAuthChange({ ...request.auth, basic: { username: request.auth.basic?.username || '', password: e.target.value } })}
                    placeholder="Password"
                  />
                </div>
              )}

              {request.auth.type === 'apikey' && (
                <div className="space-y-3">
                  <Input
                    label="Key"
                    value={request.auth.apikey?.key || ''}
                    onChange={(e) => handleAuthChange({ ...request.auth, apikey: { ...request.auth.apikey, key: e.target.value, value: request.auth.apikey?.value || '', location: request.auth.apikey?.location || 'header' } })}
                    placeholder="Key"
                  />
                  <Input
                    label="Value"
                    value={request.auth.apikey?.value || ''}
                    onChange={(e) => handleAuthChange({ ...request.auth, apikey: { ...request.auth.apikey, key: request.auth.apikey?.key || '', value: e.target.value, location: request.auth.apikey?.location || 'header' } })}
                    placeholder="Value"
                  />
                  <Select
                    label="Add to"
                    value={request.auth.apikey?.location || 'header'}
                    onChange={(e) => handleAuthChange({ ...request.auth, apikey: { ...request.auth.apikey, location: e.target.value as 'header' | 'query' } })}
                    options={[
                      { value: 'header', label: 'Header' },
                      { value: 'query', label: 'Query Params' },
                    ]}
                  />
                </div>
              )}

              {request.auth.type === 'none' && (
                <p className="text-gray-500 text-sm">This request does not use any authorization</p>
              )}
            </div>
          </TabPanel>
        )}

        {activeTab === 'scripts' && (
          <TabPanel>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Pre-request Script</label>
                <p className="text-xs text-gray-500 mb-2">Scripts to be executed before the request is sent</p>
                <textarea
                  value={request.preRequestScript || ''}
                  onChange={(e) => handleChange('preRequestScript', e.target.value)}
                  placeholder="// Pre-request script
pm.sendRequest('https://example.com/api/check', function(err, res) {
  if (!err) {
    console.log('Status:', res.status);
  }
});"
                  className="w-full h-40 p-3 bg-[#1e1e1e] border border-[#3d3d3d] rounded-md font-mono text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[#ff6b35] resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Test Script</label>
                <p className="text-xs text-gray-500 mb-2">Scripts to be executed after the response is received</p>
                <textarea
                  value={request.testScript || ''}
                  onChange={(e) => handleChange('testScript', e.target.value)}
                  placeholder="// Test script
pm.test('Status is 200', function() {
  pm.response.to.have.status(200);
});

pm.test('Response has data', function() {
  var jsonData = pm.response.json();
  pm.expect(jsonData).to.have.property('data');
});"
                  className="w-full h-40 p-3 bg-[#1e1e1e] border border-[#3d3d3d] rounded-md font-mono text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[#ff6b35] resize-none"
                />
              </div>
            </div>
          </TabPanel>
        )}
      </div>

      <CodeGenModal
        isOpen={showCodeGen}
        onClose={() => setShowCodeGen(false)}
        request={request}
      />
    </div>
  );
};
