import type { AuthConfig, Variable, Collection, Folder, ApiRequest } from '@apiforge/shared';

export function getEffectiveAuth(
  request: ApiRequest,
  collection: Collection | null,
  folder: Folder | null
): AuthConfig {
  if (request.auth && !request.auth.inheritFromParent) {
    return request.auth;
  }

  if (folder?.auth && !folder.auth.inheritFromParent) {
    return folder.auth;
  }

  if (collection?.auth && !collection.auth.inheritFromParent) {
    return collection.auth;
  }

  return { type: 'none' };
}

export function getEffectiveVariables(
  collection: Collection | null,
  folder: Folder | null
): Variable[] {
  const vars: Variable[] = [];
  
  if (collection?.variables) {
    vars.push(...collection.variables.filter(v => v.enabled));
  }
  
  if (folder?.variables) {
    vars.push(...folder.variables.filter(v => v.enabled));
  }
  
  return vars;
}

export function getEffectiveScripts(
  collection: Collection | null,
  folder: Folder | null
): { preRequestScript: string; testScript: string } {
  let preRequestScript = '';
  let testScript = '';
  
  if (collection) {
    if (collection.preRequestScript) {
      preRequestScript += collection.preRequestScript + '\n';
    }
    if (collection.testScript) {
      testScript += collection.testScript + '\n';
    }
  }
  
  if (folder) {
    if (folder.preRequestScript) {
      preRequestScript += folder.preRequestScript + '\n';
    }
    if (folder.testScript) {
      testScript += folder.testScript + '\n';
    }
  }
  
  return { preRequestScript: preRequestScript.trim(), testScript: testScript.trim() };
}

export function interpolateVariables(
  value: string,
  variables: Variable[],
  envVariables: Variable[]
): string {
  let result = value;
  
  const allVars = [...envVariables, ...variables];
  
  for (const variable of allVars) {
    if (variable.enabled) {
      const regex = new RegExp(`\\{\\{${variable.key}\\}\\}`, 'g');
      result = result.replace(regex, variable.value);
    }
  }
  
  return result;
}
