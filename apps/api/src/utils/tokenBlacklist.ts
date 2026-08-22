import { getDocument, createDocument, deleteDocument } from '../config/database';
import type { RevokedToken } from '@apiforge/shared';

const memoryCache = new Map<string, number>();

const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [jti, expiresAt] of memoryCache) {
    if (expiresAt <= now) {
      memoryCache.delete(jti);
    }
  }
}, CLEANUP_INTERVAL_MS).unref();

const revokedId = (jti: string): string => `revoked:${jti}`;

export const blacklistToken = async (jti: string, exp: number): Promise<void> => {
  const expiresAtMs = exp * 1000;
  if (expiresAtMs <= Date.now()) return;

  memoryCache.set(jti, expiresAtMs);

  try {
    await createDocument({
      _id: revokedId(jti),
      type: 'revoked_token',
      jti,
      expiresAt: new Date(expiresAtMs).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as unknown as RevokedToken);
  } catch {
    // Already revoked (409 conflict) or DB unavailable; memory cache still holds it
  }
};

export const isTokenBlacklisted = async (jti?: string): Promise<boolean> => {
  if (!jti) return false;

  const cached = memoryCache.get(jti);
  if (cached !== undefined) {
    if (cached > Date.now()) return true;
    memoryCache.delete(jti);
    return false;
  }

  try {
    const doc = await getDocument<RevokedToken>(revokedId(jti));
    if (!doc || !doc.expiresAt) return false;

    const expiresAtMs = new Date(doc.expiresAt).getTime();
    if (expiresAtMs <= Date.now()) {
      memoryCache.delete(jti);
      void deleteDocument(revokedId(jti)).catch(() => {});
      return false;
    }

    memoryCache.set(jti, expiresAtMs);
    return true;
  } catch {
    // DB unavailable: fall back to in-memory knowledge only
    return false;
  }
};
