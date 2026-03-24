import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Workspace, Environment, Variable } from '@apiforge/shared';
import { syncManager } from '@/lib/syncManager';

interface WorkspaceState {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  environments: Environment[];
  currentEnvironment: Environment | null;
  globalVariables: Variable[];
  setWorkspaces: (workspaces: Workspace[]) => void;
  setCurrentWorkspace: (workspace: Workspace | null) => void;
  addWorkspace: (workspace: Workspace) => void;
  updateWorkspace: (id: string, updates: Partial<Workspace>) => void;
  removeWorkspace: (id: string) => void;
  setEnvironments: (environments: Environment[]) => void;
  setCurrentEnvironment: (environment: Environment | null) => void;
  addEnvironment: (environment: Environment) => void;
  updateEnvironment: (id: string, updates: Partial<Environment>) => void;
  removeEnvironment: (id: string) => void;
  updateGlobalVariables: (variables: Variable[]) => void;
  addGlobalVariable: (variable: Variable) => void;
  updateGlobalVariable: (key: string, updates: Partial<Variable>) => void;
  removeGlobalVariable: (key: string) => void;
  getInterpolatedValue: (value: string) => string;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      workspaces: [],
      currentWorkspace: null,
      environments: [],
      currentEnvironment: null,
      globalVariables: [],
      
      setWorkspaces: (workspaces) => set({ workspaces }),
      
      setCurrentWorkspace: (workspace) => set({ currentWorkspace: workspace }),
      
      addWorkspace: (workspace) => set((state) => {
        syncManager.emitWorkspaceEvent('create', workspace);
        return { workspaces: [...state.workspaces, workspace] };
      }),
      
      updateWorkspace: (id, updates) => set((state) => {
        const workspace = state.workspaces.find((w) => w._id === id);
        if (workspace) {
          syncManager.emitWorkspaceEvent('update', { ...workspace, ...updates });
        }
        return {
          workspaces: state.workspaces.map((w) =>
            w._id === id ? { ...w, ...updates } : w
          ),
          currentWorkspace: state.currentWorkspace?._id === id
            ? { ...state.currentWorkspace, ...updates }
            : state.currentWorkspace
        };
      }),
      
      removeWorkspace: (id) => set((state) => {
        const workspace = state.workspaces.find((w) => w._id === id);
        if (workspace) {
          syncManager.emitWorkspaceEvent('delete', workspace);
        }
        return {
          workspaces: state.workspaces.filter((w) => w._id !== id),
          currentWorkspace: state.currentWorkspace?._id === id ? null : state.currentWorkspace
        };
      }),
      
      setEnvironments: (environments) => set({ environments }),
      
      setCurrentEnvironment: (environment) => set({ currentEnvironment: environment }),
      
      addEnvironment: (environment) => set((state) => {
        syncManager.emitEnvironmentEvent('create', environment, environment.workspaceId);
        return { environments: [...state.environments, environment] };
      }),
      
      updateEnvironment: (id, updates) => set((state) => {
        const environment = state.environments.find((e) => e._id === id);
        if (environment) {
          syncManager.emitEnvironmentEvent('update', { ...environment, ...updates }, environment.workspaceId);
        }
        return {
          environments: state.environments.map((e) =>
            e._id === id ? { ...e, ...updates } : e
          ),
          currentEnvironment: state.currentEnvironment?._id === id
            ? { ...state.currentEnvironment, ...updates }
            : state.currentEnvironment
        };
      }),
      
      removeEnvironment: (id) => set((state) => {
        const environment = state.environments.find((e) => e._id === id);
        if (environment) {
          syncManager.emitEnvironmentEvent('delete', environment, environment.workspaceId);
        }
        return {
          environments: state.environments.filter((e) => e._id !== id),
          currentEnvironment: state.currentEnvironment?._id === id ? null : state.currentEnvironment
        };
      }),
      
      updateGlobalVariables: (variables) => set({ globalVariables: variables }),
      
      addGlobalVariable: (variable) => set((state) => ({
        globalVariables: [...state.globalVariables, variable]
      })),
      
      updateGlobalVariable: (key, updates) => set((state) => ({
        globalVariables: state.globalVariables.map((v) =>
          v.key === key ? { ...v, ...updates } : v
        )
      })),
      
      removeGlobalVariable: (key) => set((state) => ({
        globalVariables: state.globalVariables.filter((v) => v.key !== key)
      })),
      
      getInterpolatedValue: (value: string) => {
        const state = get();
        let result = value;
        
        const interpolate = (pattern: RegExp, variables: Variable[]) => {
          result = result.replace(pattern, (match, varName) => {
            const variable = variables.find((v) => v.key === varName && v.enabled);
            return variable ? variable.value : match;
          });
        };
        
        const envPattern = /\{\{([^}]+)\}\}/g;
        const globalPattern = /\{\{([^}]+)\}\}/g;
        
        const envVars = state.currentEnvironment?.variables || [];
        interpolate(envPattern, envVars);
        interpolate(globalPattern, state.globalVariables);
        
        return result;
      },
    }),
    {
      name: 'apiforge-workspace',
      partialize: (state) => ({
        workspaces: state.workspaces,
        currentWorkspace: state.currentWorkspace,
        environments: state.environments,
        currentEnvironment: state.currentEnvironment,
        globalVariables: state.globalVariables,
      }),
    }
  )
);
