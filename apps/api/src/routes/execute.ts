import { Router, Response } from 'express';
import axios, { AxiosRequestConfig, Method } from 'axios';
import { authMiddleware, optionalAuth, AuthenticatedRequest } from '../middleware/auth';
import type { ExecuteRequestBody, Response as ApiResponse, KeyValue, AuthConfig } from '@apiforge/shared';

const router = Router();

const parseCookies = (setCookieHeader: string[] | undefined): Array<{ name: string; value: string; domain?: string; path?: string }> => {
  if (!setCookieHeader) return [];
  
  return setCookieHeader.map((cookie) => {
    const parts = cookie.split(';');
    const [nameValue, ...attrs] = parts;
    const [name, value] = nameValue.split('=');
    
    const domainAttr = attrs.find((a) => a.trim().toLowerCase().startsWith('domain='));
    const pathAttr = attrs.find((a) => a.trim().toLowerCase().startsWith('path='));
    
    return {
      name: name?.trim() || '',
      value: value?.trim() || '',
      domain: domainAttr?.split('=')[1]?.trim(),
      path: pathAttr?.split('=')[1]?.trim(),
    };
  });
};

const applyAuth = (config: AxiosRequestConfig, auth: AuthConfig, params: KeyValue[], headers: KeyValue[]): void => {
  config.headers = config.headers || {};
  const hasHeader = (name: string) =>
    headers.some((h) => !h.disabled && h.key.trim().toLowerCase() === name.toLowerCase()) ||
    Object.keys(config.headers as Record<string, string>).some((k) => k.toLowerCase() === name.toLowerCase());
  switch (auth.type) {
    case 'bearer':
      if (!hasHeader('Authorization')) {
        config.headers!['Authorization'] = `${auth.bearer?.prefix || 'Bearer'} ${auth.bearer?.token}`;
      }
      break;
    
    case 'basic': {
      if (!hasHeader('Authorization')) {
        const credentials = Buffer.from(`${auth.basic?.username}:${auth.basic?.password}`).toString('base64');
        config.headers!['Authorization'] = `Basic ${credentials}`;
      }
      break;
    }
    
    case 'apikey':
      if (auth.apikey?.location === 'header') {
        if (!hasHeader(auth.apikey.key)) {
          config.headers![auth.apikey.key] = auth.apikey.value;
        }
      } else {
        // Avoid duplicate query param if already explicitly present
        if (!params.some((p) => !p.disabled && p.key === auth.apikey?.key)) {
          params.push({ key: auth.apikey?.key || '', value: auth.apikey?.value || '' });
        }
      }
      break;
    
    case 'awsv4':
      // AWS Signature would need a library like aws4
      break;
    
    case 'hawk':
      // Hawk authentication would need a library
      break;
  }
};

const buildUrl = (url: string, params: KeyValue[]): string => {
  const enabledParams = params.filter((p) => !p.disabled && p.key);
  if (enabledParams.length === 0) return url;
  
  const separator = url.includes('?') ? '&' : '?';
  const queryString = enabledParams
    .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
    .join('&');
  
  return `${url}${separator}${queryString}`;
};

const BLOCKED_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);
const BLOCKED_PREFIXES = ['10.', '192.168.', '172.16.', '172.17.', '172.18.', '172.19.', '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.', '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.', '169.254.'];
const BLOCKED_HOST_SUFFIXES = ['.internal', '.local'];

const isBlockedUrl = (rawUrl: string): string | null => {
  try {
    const u = new URL(rawUrl);
    if (!['http:', 'https:'].includes(u.protocol)) return 'Only http and https protocols are allowed';
    const host = u.hostname.toLowerCase();
    if (!host) return 'Invalid URL';
    if (BLOCKED_HOSTS.has(host)) return 'Requests to localhost are not allowed';
    if (BLOCKED_PREFIXES.some(p => host.startsWith(p) || u.hostname.startsWith(p))) return 'Requests to private networks are not allowed';
    if (BLOCKED_HOST_SUFFIXES.some(s => host.endsWith(s))) return 'Requests to internal hosts are not allowed';
    // Block cloud metadata service
    if (host === '169.254.169.254' || host === 'metadata.google.internal') return 'Requests to metadata service are not allowed';
    // Block couchdb/internal service port if attacker tries to target API itself
    const couchUrl = process.env.COUCHDB_URL || '';
    try {
      const couchHost = couchUrl ? new URL(couchUrl).hostname.toLowerCase() : '';
      if (couchHost && host === couchHost) return 'Requests to internal services are not allowed';
    } catch {}
    return null;
  } catch {
    return 'Invalid URL';
  }
};

router.post('/', optionalAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { method, url, headers, params, body, auth, timeout, followRedirects = true, verifySsl } = req.body as ExecuteRequestBody;

    if (!url) {
      res.status(400).json({ success: false, error: 'URL is required' });
      return;
    }
    const blockedReason = isBlockedUrl(url);
    if (blockedReason) {
      res.status(400).json({ success: false, error: blockedReason });
      return;
    }
    // verifySsl must default to true and can only be disabled explicitly by authenticated users
    const allowInsecure = verifySsl === false && !!req.user;
    if (verifySsl === false && !req.user) {
      res.status(403).json({ success: false, error: 'Disabling SSL verification requires authentication' });
      return;
    }

    const startTime = Date.now();
    let responseHeaders: Record<string, string> = {};
    let cookies: Array<{ name: string; value: string; domain?: string; path?: string }> = [];
    let bodyString = '';
    let contentType = 'text/plain';
    let status = 0;
    let statusText = '';

    try {
      const filteredHeaders = (headers || []).filter((h) => !h.disabled && h.key);
      const filteredParams = (params || []).filter((p) => !p.disabled && p.key);

      const axiosHeaders: Record<string, string> = {};
      filteredHeaders.forEach((h) => {
        axiosHeaders[h.key] = h.value;
      });

      const fullUrl = buildUrl(url, filteredParams);

      // re-validate full URL after query params appended
      const blockedFull = isBlockedUrl(fullUrl);
      if (blockedFull) {
        res.status(400).json({ success: false, error: blockedFull });
        return;
      }
      const config: AxiosRequestConfig = {
        method: method.toLowerCase() as Method,
        url: fullUrl,
        headers: axiosHeaders,
        timeout: Math.min(timeout || 30000, 30000),
        validateStatus: () => true,
        maxRedirects: followRedirects ? 5 : 0,
        httpsAgent: allowInsecure ? new (require('https').Agent)({ rejectUnauthorized: false }) : undefined,
      };

      if (auth && auth.type !== 'none') {
        applyAuth(config, auth, filteredParams, filteredHeaders);
      }

      // ── gRPC stub (unary) ──
      if (body && body.mode === 'grpc') {
        const grpc = body.grpc || { service: '', method: '', message: '', metadata: [] };
        const mockBody = JSON.stringify({
          _grpcStub: true,
          service: grpc.service,
          method: grpc.method,
          serverUrl: grpc.serverUrl || url,
          message: (() => { try { return JSON.parse(grpc.message || '{}'); } catch { return grpc.message; } })(),
          metadata: grpc.metadata?.filter(m => !m.disabled) || [],
          note: 'gRPC execution is stubbed — install @grpc/grpc-js and provide .proto to enable real calls. This mock echo returns your message.',
        }, null, 2);
        const responseData: ApiResponse = {
          status: 200,
          statusText: 'OK (gRPC mock)',
          headers: { 'content-type': 'application/json', 'x-grpc-stub': 'true' },
          body: mockBody,
          contentType: 'application/json',
          time: Date.now() - startTime,
          size: Buffer.byteLength(mockBody, 'utf8'),
          cookies: [],
        };
        res.json({ success: true, data: responseData });
        return;
      }

      if (body && body.mode !== 'none') {
        const hasContentType = (hdrs: Record<string, string> | undefined): boolean =>
          hdrs ? Object.keys(hdrs).some((k) => k.toLowerCase() === 'content-type') : false;

        switch (body.mode) {
          case 'raw':
            config.data = body.raw;
            if (!config.headers) config.headers = {};
            if (!hasContentType(config.headers as Record<string, string>)) {
              if (body.rawType === 'json') {
                config.headers['Content-Type'] = 'application/json';
              } else if (body.rawType === 'xml') {
                config.headers['Content-Type'] = 'application/xml';
              } else if (body.rawType === 'html') {
                config.headers['Content-Type'] = 'text/html';
              } else if (body.rawType === 'text') {
                config.headers['Content-Type'] = 'text/plain';
              } else if (!body.rawType) {
                // align with frontend fallback (defaults to json in UI, but text/plain if unknown)
                config.headers['Content-Type'] = 'text/plain';
              } else {
                config.headers['Content-Type'] = 'text/plain';
              }
            }
            break;
          
          case 'formdata': {
            const formData = new FormData();
            (body.formdata || []).filter((f) => !f.disabled).forEach((f) => {
              formData.append(f.key, f.value);
            });
            config.data = formData;
            break;
          }
          
          case 'urlencoded':
            config.data = (body.urlencoded || [])
              .filter((f) => !f.disabled)
              .map((f) => `${encodeURIComponent(f.key)}=${encodeURIComponent(f.value)}`)
              .join('&');
            if (!config.headers) config.headers = {};
            if (!hasContentType(config.headers as Record<string, string>)) {
              config.headers['Content-Type'] = 'application/x-www-form-urlencoded';
            }
            break;
          
          case 'graphql':
            config.data = JSON.stringify({
              query: body.graphql?.query,
              variables: body.graphql?.variables ? JSON.parse(body.graphql.variables) : undefined,
            });
            if (!config.headers) config.headers = {};
            if (!hasContentType(config.headers as Record<string, string>)) {
              config.headers['Content-Type'] = 'application/json';
            }
            break;
          
          case 'binary':
            // Binary file upload would need the file to be sent
            break;
        }
      }

      const response = await axios(config);
      const endTime = Date.now();

      status = response.status;
      statusText = response.statusText;

      responseHeaders = {};
      Object.entries(response.headers).forEach(([key, value]) => {
        if (typeof value === 'string') {
          responseHeaders[key] = value;
        } else if (Array.isArray(value)) {
          responseHeaders[key] = value.join(', ');
        }
      });

      if (Array.isArray(response.headers['set-cookie'])) {
        cookies = parseCookies(response.headers['set-cookie']);
      }

      if (Buffer.isBuffer(response.data)) {
        bodyString = response.data.toString('base64');
        contentType = responseHeaders['content-type'] || 'application/octet-stream';
      } else if (typeof response.data === 'object') {
        bodyString = JSON.stringify(response.data, null, 2);
        contentType = 'application/json';
      } else {
        bodyString = String(response.data);
        contentType = responseHeaders['content-type'] || 'text/plain';
      }

      const responseData: ApiResponse = {
        status,
        statusText,
        headers: responseHeaders,
        body: bodyString,
        contentType,
        time: endTime - startTime,
        size: Buffer.byteLength(bodyString, 'utf8'),
        cookies,
      };

      res.json({ success: true, data: responseData });
    } catch (error) {
      const endTime = Date.now();
      const errorMessage = error instanceof Error ? error.message : 'Request failed';
      
      const errorResponse: ApiResponse = {
        status: 0,
        statusText: 'Error',
        headers: {},
        body: errorMessage,
        contentType: 'text/plain',
        time: endTime - startTime,
        size: Buffer.byteLength(errorMessage, 'utf8'),
        cookies: [],
      };

      res.json({ success: true, data: errorResponse });
    }
  } catch (error) {
    console.error('Execute request error:', error);
    res.status(500).json({ success: false, error: 'Request execution failed' });
  }
});

export default router;
