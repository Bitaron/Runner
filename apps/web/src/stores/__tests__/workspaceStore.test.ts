import type { Workspace, Environment, Variable } from '@apiforge/shared';

// Mock zustand persist middleware
jest.mock('zustand/middleware', () => ({
  persist: (config: unknown) => config,
}));

import { useWorkspaceStore } from '../workspaceStore';

describe('Workspace Store', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({
      workspaces: [],
      currentWorkspace: null,
      environments: [],
      currentEnvironment: null,
      globalVariables: [],
    });
  });

  describe('Initial State', () => {
    it('should have empty workspaces array', () => {
      expect(useWorkspaceStore.getState().workspaces).toEqual([]);
    });

    it('should have no current workspace', () => {
      expect(useWorkspaceStore.getState().currentWorkspace).toBeNull();
    });

    it('should have empty environments', () => {
      expect(useWorkspaceStore.getState().environments).toEqual([]);
      expect(useWorkspaceStore.getState().currentEnvironment).toBeNull();
    });

    it('should have empty global variables', () => {
      expect(useWorkspaceStore.getState().globalVariables).toEqual([]);
    });
  });

  describe('Workspaces', () => {
    it('should set workspaces', () => {
      const workspaces: Workspace[] = [
        {
          _id: 'workspace:1',
          type: 'workspace',
          name: 'Personal',
          ownerType: 'user',
          ownerId: 'user:1',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      ];

      useWorkspaceStore.getState().setWorkspaces(workspaces);
      expect(useWorkspaceStore.getState().workspaces).toEqual(workspaces);
    });

    it('should add a workspace', () => {
      const workspace: Workspace = {
        _id: 'workspace:new',
        type: 'workspace',
        name: 'New Workspace',
        ownerType: 'user',
        ownerId: 'user:1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      useWorkspaceStore.getState().addWorkspace(workspace);
      expect(useWorkspaceStore.getState().workspaces).toHaveLength(1);
    });

    it('should update a workspace', () => {
      const workspace: Workspace = {
        _id: 'workspace:1',
        type: 'workspace',
        name: 'Original',
        ownerType: 'user',
        ownerId: 'user:1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      useWorkspaceStore.getState().addWorkspace(workspace);
      useWorkspaceStore.getState().updateWorkspace('workspace:1', { name: 'Updated' });

      const updated = useWorkspaceStore.getState().workspaces.find(w => w._id === 'workspace:1');
      expect(updated?.name).toBe('Updated');
    });

    it('should remove a workspace', () => {
      const workspace: Workspace = {
        _id: 'workspace:remove',
        type: 'workspace',
        name: 'To Remove',
        ownerType: 'user',
        ownerId: 'user:1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      useWorkspaceStore.getState().addWorkspace(workspace);
      useWorkspaceStore.getState().removeWorkspace('workspace:remove');

      expect(useWorkspaceStore.getState().workspaces).toHaveLength(0);
    });

    it('should set current workspace', () => {
      const workspace: Workspace = {
        _id: 'workspace:current',
        type: 'workspace',
        name: 'Current',
        ownerType: 'user',
        ownerId: 'user:1',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      useWorkspaceStore.getState().setCurrentWorkspace(workspace);
      expect(useWorkspaceStore.getState().currentWorkspace?.name).toBe('Current');
    });
  });

  describe('Environments', () => {
    it('should set environments', () => {
      const environments: Environment[] = [
        {
          _id: 'env:1',
          type: 'environment',
          workspaceId: 'workspace:1',
          name: 'Development',
          variables: [],
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          isGlobal: false,
        },
      ];

      useWorkspaceStore.getState().setEnvironments(environments);
      expect(useWorkspaceStore.getState().environments).toEqual(environments);
    });

    it('should add an environment', () => {
      const env: Environment = {
        _id: 'env:new',
        type: 'environment',
        workspaceId: 'workspace:1',
        name: 'New Environment',
        variables: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        isGlobal: false,
      };

      useWorkspaceStore.getState().addEnvironment(env);
      expect(useWorkspaceStore.getState().environments).toHaveLength(1);
    });

    it('should update an environment', () => {
      const env: Environment = {
        _id: 'env:1',
        type: 'environment',
        workspaceId: 'workspace:1',
        name: 'Original',
        variables: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        isGlobal: false,
      };

      useWorkspaceStore.getState().addEnvironment(env);
      useWorkspaceStore.getState().updateEnvironment('env:1', { name: 'Updated' });

      const updated = useWorkspaceStore.getState().environments.find(e => e._id === 'env:1');
      expect(updated?.name).toBe('Updated');
    });

    it('should remove an environment', () => {
      const env: Environment = {
        _id: 'env:remove',
        type: 'environment',
        workspaceId: 'workspace:1',
        name: 'To Remove',
        variables: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        isGlobal: false,
      };

      useWorkspaceStore.getState().addEnvironment(env);
      useWorkspaceStore.getState().removeEnvironment('env:remove');

      expect(useWorkspaceStore.getState().environments).toHaveLength(0);
    });

    it('should set current environment', () => {
      const env: Environment = {
        _id: 'env:current',
        type: 'environment',
        workspaceId: 'workspace:1',
        name: 'Current',
        variables: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        isGlobal: false,
      };

      useWorkspaceStore.getState().setCurrentEnvironment(env);
      expect(useWorkspaceStore.getState().currentEnvironment?.name).toBe('Current');
    });
  });

  describe('Global Variables', () => {
    it('should update global variables', () => {
      const variables: Variable[] = [
        { key: 'API_KEY', value: 'test-key', type: 'default', enabled: true },
      ];

      useWorkspaceStore.getState().updateGlobalVariables(variables);
      expect(useWorkspaceStore.getState().globalVariables).toEqual(variables);
    });

    it('should add a global variable', () => {
      useWorkspaceStore.getState().addGlobalVariable({
        key: 'NEW_VAR',
        value: 'new-value',
        type: 'default',
        enabled: true,
      });

      expect(useWorkspaceStore.getState().globalVariables).toHaveLength(1);
    });

    it('should update a global variable', () => {
      useWorkspaceStore.getState().addGlobalVariable({
        key: 'VAR_TO_UPDATE',
        value: 'old-value',
        type: 'default',
        enabled: true,
      });

      useWorkspaceStore.getState().updateGlobalVariable('VAR_TO_UPDATE', { value: 'new-value' });

      const updated = useWorkspaceStore.getState().globalVariables.find(v => v.key === 'VAR_TO_UPDATE');
      expect(updated?.value).toBe('new-value');
    });

    it('should remove a global variable', () => {
      useWorkspaceStore.getState().addGlobalVariable({
        key: 'VAR_TO_REMOVE',
        value: 'value',
        type: 'default',
        enabled: true,
      });

      expect(useWorkspaceStore.getState().globalVariables).toHaveLength(1);

      useWorkspaceStore.getState().removeGlobalVariable('VAR_TO_REMOVE');
      expect(useWorkspaceStore.getState().globalVariables).toHaveLength(0);
    });
  });

  describe('getInterpolatedValue', () => {
    beforeEach(() => {
      const env: Environment = {
        _id: 'env:1',
        type: 'environment',
        workspaceId: 'workspace:1',
        name: 'Test Env',
        variables: [
          { key: 'BASE_URL', value: 'https://api.example.com', type: 'default', enabled: true },
          { key: 'PORT', value: '3000', type: 'default', enabled: true },
          { key: 'DISABLED_VAR', value: 'disabled-value', type: 'default', enabled: false },
        ],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        isGlobal: false,
      };

      useWorkspaceStore.setState({
        currentEnvironment: env,
        globalVariables: [
          { key: 'GLOBAL_VAR', value: 'global-value', type: 'default', enabled: true },
        ],
      });
    });

    it('should interpolate environment variables', () => {
      const result = useWorkspaceStore.getState().getInterpolatedValue('{{BASE_URL}}/api');
      expect(result).toBe('https://api.example.com/api');
    });

    it('should interpolate global variables', () => {
      const result = useWorkspaceStore.getState().getInterpolatedValue('{{GLOBAL_VAR}}');
      expect(result).toBe('global-value');
    });

    it('should not interpolate disabled variables', () => {
      const result = useWorkspaceStore.getState().getInterpolatedValue('{{DISABLED_VAR}}');
      expect(result).toBe('{{DISABLED_VAR}}');
    });

    it('should leave unknown variables as-is', () => {
      const result = useWorkspaceStore.getState().getInterpolatedValue('{{UNKNOWN_VAR}}');
      expect(result).toBe('{{UNKNOWN_VAR}}');
    });

    it('should handle values without variables', () => {
      const result = useWorkspaceStore.getState().getInterpolatedValue('plain-text');
      expect(result).toBe('plain-text');
    });

    it('should handle empty string', () => {
      const result = useWorkspaceStore.getState().getInterpolatedValue('');
      expect(result).toBe('');
    });
  });
});
