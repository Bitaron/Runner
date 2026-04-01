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
  switch (auth.type) {
    case 'bearer':
      config.headers!['Authorization'] = `${auth.bearer?.prefix || 'Bearer'} ${auth.bearer?.token}`;
      break;
    
    case 'basic':
      const credentials = Buffer.from(`${auth.basic?.username}:${auth.basic?.password}`).toString('base64');
      config.headers!['Authorization'] = `Basic ${credentials}`;
      break;
    
    case 'apikey':
      if (auth.apikey?.location === 'header') {
        config.headers![auth.apikey.key] = auth.apikey.value;
      } else {
        params.push({ key: auth.apikey?.key || '', value: auth.apikey?.value || '' });
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

router.post('/', optionalAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { method, url, headers, params, body, auth, timeout, followRedirects = true, verifySsl = true } = req.body as ExecuteRequestBody;

    if (!url) {
      res.status(400).json({ success: false, error: 'URL is required' });
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

      const config: AxiosRequestConfig = {
        method: method.toLowerCase() as Method,
        url: fullUrl,
        headers: axiosHeaders,
        timeout: timeout || 30000,
        validateStatus: () => true,
        maxRedirects: followRedirects ? 5 : 0,
        httpsAgent: verifySsl ? undefined : new (require('https').Agent)({ rejectUnauthorized: false }),
      };

      if (auth && auth.type !== 'none') {
        applyAuth(config, auth, filteredParams, filteredHeaders);
      }

      if (body && body.mode !== 'none') {
        switch (body.mode) {
          case 'raw':
            config.data = body.raw;
            if (!config.headers) config.headers = {};
            if (body.rawType === 'json') {
              config.headers['Content-Type'] = 'application/json';
            } else if (body.rawType === 'xml') {
              config.headers['Content-Type'] = 'application/xml';
            }
            break;
          
          case 'formdata':
            const formData = new FormData();
            (body.formdata || []).filter((f) => !f.disabled).forEach((f) => {
              formData.append(f.key, f.value);
            });
            config.data = formData;
            break;
          
          case 'urlencoded':
            config.data = (body.urlencoded || [])
              .filter((f) => !f.disabled)
              .map((f) => `${encodeURIComponent(f.key)}=${encodeURIComponent(f.value)}`)
              .join('&');
            if (!config.headers) config.headers = {};
            config.headers['Content-Type'] = 'application/x-www-form-urlencoded';
            break;
          
          case 'graphql':
            config.data = JSON.stringify({
              query: body.graphql?.query,
              variables: body.graphql?.variables ? JSON.parse(body.graphql.variables) : undefined,
            });
            if (!config.headers) config.headers = {};
            config.headers['Content-Type'] = 'application/json';
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
