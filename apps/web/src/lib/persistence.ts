import { apiClient } from './api';
import { useAuthStore } from '@/stores/authStore';
import type { Collection, ApiRequest } from '@apiforge/shared';

/**
 * Server-persistence helpers.
 *
 * All helpers return the authoritative server document on success and
 * `null` when the operation could not be synced (guest mode, offline,
 * or API failure). Callers fall back to local-only state in that case
 * so the UI keeps working offline.
 */

export const canSyncToServer = (): boolean => {
  const { isAuthenticated, isAnonymous } = useAuthStore.getState();
  return isAuthenticated && !isAnonymous;
};

export const createCollectionOnServer = async (
  payload: Pick<Collection, 'name' | 'description' | 'variables'> & { workspaceId: string }
): Promise<Collection | null> => {
  if (!canSyncToServer() || !payload.workspaceId) return null;
  try {
    const res = await apiClient.post<Collection>('/api/collections', payload);
    return res.success && res.data ? res.data : null;
  } catch {
    return null;
  }
};

export const createFolderOnServer = async (
  collectionId: string,
  name: string,
  parentFolderId?: string
): Promise<Collection | null> => {
  if (!canSyncToServer()) return null;
  try {
    const res = await apiClient.post<{ folder: unknown; collection: Collection }>(
      `/api/collections/${collectionId}/folders`,
      { name, parentFolderId }
    );
    return res.success && res.data?.collection ? res.data.collection : null;
  } catch {
    return null;
  }
};

export const createRequestOnServer = async (
  request: ApiRequest
): Promise<ApiRequest | null> => {
  if (!canSyncToServer() || !request.workspaceId || !request.collectionId) return null;
  try {
    const res = await apiClient.post<ApiRequest>('/api/requests', {
      name: request.name,
      method: request.method,
      url: request.url,
      collectionId: request.collectionId,
      folderId: request.folderId,
      workspaceId: request.workspaceId,
      params: request.params,
      headers: request.headers,
      body: request.body,
      auth: request.auth,
      preRequestScript: request.preRequestScript,
      testScript: request.testScript,
    });
    return res.success && res.data ? res.data : null;
  } catch {
    return null;
  }
};

export const saveRequestToServer = async (request: ApiRequest): Promise<boolean> => {
  if (!canSyncToServer() || !request.collectionId) return false;
  try {
    const res = await apiClient.patch<ApiRequest>(`/api/requests/${request._id}`, {
      name: request.name,
      method: request.method,
      url: request.url,
      params: request.params,
      headers: request.headers,
      body: request.body,
      auth: request.auth,
      preRequestScript: request.preRequestScript,
      testScript: request.testScript,
    });
    return res.success && Boolean(res.data);
  } catch {
    return false;
  }
};
