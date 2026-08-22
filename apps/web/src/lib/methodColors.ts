import type { CSSProperties } from 'react';
import type { HttpMethod } from '@apiforge/shared';

/**
 * Postman-style HTTP method colors, shared across sidebar badges,
 * request builder selector, and anywhere else methods are displayed.
 * Use as inline style values so Tailwind purging never drops them.
 */
export const HTTP_METHOD_COLORS: Record<HttpMethod, string> = {
  GET: '#61affe',
  POST: '#49cc90',
  PUT: '#fca130',
  DELETE: '#f93e3e',
  PATCH: '#50e3c2',
  HEAD: '#9012fe',
  OPTIONS: '#0d5aa7',
};

export const getMethodColor = (method: string): string =>
  HTTP_METHOD_COLORS[method.toUpperCase() as HttpMethod] ?? '#9ca3af';

export const getMethodBadgeStyle = (method: string): CSSProperties => ({
  backgroundColor: getMethodColor(method),
  color: '#ffffff',
});
