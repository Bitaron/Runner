import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

const VAULT_KEY_WARNING_EMITTED = { value: false };

const getKey = (): Buffer => {
  const raw = process.env.VAULT_KEY || process.env.JWT_SECRET;
  if (raw) {
    return crypto.createHash('sha256').update(raw).digest();
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: VAULT_KEY or JWT_SECRET must be set in production for vault encryption');
  }
  if (!VAULT_KEY_WARNING_EMITTED.value) {
    VAULT_KEY_WARNING_EMITTED.value = true;
    console.warn('[SECURITY WARNING] VAULT_KEY/JWT_SECRET not set. Using random per-process vault key; secrets will not survive restart. Set VAULT_KEY explicitly.');
  }
  // random per-process key, cached per module load via closure
  const ephemeral = (globalThis as unknown as { __vaultEphemeral?: string }).__vaultEphemeral
    || ((globalThis as unknown as { __vaultEphemeral?: string }).__vaultEphemeral = crypto.randomBytes(32).toString('hex'));
  return crypto.createHash('sha256').update(ephemeral).digest();
};

export const encryptSecret = (plaintext: string): string => {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // format: iv:tag:ciphertext all base64
  return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
};

export const decryptSecret = (ciphertext: string): string => {
  try {
    if (!ciphertext.includes(':')) return ciphertext; // not encrypted
    const [ivB64, tagB64, encB64] = ciphertext.split(':');
    if (!ivB64 || !tagB64 || !encB64) return ciphertext;
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const enc = Buffer.from(encB64, 'base64');
    const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    return dec.toString('utf8');
  } catch {
    return ciphertext;
  }
};

export const isEncrypted = (value: string): boolean => {
  if (!value.includes(':')) return false;
  const parts = value.split(':');
  if (parts.length !== 3) return false;
  try {
    return Buffer.from(parts[0], 'base64').length === IV_LEN && Buffer.from(parts[1], 'base64').length === TAG_LEN;
  } catch { return false; }
};

import type { Variable } from '@apiforge/shared';

export const encryptVariables = (vars: Variable[]): Variable[] =>
  vars.map(v => v.type === 'secret' && v.value && !isEncrypted(v.value) ? { ...v, value: encryptSecret(v.value) } : v);

export const decryptVariables = (vars: Variable[]): Variable[] =>
  vars.map(v => v.type === 'secret' && v.value && isEncrypted(v.value) ? { ...v, value: decryptSecret(v.value) } : v);
