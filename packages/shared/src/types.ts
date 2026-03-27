export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export type RequestBodyMode = 'none' | 'formdata' | 'urlencoded' | 'raw' | 'binary' | 'graphql';

export type AuthType = 'none' | 'bearer' | 'basic' | 'apikey' | 'oauth1' | 'oauth2' | 'hawk' | 'awsv4' | 'digest' | 'ntlm' | 'akamai';

export type RawBodyType = 'json' | 'xml' | 'html' | 'text';

export interface KeyValue {
  key: string;
  value: string;
  description?: string;
  disabled?: boolean;
}

export interface Variable {
  key: string;
  value: string;
  type: 'default' | 'secret';
  enabled: boolean;
}

export interface RequestBody {
  mode: RequestBodyMode;
  formdata?: KeyValue[];
  urlencoded?: KeyValue[];
  raw?: string;
  rawType?: RawBodyType;
  graphql?: {
    query: string;
    variables?: string;
  };
  binary?: string;
}

export interface OAuth1Config {
  consumerKey: string;
  consumerSecret: string;
  token: string;
  tokenSecret: string;
  signatureMethod: 'HMAC-SHA1' | 'HMAC-SHA256' | 'RSA-SHA1' | 'PLAINTEXT';
  authType: 'HEADER' | 'QUERY_PARAMS';
  realm?: string;
}

export interface OAuth2Config {
  accessToken: string;
  tokenType?: 'Bearer';
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
  grantType: 'authorization_code' | 'client_credentials' | 'password' | 'implicit';
  authUrl?: string;
  accessTokenUrl?: string;
  redirectUri?: string;
  scope?: string;
}

export interface HawkConfig {
  id: string;
  key: string;
  algorithm: 'sha256' | 'sha1';
}

export interface AWSV4Config {
  accessKey: string;
  secretKey: string;
  sessionToken?: string;
  service?: string;
  region?: string;
}

export interface DigestConfig {
  username: string;
  password: string;
  realm?: string;
  nonce?: string;
  uri?: string;
  qop?: string;
  nc?: string;
  cnonce?: string;
  response?: string;
  opaque?: string;
}

export interface NTLMConfig {
  username: string;
  password: string;
  domain?: string;
  workstation?: string;
}

export interface AkamaiConfig {
  clientSecret: string;
  clientToken: string;
  accessToken: string;
  host?: string;
}

export interface AuthConfig {
  type: AuthType;
  inheritFromParent?: boolean;
  bearer?: {
    token: string;
    prefix?: string;
  };
  basic?: {
    username: string;
    password: string;
  };
  apikey?: {
    key: string;
    value: string;
    location: 'header' | 'query';
  };
  oauth1?: OAuth1Config;
  oauth2?: OAuth2Config;
  hawk?: HawkConfig;
  awsv4?: AWSV4Config;
  digest?: DigestConfig;
  ntlm?: NTLMConfig;
  akamai?: AkamaiConfig;
}

export interface Cookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: string;
  httpOnly?: boolean;
  secure?: boolean;
}

export interface Response {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  contentType: string;
  time: number;
  size: number;
  cookies: Cookie[];
}

export interface ApiRequest {
  _id: string;
  type: 'request';
  collectionId?: string;
  folderId?: string;
  workspaceId: string;
  name: string;
  method: HttpMethod;
  url: string;
  params: KeyValue[];
  headers: KeyValue[];
  body: RequestBody;
  auth: AuthConfig;
  preRequestScript?: string;
  testScript?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  deletedAt?: string;
}

export interface Folder {
  _id: string;
  name: string;
  description?: string;
  variables: Variable[];
  auth?: AuthConfig;
  preRequestScript?: string;
  testScript?: string;
  requests: ApiRequest[];
  folders: Folder[];
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

export interface Collection {
  _id: string;
  type: 'collection';
  workspaceId: string;
  name: string;
  description?: string;
  variables: Variable[];
  auth?: AuthConfig;
  preRequestScript?: string;
  testScript?: string;
  folders: Folder[];
  requests: ApiRequest[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  deletedAt?: string;
}

export interface Environment {
  _id: string;
  type: 'environment';
  workspaceId: string;
  name: string;
  variables: Variable[];
  createdAt: string;
  updatedAt: string;
  isGlobal: boolean;
}

export interface Workspace {
  _id: string;
  type: 'workspace';
  name: string;
  description?: string;
  ownerType: 'user' | 'team';
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  userId: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
}

export interface Team {
  _id: string;
  type: 'team';
  name: string;
  ownerId: string;
  members: TeamMember[];
  createdAt: string;
  updatedAt: string;
}

export interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  defaultEnvironment?: string;
  requestTimeout: number;
  sslVerification: boolean;
}

export interface User {
  _id: string;
  type: 'user';
  email: string;
  passwordHash?: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  settings: UserSettings;
  teams: string[];
}

export interface HistoryEntry {
  _id: string;
  type: 'history';
  userId: string;
  workspaceId: string;
  request: ApiRequest;
  response?: Response;
  timestamp: string;
}

export interface TrashItem {
  _id: string;
  type: 'collection' | 'request' | 'folder';
  deletedId: string;
  deletedAt: string;
  expiresAt: string;
  data: Collection | ApiRequest | Folder;
}

export interface WebSocketMessage {
  type: 'message' | 'sent' | 'received' | 'ping' | 'pong' | 'close';
  data?: string;
  timestamp: number;
}

export interface WebSocketRequest {
  _id: string;
  type: 'websocket';
  collectionId?: string;
  workspaceId: string;
  name: string;
  url: string;
  protocols?: string[];
  headers: KeyValue[];
  messages: WebSocketMessage[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export type CouchDocument = User | Team | Workspace | Collection | ApiRequest | Environment | HistoryEntry | TrashItem | WebSocketRequest;
