'use client';

import React from 'react';
import { Select } from '../ui/Select';
import { Input } from '../ui/Input';
import { cn } from '@/lib/utils';
import type { Collection, Folder, AuthType, AuthConfig } from '@apiforge/shared';

interface CollectionAuthProps {
  collection: Collection;
  folder?: Folder;
  onUpdateCollection: (updates: Partial<Collection>) => void;
  onUpdateFolder?: (folderId: string, updates: Partial<Folder>) => void;
}

const AUTH_TYPES: { value: AuthType | 'inherit'; label: string }[] = [
  { value: 'inherit', label: 'Inherit auth from parent' },
  { value: 'none', label: 'No Auth' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'basic', label: 'Basic Auth' },
  { value: 'apikey', label: 'API Key' },
  { value: 'digest', label: 'Digest Auth' },
  { value: 'oauth1', label: 'OAuth 1.0' },
  { value: 'oauth2', label: 'OAuth 2.0' },
  { value: 'awsv4', label: 'AWS Signature' },
  { value: 'ntlm', label: 'NTLM Auth' },
  { value: 'akamai', label: 'Akamai EdgeGrid' },
];

export const CollectionAuth: React.FC<CollectionAuthProps> = ({
  collection,
  folder,
  onUpdateCollection,
  onUpdateFolder,
}) => {
  const currentAuth = folder?.auth || collection.auth || { type: 'none' as AuthType };
  const isInherited = folder ? folder.auth?.inheritFromParent : collection.auth?.inheritFromParent;

  const handleTypeChange = (type: string) => {
    const newAuth: AuthConfig = type === 'inherit' 
      ? { type: 'none', inheritFromParent: true }
      : { type: type as AuthType };

    if (folder && onUpdateFolder) {
      onUpdateFolder(folder._id, { auth: newAuth });
    } else {
      onUpdateCollection({ auth: newAuth });
    }
  };

  const handleAuthFieldChange = (field: string, value: unknown) => {
    const newAuth = { ...currentAuth, [field]: value };
    
    if (folder && onUpdateFolder) {
      onUpdateFolder(folder._id, { auth: newAuth as AuthConfig });
    } else {
      onUpdateCollection({ auth: newAuth as AuthConfig });
    }
  };

  return (
    <div className="p-4 space-y-6">
      <p className="text-sm text-gray-400">
        This authorization method will be used for every request in this collection. 
        You can override this for individual folders or requests.
      </p>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Auth Type</label>
        <Select
          value={isInherited ? 'inherit' : currentAuth.type}
          onChange={(e) => handleTypeChange(e.target.value)}
          options={AUTH_TYPES}
          className="w-full"
        />
      </div>

      {isInherited && (
        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md text-yellow-500 text-sm">
          This {folder ? 'folder' : 'collection'} inherits authorization from its parent.
        </div>
      )}

      {!isInherited && currentAuth.type === 'bearer' && (
        <div className="space-y-3">
          <Input
            label="Token"
            value={currentAuth.bearer?.token || ''}
            onChange={(e) => handleAuthFieldChange('bearer', { token: e.target.value })}
            placeholder="Enter token"
          />
          <Input
            label="Prefix (optional)"
            value={currentAuth.bearer?.prefix || 'Bearer'}
            onChange={(e) => handleAuthFieldChange('bearer', { token: currentAuth.bearer?.token || '', prefix: e.target.value })}
            placeholder="Bearer"
          />
        </div>
      )}

      {!isInherited && currentAuth.type === 'basic' && (
        <div className="space-y-3">
          <Input
            label="Username"
            value={currentAuth.basic?.username || ''}
            onChange={(e) => handleAuthFieldChange('basic', { username: e.target.value, password: currentAuth.basic?.password || '' })}
            placeholder="Username"
          />
          <Input
            label="Password"
            type="password"
            value={currentAuth.basic?.password || ''}
            onChange={(e) => handleAuthFieldChange('basic', { username: currentAuth.basic?.username || '', password: e.target.value })}
            placeholder="Password"
          />
        </div>
      )}

      {!isInherited && currentAuth.type === 'apikey' && (
        <div className="space-y-3">
          <Input
            label="Key"
            value={currentAuth.apikey?.key || ''}
            onChange={(e) => handleAuthFieldChange('apikey', { key: e.target.value, value: currentAuth.apikey?.value || '', location: currentAuth.apikey?.location || 'header' })}
            placeholder="Key"
          />
          <Input
            label="Value"
            value={currentAuth.apikey?.value || ''}
            onChange={(e) => handleAuthFieldChange('apikey', { key: currentAuth.apikey?.key || '', value: e.target.value, location: currentAuth.apikey?.location || 'header' })}
            placeholder="Value"
          />
          <Select
            label="Add to"
            value={currentAuth.apikey?.location || 'header'}
            onChange={(e) => handleAuthFieldChange('apikey', { key: currentAuth.apikey?.key || '', value: currentAuth.apikey?.value || '', location: e.target.value })}
            options={[
              { value: 'header', label: 'Header' },
              { value: 'query', label: 'Query Params' },
            ]}
          />
        </div>
      )}

      {!isInherited && currentAuth.type === 'digest' && (
        <div className="space-y-3">
          <Input
            label="Username"
            value={currentAuth.digest?.username || ''}
            onChange={(e) => handleAuthFieldChange('digest', { username: e.target.value, password: currentAuth.digest?.password || '' })}
            placeholder="Username"
          />
          <Input
            label="Password"
            type="password"
            value={currentAuth.digest?.password || ''}
            onChange={(e) => handleAuthFieldChange('digest', { username: currentAuth.digest?.username || '', password: e.target.value })}
            placeholder="Password"
          />
        </div>
      )}

      {!isInherited && currentAuth.type === 'ntlm' && (
        <div className="space-y-3">
          <Input
            label="Username"
            value={currentAuth.ntlm?.username || ''}
            onChange={(e) => handleAuthFieldChange('ntlm', { username: e.target.value, password: currentAuth.ntlm?.password || '', domain: currentAuth.ntlm?.domain || '' })}
            placeholder="Username"
          />
          <Input
            label="Password"
            type="password"
            value={currentAuth.ntlm?.password || ''}
            onChange={(e) => handleAuthFieldChange('ntlm', { username: currentAuth.ntlm?.username || '', password: e.target.value, domain: currentAuth.ntlm?.domain || '' })}
            placeholder="Password"
          />
          <Input
            label="Domain (optional)"
            value={currentAuth.ntlm?.domain || ''}
            onChange={(e) => handleAuthFieldChange('ntlm', { username: currentAuth.ntlm?.username || '', password: currentAuth.ntlm?.password || '', domain: e.target.value })}
            placeholder="Domain"
          />
        </div>
      )}

      {!isInherited && currentAuth.type === 'awsv4' && (
        <div className="space-y-3">
          <Input
            label="Access Key"
            value={currentAuth.awsv4?.accessKey || ''}
            onChange={(e) => handleAuthFieldChange('awsv4', { accessKey: e.target.value, secretKey: currentAuth.awsv4?.secretKey || '' })}
            placeholder="Access Key"
          />
          <Input
            label="Secret Key"
            type="password"
            value={currentAuth.awsv4?.secretKey || ''}
            onChange={(e) => handleAuthFieldChange('awsv4', { accessKey: currentAuth.awsv4?.accessKey || '', secretKey: e.target.value })}
            placeholder="Secret Key"
          />
          <Input
            label="Region"
            value={currentAuth.awsv4?.region || 'us-east-1'}
            onChange={(e) => handleAuthFieldChange('awsv4', { accessKey: currentAuth.awsv4?.accessKey || '', secretKey: currentAuth.awsv4?.secretKey || '', region: e.target.value })}
            placeholder="us-east-1"
          />
          <Input
            label="Service"
            value={currentAuth.awsv4?.service || ''}
            onChange={(e) => handleAuthFieldChange('awsv4', { accessKey: currentAuth.awsv4?.accessKey || '', secretKey: currentAuth.awsv4?.secretKey || '', service: e.target.value })}
            placeholder="Service name"
          />
        </div>
      )}

      {!isInherited && currentAuth.type === 'akamai' && (
        <div className="space-y-3">
          <Input
            label="Client Token"
            value={currentAuth.akamai?.clientToken || ''}
            onChange={(e) => handleAuthFieldChange('akamai', { clientToken: e.target.value, clientSecret: currentAuth.akamai?.clientSecret || '', accessToken: currentAuth.akamai?.accessToken || '' })}
            placeholder="Client Token"
          />
          <Input
            label="Client Secret"
            type="password"
            value={currentAuth.akamai?.clientSecret || ''}
            onChange={(e) => handleAuthFieldChange('akamai', { clientToken: currentAuth.akamai?.clientToken || '', clientSecret: e.target.value, accessToken: currentAuth.akamai?.accessToken || '' })}
            placeholder="Client Secret"
          />
          <Input
            label="Access Token"
            value={currentAuth.akamai?.accessToken || ''}
            onChange={(e) => handleAuthFieldChange('akamai', { clientToken: currentAuth.akamai?.clientToken || '', clientSecret: currentAuth.akamai?.clientSecret || '', accessToken: e.target.value })}
            placeholder="Access Token"
          />
        </div>
      )}

      {!isInherited && currentAuth.type === 'oauth1' && (
        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md text-yellow-500 text-sm">
          OAuth 1.0 configuration coming soon...
        </div>
      )}

      {!isInherited && currentAuth.type === 'oauth2' && (
        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md text-yellow-500 text-sm">
          OAuth 2.0 configuration coming soon...
        </div>
      )}

      {!isInherited && currentAuth.type === 'none' && (
        <p className="text-gray-500 text-sm">This {folder ? 'folder' : 'collection'} does not use any authorization.</p>
      )}
    </div>
  );
};
