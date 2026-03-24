import type { User, Team, Workspace, Collection, ApiRequest, Environment, HistoryEntry, AuthConfig, KeyValue, RequestBody, Variable } from './types';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface ExecuteRequestBody {
  method: string;
  url: string;
  headers?: KeyValue[];
  params?: KeyValue[];
  body?: RequestBody;
  auth?: AuthConfig;
  timeout?: number;
  followRedirects?: boolean;
  verifySsl?: boolean;
}

export interface ExecuteRequestResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  contentType: string;
  time: number;
  size: number;
  cookies: Array<{
    name: string;
    value: string;
    domain?: string;
    path?: string;
    expires?: string;
  }>;
}

export interface ImportPostmanRequest {
  collection: PostmanCollection;
  workspaceId: string;
}

export interface PostmanCollection {
  info: {
    name: string;
    description?: string;
    schema: string;
    _postman_id?: string;
  };
  item: PostmanItem[];
  variable?: Variable[];
  auth?: AuthConfig;
  event?: Array<{
    listen: 'prerequest' | 'test';
    script: {
      type: string;
      exec: string | string[];
    };
  }>;
}

export interface PostmanItem {
  name: string;
  request?: {
    method: string;
    header?: Array<{
      key: string;
      value: string;
      description?: string;
    }>;
    url: string | {
      raw: string;
      protocol?: string;
      host?: string[];
      path?: string[];
      query?: Array<{
        key: string;
        value: string;
        description?: string;
        disabled?: boolean;
      }>;
    };
    body?: {
      mode: string;
      raw?: string;
      formdata?: Array<{
        key: string;
        value: string;
        type?: string;
        disabled?: boolean;
      }>;
      urlencoded?: Array<{
        key: string;
        value: string;
        disabled?: boolean;
      }>;
      graphql?: {
        query: string;
        variables?: string;
      };
    };
    auth?: AuthConfig;
  };
  event?: Array<{
    listen: 'prerequest' | 'test';
    script: {
      type: string;
      exec: string | string[];
    };
  }>;
  item?: PostmanItem[];
}

export interface CreateTeamRequest {
  name: string;
}

export interface InviteTeamMemberRequest {
  email: string;
  role: 'admin' | 'member';
}

export interface UpdateWorkspaceRequest {
  name?: string;
  description?: string;
}

export interface UpdateCollectionRequest {
  name?: string;
  description?: string;
  variables?: Variable[];
  auth?: AuthConfig;
  preRequestScript?: string;
  testScript?: string;
}

export interface UpdateRequestRequest {
  name?: string;
  method?: string;
  url?: string;
  params?: KeyValue[];
  headers?: KeyValue[];
  body?: RequestBody;
  auth?: AuthConfig;
  preRequestScript?: string;
  testScript?: string;
}

export interface CreateFolderRequest {
  collectionId: string;
  name: string;
  description?: string;
  parentFolderId?: string;
}

export interface MoveItemRequest {
  itemId: string;
  itemType: 'request' | 'folder';
  targetCollectionId: string;
  targetFolderId?: string;
  targetIndex?: number;
}

export interface SearchQuery {
  query: string;
  workspaceId?: string;
  type?: 'collection' | 'request' | 'all';
}

export interface SearchResult {
  type: 'collection' | 'request' | 'folder';
  id: string;
  name: string;
  url?: string;
  collectionId?: string;
  collectionName?: string;
}

export interface CodeGenLanguage {
  id: string;
  name: string;
  variant?: string;
}

export const SUPPORTED_CODE_LANGUAGES: CodeGenLanguage[] = [
  { id: 'curl', name: 'cURL' },
  { id: 'javascript-fetch', name: 'JavaScript', variant: 'Fetch' },
  { id: 'javascript-axios', name: 'JavaScript', variant: 'Axios' },
  { id: 'python-requests', name: 'Python', variant: 'Requests' },
  { id: 'python-httpx', name: 'Python', variant: 'HTTPX' },
  { id: 'go', name: 'Go' },
  { id: 'java-okhttp', name: 'Java', variant: 'OkHttp' },
  { id: 'java-httpclient', name: 'Java', variant: 'HttpClient' },
  { id: 'php', name: 'PHP' },
  { id: 'ruby', name: 'Ruby' },
  { id: 'csharp-httpclient', name: 'C#', variant: 'HttpClient' },
  { id: 'swift', name: 'Swift' },
  { id: 'kotlin', name: 'Kotlin' },
];

export interface ScriptResult {
  logs: string[];
  variables: Variable[];
  testResults: Array<{
    name: string;
    passed: boolean;
    error?: string;
  }>;
}

export interface SyncEvent {
  type: 'create' | 'update' | 'delete';
  entityType: 'collection' | 'request' | 'folder' | 'environment' | 'workspace';
  entityId: string;
  data?: unknown;
  userId: string;
  timestamp: number;
  workspaceId: string;
}
