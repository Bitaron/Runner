import type { AuthConfig, Variable, Collection, Folder, ApiRequest } from '@apiforge/shared';

/**
 * Find the full folder chain from collection root to the target folder.
 * For nested folders, returns [rootFolder, ..., leafFolder].
 */
export function getFolderChain(
  collection: Collection | null,
  targetFolderId: string | null | undefined
): Folder[] {
  if (!collection || !targetFolderId) return [];
  const chain: Folder[] = [];
  const findPath = (folders: Folder[], path: Folder[]): boolean => {
    for (const f of folders) {
      const newPath = [...path, f];
      if (f._id === targetFolderId) {
        chain.push(...newPath);
        return true;
      }
      if (f.folders && f.folders.length > 0) {
        if (findPath(f.folders, newPath)) return true;
      }
    }
    return false;
  };
  findPath(collection.folders, []);
  return chain;
}

export function getEffectiveAuth(
  request: ApiRequest,
  collection: Collection | null,
  folder: Folder | null
): AuthConfig {
  // Request explicit auth wins if not inheriting
  if (request.auth && !request.auth.inheritFromParent) {
    // Treat explicit 'none' as valid (do not inherit), but if the request
    // has no auth at all, fall through to folder/collection.
    // Postman default is "Inherit auth from parent" -> inheritFromParent:true.
    return request.auth;
  }

  // Walk folder chain from leaf to root (nearest parent first)
  if (folder || collection) {
    const chain = folder && collection ? getFolderChain(collection, folder._id) : folder ? [folder] : [];
    // Check leaf folder up through ancestors
    for (let i = chain.length - 1; i >= 0; i--) {
      const f = chain[i];
      if (f.auth && !f.auth.inheritFromParent) {
        return f.auth;
      }
    }
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
  
  // Include full folder chain (ancestors -> leaf) so nested folders inherit correctly
  const chain = folder && collection ? getFolderChain(collection, folder._id) : folder ? [folder] : [];
  for (const f of chain) {
    if (f.variables) {
      vars.push(...f.variables.filter(v => v.enabled));
    }
  }
  
  return vars;
}

/**
 * Postman-compatible script resolution:
 * - Pre-request:  Collection → ancestors → leaf folder → Request  (outer → inner)
 * - Test (post-response): Request → leaf folder → ancestors → Collection (inner → outer)
 *
 * When a single combined string is needed (e.g. for display), pre-request uses
 * outer→inner and test uses inner→outer to match Postman console order.
 */
export function getEffectiveScripts(
  collection: Collection | null,
  folder: Folder | null,
  request?: ApiRequest | null
): { preRequestScript: string; testScript: string } {
  const preParts: string[] = [];
  if (collection?.preRequestScript) preParts.push(collection.preRequestScript);
  const chain = folder && collection ? getFolderChain(collection, folder._id) : folder ? [folder] : [];
  for (const f of chain) {
    if (f.preRequestScript) preParts.push(f.preRequestScript);
  }
  if (request?.preRequestScript) preParts.push(request.preRequestScript);

  // Test scripts: Postman runs Request → Folder (leaf→root) → Collection (inner → outer)
  const testParts: string[] = [];
  if (request?.testScript) testParts.push(request.testScript);
  for (let i = chain.length - 1; i >= 0; i--) {
    if (chain[i].testScript) testParts.push(chain[i].testScript);
  }
  if (collection?.testScript) testParts.push(collection.testScript);

  return {
    preRequestScript: preParts.join('\n').trim(),
    testScript: testParts.join('\n').trim(),
  };
}

/** Collect-first variant useful for debugging/display (collection → folder → request) */
export function getEffectiveScriptsCollectFirst(
  collection: Collection | null,
  folder: Folder | null,
  request?: ApiRequest | null
): { preRequestScript: string; testScript: string } {
  const preParts: string[] = [];
  const testParts: string[] = [];
  if (collection?.preRequestScript) preParts.push(collection.preRequestScript);
  if (collection?.testScript) testParts.push(collection.testScript);
  const chain = folder && collection ? getFolderChain(collection, folder._id) : folder ? [folder] : [];
  for (const f of chain) {
    if (f.preRequestScript) preParts.push(f.preRequestScript);
    if (f.testScript) testParts.push(f.testScript);
  }
  if (request?.preRequestScript) preParts.push(request.preRequestScript);
  if (request?.testScript) testParts.push(request.testScript);
  return { preRequestScript: preParts.join('\n').trim(), testScript: testParts.join('\n').trim() };
}

export function interpolateVariables(
  value: string,
  variables: Variable[],
  envVariables: Variable[]
): string {
  let result = value;
  
  // Precedence: globals < collection/folder < environment (env overwrites collection)
  // Use Map so later (more specific) wins for duplicate keys (collection < leaf folder < env)
  const allVars = [...variables, ...envVariables];
  const merged = new Map<string, string>();
  for (const v of allVars) {
    if (v.enabled) merged.set(v.key, v.value);
  }
  
  merged.forEach((value, key) => {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\{\\{${escapedKey}\\}\\}`, 'g');
    result = result.replace(regex, value);
  });
  
  return result;
}
