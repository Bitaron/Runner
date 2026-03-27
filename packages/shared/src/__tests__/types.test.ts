import type {
  HttpMethod,
  RequestBodyMode,
  AuthType,
  KeyValue,
  Variable,
  RequestBody,
  AuthConfig,
  ApiRequest,
  Collection,
  Folder,
  Environment,
  Workspace,
  User,
  Team,
  HistoryEntry,
  TrashItem,
  Response,
} from '../types';

describe('Shared Types', () => {
  describe('HttpMethod', () => {
    const validMethods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

    it('should accept valid HTTP methods', () => {
      validMethods.forEach((method) => {
        expect(typeof method).toBe('string');
        expect(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']).toContain(method);
      });
    });
  });

  describe('RequestBodyMode', () => {
    const validModes: RequestBodyMode[] = ['none', 'formdata', 'urlencoded', 'raw', 'binary', 'graphql'];

    it('should accept valid body modes', () => {
      validModes.forEach((mode) => {
        expect(typeof mode).toBe('string');
      });
    });
  });

  describe('AuthType', () => {
    const validAuthTypes: AuthType[] = ['none', 'bearer', 'basic', 'apikey', 'oauth1', 'oauth2', 'hawk', 'awsv4', 'digest', 'ntlm', 'akamai'];

    it('should accept valid auth types', () => {
      validAuthTypes.forEach((type) => {
        expect(typeof type).toBe('string');
      });
    });
  });

  describe('KeyValue', () => {
    it('should create a valid KeyValue object', () => {
      const kv: KeyValue = {
        key: 'Content-Type',
        value: 'application/json',
        description: 'Request content type',
        disabled: false,
      };

      expect(kv.key).toBe('Content-Type');
      expect(kv.value).toBe('application/json');
      expect(kv.description).toBe('Request content type');
      expect(kv.disabled).toBe(false);
    });

    it('should allow optional fields to be undefined', () => {
      const kv: KeyValue = {
        key: 'Authorization',
        value: 'Bearer token',
      };

      expect(kv.description).toBeUndefined();
      expect(kv.disabled).toBeUndefined();
    });
  });

  describe('Variable', () => {
    it('should create a valid Variable object', () => {
      const variable: Variable = {
        key: 'BASE_URL',
        value: 'https://api.example.com',
        type: 'default',
        enabled: true,
      };

      expect(variable.key).toBe('BASE_URL');
      expect(variable.value).toBe('https://api.example.com');
      expect(variable.type).toBe('default');
      expect(variable.enabled).toBe(true);
    });

    it('should support secret type', () => {
      const secretVar: Variable = {
        key: 'API_KEY',
        value: 'secret123',
        type: 'secret',
        enabled: true,
      };

      expect(secretVar.type).toBe('secret');
    });
  });

  describe('RequestBody', () => {
    it('should create a none body', () => {
      const body: RequestBody = { mode: 'none' };
      expect(body.mode).toBe('none');
    });

    it('should create a raw body with content', () => {
      const body: RequestBody = {
        mode: 'raw',
        raw: '{"name": "test"}',
        rawType: 'json',
      };

      expect(body.mode).toBe('raw');
      expect(body.raw).toBe('{"name": "test"}');
      expect(body.rawType).toBe('json');
    });

    it('should create a formdata body', () => {
      const body: RequestBody = {
        mode: 'formdata',
        formdata: [
          { key: 'username', value: 'testuser' },
          { key: 'password', value: 'password123' },
        ],
      };

      expect(body.mode).toBe('formdata');
      expect(body.formdata).toHaveLength(2);
    });

    it('should create a graphql body', () => {
      const body: RequestBody = {
        mode: 'graphql',
        graphql: {
          query: 'query { users { id name } }',
          variables: '{"limit": 10}',
        },
      };

      expect(body.mode).toBe('graphql');
      expect(body.graphql?.query).toContain('users');
    });
  });

  describe('AuthConfig', () => {
    it('should create a bearer auth config', () => {
      const auth: AuthConfig = {
        type: 'bearer',
        bearer: {
          token: 'my-jwt-token',
          prefix: 'Bearer',
        },
      };

      expect(auth.type).toBe('bearer');
      expect(auth.bearer?.token).toBe('my-jwt-token');
    });

    it('should create a basic auth config', () => {
      const auth: AuthConfig = {
        type: 'basic',
        basic: {
          username: 'admin',
          password: 'password123',
        },
      };

      expect(auth.type).toBe('basic');
      expect(auth.basic?.username).toBe('admin');
    });

    it('should create an api key auth config', () => {
      const auth: AuthConfig = {
        type: 'apikey',
        apikey: {
          key: 'X-API-Key',
          value: 'api-key-value',
          location: 'header',
        },
      };

      expect(auth.type).toBe('apikey');
      expect(auth.apikey?.location).toBe('header');
    });
  });

  describe('ApiRequest', () => {
    it('should create a valid API request', () => {
      const request: ApiRequest = {
        _id: 'request:123',
        type: 'request',
        workspaceId: 'workspace:456',
        name: 'Get Users',
        method: 'GET',
        url: 'https://api.example.com/users',
        params: [],
        headers: [],
        body: { mode: 'none' },
        auth: { type: 'none' },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        createdBy: 'user:789',
      };

      expect(request._id).toBe('request:123');
      expect(request.method).toBe('GET');
      expect(request.name).toBe('Get Users');
      expect(request.type).toBe('request');
    });

    it('should support optional collection and folder references', () => {
      const request: ApiRequest = {
        _id: 'request:123',
        type: 'request',
        collectionId: 'collection:111',
        folderId: 'folder:222',
        workspaceId: 'workspace:456',
        name: 'Nested Request',
        method: 'POST',
        url: 'https://api.example.com/nested',
        params: [],
        headers: [],
        body: { mode: 'raw', raw: '{}', rawType: 'json' },
        auth: { type: 'none' },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        createdBy: 'user:789',
      };

      expect(request.collectionId).toBe('collection:111');
      expect(request.folderId).toBe('folder:222');
    });
  });

  describe('Collection', () => {
    it('should create a valid collection', () => {
      const collection: Collection = {
        _id: 'collection:123',
        type: 'collection',
        workspaceId: 'workspace:456',
        name: 'My API Collection',
        description: 'A collection of API endpoints',
        variables: [
          { key: 'BASE_URL', value: 'https://api.example.com', type: 'default', enabled: true },
        ],
        folders: [],
        requests: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        createdBy: 'user:789',
      };

      expect(collection.name).toBe('My API Collection');
      expect(collection.variables).toHaveLength(1);
      expect(collection.folders).toHaveLength(0);
    });

    it('should support nested folders', () => {
      const collection: Collection = {
        _id: 'collection:123',
        type: 'collection',
        workspaceId: 'workspace:456',
        name: 'Nested Collection',
        variables: [],
        folders: [
          {
            _id: 'folder:1',
            name: 'Users',
            description: 'User endpoints',
            variables: [],
            requests: [],
            folders: [
              {
                _id: 'folder:2',
                name: 'Admin',
                variables: [],
                requests: [],
                folders: [],
              },
            ],
          },
        ],
        requests: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        createdBy: 'user:789',
      };

      expect(collection.folders).toHaveLength(1);
      expect(collection.folders[0].folders).toHaveLength(1);
      expect(collection.folders[0].folders[0].name).toBe('Admin');
    });
  });

  describe('Environment', () => {
    it('should create a valid environment', () => {
      const env: Environment = {
        _id: 'env:123',
        type: 'environment',
        workspaceId: 'workspace:456',
        name: 'Development',
        variables: [
          { key: 'HOST', value: 'localhost', type: 'default', enabled: true },
          { key: 'PORT', value: '3000', type: 'default', enabled: true },
          { key: 'SECRET', value: 'dev-secret', type: 'secret', enabled: true },
        ],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        isGlobal: false,
      };

      expect(env.name).toBe('Development');
      expect(env.variables).toHaveLength(3);
      expect(env.isGlobal).toBe(false);
    });

    it('should identify global environments', () => {
      const globalEnv: Environment = {
        _id: 'env:global',
        type: 'environment',
        workspaceId: 'workspace:456',
        name: 'Globals',
        variables: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        isGlobal: true,
      };

      expect(globalEnv.isGlobal).toBe(true);
    });
  });

  describe('Workspace', () => {
    it('should create a user workspace', () => {
      const workspace: Workspace = {
        _id: 'workspace:123',
        type: 'workspace',
        name: 'Personal Workspace',
        description: 'My personal API workspace',
        ownerType: 'user',
        ownerId: 'user:456',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      expect(workspace.ownerType).toBe('user');
      expect(workspace.name).toBe('Personal Workspace');
    });

    it('should create a team workspace', () => {
      const workspace: Workspace = {
        _id: 'workspace:789',
        type: 'workspace',
        name: 'Team Workspace',
        ownerType: 'team',
        ownerId: 'team:123',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      expect(workspace.ownerType).toBe('team');
    });
  });

  describe('User', () => {
    it('should create a valid user', () => {
      const user: User = {
        _id: 'user:123',
        type: 'user',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        settings: {
          theme: 'dark',
          requestTimeout: 30000,
          sslVerification: true,
        },
        teams: ['team:1', 'team:2'],
      };

      expect(user.email).toBe('test@example.com');
      expect(user.settings.theme).toBe('dark');
      expect(user.teams).toHaveLength(2);
    });
  });

  describe('Team', () => {
    it('should create a valid team', () => {
      const team: Team = {
        _id: 'team:123',
        type: 'team',
        name: 'Engineering Team',
        ownerId: 'user:owner',
        members: [
          {
            userId: 'user:owner',
            email: 'owner@example.com',
            name: 'Team Owner',
            role: 'owner',
            joinedAt: '2024-01-01T00:00:00Z',
          },
          {
            userId: 'user:member1',
            email: 'member@example.com',
            name: 'Team Member',
            role: 'member',
            joinedAt: '2024-01-02T00:00:00Z',
          },
        ],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      expect(team.name).toBe('Engineering Team');
      expect(team.members).toHaveLength(2);
      expect(team.members[0].role).toBe('owner');
    });
  });

  describe('HistoryEntry', () => {
    it('should create a valid history entry', () => {
      const historyEntry: HistoryEntry = {
        _id: 'history:123',
        type: 'history',
        userId: 'user:456',
        workspaceId: 'workspace:789',
        request: {
          _id: 'request:111',
          type: 'request',
          workspaceId: 'workspace:789',
          name: 'Historical Request',
          method: 'POST',
          url: 'https://api.example.com/historical',
          params: [],
          headers: [],
          body: { mode: 'none' },
          auth: { type: 'none' },
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          createdBy: 'user:456',
        },
        timestamp: '2024-01-01T12:00:00Z',
      };

      expect(historyEntry.type).toBe('history');
      expect(historyEntry.request.name).toBe('Historical Request');
    });
  });

  describe('TrashItem', () => {
    it('should create a valid trash item with expiration', () => {
      const trashItem: TrashItem = {
        _id: 'trash:123',
        type: 'collection',
        deletedId: 'collection:456',
        deletedAt: '2024-01-01T00:00:00Z',
        expiresAt: '2024-01-31T00:00:00Z',
        data: {
          _id: 'collection:456',
          type: 'collection',
          workspaceId: 'workspace:789',
          name: 'Deleted Collection',
          variables: [],
          folders: [],
          requests: [],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          createdBy: 'user:111',
        },
      };

      expect(trashItem.type).toBe('collection');
      expect(trashItem.expiresAt).toBeDefined();
      expect(trashItem.data).toBeDefined();
    });
  });

  describe('Response', () => {
    it('should create a valid response', () => {
      const response: Response = {
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'application/json',
          'x-request-id': '12345',
        },
        body: '{"success": true, "data": []}',
        contentType: 'application/json',
        time: 150,
        size: 1024,
        cookies: [
          {
            name: 'session_id',
            value: 'abc123',
            domain: '.example.com',
            path: '/',
          },
        ],
      };

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/json');
      expect(response.cookies).toHaveLength(1);
      expect(response.time).toBe(150);
    });
  });
});
