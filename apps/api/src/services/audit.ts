import { v4 as uuidv4 } from 'uuid';
import { createDocument } from '../config/database';
import type { AuditEntry } from '@apiforge/shared';

export const logAudit = async (params: Omit<AuditEntry, '_id' | 'type' | 'timestamp'> & { timestamp?: string }): Promise<void> => {
  try {
    const entry: AuditEntry = {
      _id: `audit:${uuidv4()}`,
      type: 'audit',
      timestamp: params.timestamp || new Date().toISOString(),
      ...params,
    };
    await createDocument(entry as unknown as AuditEntry);
  } catch (e) {
    console.warn('Failed to log audit', e);
  }
};
