import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createDocument, getDocument, updateDocument, getDb } from '../config/database';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import type { 
  Collection, 
  ApiRequest, 
  Folder, 
  KeyValue, 
  Variable, 
  AuthConfig,
  PostmanCollection,
  PostmanItem,
} from '@apiforge/shared';

const router = Router();

type JsonRecord = Record<string, unknown>;

// ── Helpers for OpenAPI / cURL ──────────────────────────────────
let yamlLoad: ((str: string) => unknown) | null = null;
try {
  // js-yaml is available transitively; avoid hard dependency failure
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  yamlLoad = require('js-yaml').load as (str: string) => unknown;
} catch { yamlLoad = null; }

const tryParseOpenApiSpec = (raw: string): unknown | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // try JSON first
  try { return JSON.parse(trimmed); } catch {}
  if (yamlLoad) { try { return yamlLoad(trimmed); } catch {} }
  return null;
};

const isOpenApiSpec = (obj: unknown): boolean => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  const rec = obj as Record<string, unknown>;
  return typeof rec.openapi === 'string' && (rec.openapi as string).startsWith('3.') || typeof rec.swagger === 'string';
};

const sanitizeBaseUrl = (servers: unknown): string => {
  if (!Array.isArray(servers) || servers.length === 0) return '';
  const first = servers[0] as Record<string, unknown>;
  let url = typeof first.url === 'string' ? first.url : '';
  // resolve server variables defaults
  if (first.variables && typeof first.variables === 'object') {
    for (const [k, v] of Object.entries(first.variables as Record<string, unknown>)) {
      const def = (v as Record<string, unknown>)?.default;
      if (typeof def === 'string') url = url.replace(`{${k}}`, def);
    }
  }
  return url.replace(/\/$/, '');
};

const tokenizeCurl = (cmd: string): string[] => {
  const tokens: string[] = [];
  let cur = '';
  let inSingle = false;
  let inDouble = false;
  let escaped = false;
  for (let i = 0; i < cmd.length; i++) {
    const ch = cmd[i];
    if (escaped) { cur += ch; escaped = false; continue; }
    if (ch === '\\' && !inSingle) { escaped = true; continue; }
    if (ch === "'" && !inDouble) { inSingle = !inSingle; continue; }
    if (ch === '"' && !inSingle) { inDouble = !inDouble; continue; }
    if (!inSingle && !inDouble && /\s/.test(ch)) {
      if (cur) { tokens.push(cur); cur = ''; }
      continue;
    }
    cur += ch;
  }
  if (cur) tokens.push(cur);
  return tokens;
};

const parseCurlCommand = (raw: string): { method?: string; url: string; headers: KeyValue[]; params: KeyValue[]; body: ApiRequest['body']; auth?: AuthConfig } | null => {
  let cmd = raw.trim();
  // strip leading `curl ` and line continuations `\\\n`
  cmd = cmd.replace(/\\\n/g, ' ');
  const tokens = tokenizeCurl(cmd);
  if (tokens.length === 0 || tokens[0] !== 'curl') return null;
  let method: string | undefined;
  let url = '';
  const headers: KeyValue[] = [];
  const params: KeyValue[] = [];
  let dataParts: string[] = [];
  let isGet = false;
  let auth: AuthConfig | undefined;
  let formData: KeyValue[] | undefined;
  const dataUrlEncode: KeyValue[] = [];
  for (let i = 1; i < tokens.length; i++) {
    const tok = tokens[i];
    const next = () => tokens[++i] ?? '';
    switch (tok) {
      case '-X': case '--request': method = next().toUpperCase(); break;
      case '-H': case '--header': {
        const h = next(); const idx = h.indexOf(':');
        if (idx > -1) headers.push({ key: h.slice(0, idx).trim(), value: h.slice(idx + 1).trim() });
        break;
      }
      case '-A': case '--user-agent': headers.push({ key: 'User-Agent', value: next() }); break;
      case '-e': case '--referer': headers.push({ key: 'Referer', value: next() }); break;
      case '-u': case '--user': {
        const cred = next(); const [u, ...rest] = cred.split(':');
        auth = { type: 'basic', basic: { username: u, password: rest.join(':') } };
        break;
      }
      case '-d': case '--data': case '--data-raw': case '--data-binary': case '--data-ascii': dataParts.push(next()); break;
      case '--data-urlencode': {
        const v = next(); const eq = v.indexOf('=');
        if (eq > -1) dataUrlEncode.push({ key: v.slice(0, eq), value: v.slice(eq + 1) });
        else dataUrlEncode.push({ key: v, value: '' });
        break;
      }
      case '-F': case '--form': {
        const f = next(); const eq = f.indexOf('=');
        if (!formData) formData = [];
        if (eq > -1) {
          const k = f.slice(0, eq); let val = f.slice(eq + 1);
          if (val.startsWith('@')) val = val.slice(1);
          formData.push({ key: k, value: val });
        } else formData.push({ key: f, value: '' });
        break;
      }
      case '-G': case '--get': isGet = true; break;
      case '--url': url = next(); break;
      case '-k': case '--insecure': case '-s': case '--silent': case '-v': case '--verbose': case '-i': case '--include': case '-L': case '--location': case '--compressed': break;
      default:
        if (tok.startsWith('-')) break;
        if (!url) url = tok;
        break;
    }
  }
  if (!url) return null;
  // handle dataUrlEncode
  if (dataUrlEncode.length) {
    if (formData) formData.push(...dataUrlEncode);
    else if (isGet) params.push(...dataUrlEncode);
    else dataParts.push(dataUrlEncode.map(kv => `${encodeURIComponent(kv.key)}=${encodeURIComponent(kv.value)}`).join('&'));
  }
  // -G moves data to query
  if (isGet && dataParts.length) {
    const qs = dataParts.join('&');
    for (const pair of qs.split('&')) {
      if (!pair) continue; const [k, ...rest] = pair.split('='); params.push({ key: decodeURIComponent(k), value: decodeURIComponent(rest.join('=')) });
    }
    dataParts = [];
  } else if (dataParts.length && !method) {
    method = 'POST';
  }
  let body: ApiRequest['body'] = { mode: 'none' };
  if (formData && formData.length) {
    body = { mode: 'formdata', formdata: formData };
    if (!method) method = 'POST';
  } else if (dataParts.length) {
    const raw = dataParts.join('&');
    // detect json vs urlencoded
    const ct = headers.find(h => h.key.toLowerCase() === 'content-type')?.value.toLowerCase() || '';
    if (ct.includes('json') || (raw.trim().startsWith('{') && raw.trim().endsWith('}'))) {
      try { JSON.parse(raw); body = { mode: 'raw', raw, rawType: 'json' }; } catch { body = { mode: 'raw', raw, rawType: 'text' }; }
    } else if (ct.includes('x-www-form-urlencoded') || raw.includes('=') && raw.includes('&')) {
      const pairs = raw.split('&').map(p => { const [k, ...v] = p.split('='); return { key: decodeURIComponent(k), value: decodeURIComponent(v.join('=')) }; });
      body = { mode: 'urlencoded', urlencoded: pairs };
    } else {
      // try json else text
      try { JSON.parse(raw); body = { mode: 'raw', raw, rawType: 'json' }; } catch { body = { mode: 'raw', raw, rawType: 'text' }; }
    }
  }
  // extract query from url into params
  try {
    const u = new URL(url);
    u.searchParams.forEach((value, key) => params.push({ key, value }));
    url = `${u.origin}${u.pathname}`;
    if (url.endsWith('/') && u.pathname !== '/') url = url.slice(0, -1);
    // keep if no origin (relative) -> don't use URL
  } catch {
    const qIdx = url.indexOf('?');
    if (qIdx > -1) {
      const qs = url.slice(qIdx + 1); url = url.slice(0, qIdx);
      for (const pair of qs.split('&')) {
        if (!pair) continue; const [k, ...rest] = pair.split('='); params.push({ key: decodeURIComponent(k), value: decodeURIComponent(rest.join('=')) });
      }
    }
  }
  return { method: method || 'GET', url, headers, params, body, auth };
};

const convertOpenApiToCollection = (spec: Record<string, unknown>, workspaceId: string, userId: string): Collection => {
  const info = (spec.info as Record<string, unknown>) || {};
  const title = typeof info.title === 'string' && info.title.trim() ? info.title.trim() : 'Imported OpenAPI';
  const description = typeof info.description === 'string' ? info.description : `Imported from OpenAPI ${spec.openapi || spec.swagger || ''}`.trim();
  const baseUrl = sanitizeBaseUrl(spec.servers);
  const collection: Collection = {
    _id: `collection:${uuidv4()}`,
    type: 'collection',
    workspaceId,
    name: title,
    description,
    variables: [],
    folders: [],
    requests: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: userId,
  };
  const paths = (spec.paths as Record<string, unknown>) || {};
  const tagFolders = new Map<string, Folder>();
  const httpMethods = ['get','post','put','patch','delete','head','options','trace'] as const;
  for (const [pathKey, pathItemRaw] of Object.entries(paths)) {
    if (!pathItemRaw || typeof pathItemRaw !== 'object' || Array.isArray(pathItemRaw)) continue;
    const pathItem = pathItemRaw as Record<string, unknown>;
    const pathLevelParams = Array.isArray(pathItem.parameters) ? pathItem.parameters as Array<Record<string, unknown>> : [];
    for (const m of httpMethods) {
      const opRaw = pathItem[m];
      if (!opRaw || typeof opRaw !== 'object' || Array.isArray(opRaw)) continue;
      const op = opRaw as Record<string, unknown>;
      const summary = typeof op.summary === 'string' ? op.summary : undefined;
      const operationId = typeof op.operationId === 'string' ? op.operationId : undefined;
      const name = summary || operationId || `${m.toUpperCase()} ${pathKey}`;
      const desc = typeof op.description === 'string' ? op.description : summary || '';
      const tags = Array.isArray(op.tags) ? (op.tags as string[]) : [];
      const opParams = Array.isArray(op.parameters) ? op.parameters as Array<Record<string, unknown>> : [];
      const allParams = [...pathLevelParams, ...opParams];
      const headers: KeyValue[] = [];
      const params: KeyValue[] = [];
      for (const p of allParams) {
        const inLoc = p.in as string; const pName = typeof p.name === 'string' ? p.name : '';
        if (!pName) continue;
        if (inLoc === 'query') params.push({ key: pName, value: (p.example as string) ?? (p.schema as Record<string, unknown>)?.example as string ?? (p.schema as Record<string, unknown>)?.default as string ?? '', description: p.description as string | undefined, disabled: p.required !== true });
        else if (inLoc === 'header') headers.push({ key: pName, value: (p.example as string) ?? '', description: p.description as string | undefined, disabled: p.required !== true });
      }
      let body: ApiRequest['body'] = { mode: 'none' };
      const requestBody = op.requestBody as Record<string, unknown> | undefined;
      if (requestBody && typeof requestBody.content === 'object' && requestBody.content) {
        const content = requestBody.content as Record<string, unknown>;
        if (content['application/json']) {
          const j = content['application/json'] as Record<string, unknown>;
          const firstExampleKey = Object.keys((j.examples as Record<string, unknown>) || {})[0];
          const firstExampleVal = firstExampleKey ? (j.examples as Record<string, Record<string, unknown>>)?.[firstExampleKey]?.value : undefined;
          const ex = (j.example ?? firstExampleVal ?? (j.schema as Record<string, unknown>)?.example);
          let raw = '';
          if (ex !== undefined) raw = typeof ex === 'string' ? ex as string : JSON.stringify(ex, null, 2);
          else raw = '{\n  \n}';
          body = { mode: 'raw', raw, rawType: 'json' };
        } else if (content['application/x-www-form-urlencoded']) {
          const s = (content['application/x-www-form-urlencoded'] as Record<string, unknown>).schema as Record<string, unknown> | undefined;
          const props = (s?.properties as Record<string, Record<string, unknown>>) || {};
          body = { mode: 'urlencoded', urlencoded: Object.keys(props).map(k => ({ key: k, value: (props[k].example as string) ?? '' })) };
        } else if (content['multipart/form-data']) {
          const s = (content['multipart/form-data'] as Record<string, unknown>).schema as Record<string, unknown> | undefined;
          const props = (s?.properties as Record<string, Record<string, unknown>>) || {};
          body = { mode: 'formdata', formdata: Object.keys(props).map(k => ({ key: k, value: '' })) };
        } else {
          const firstKey = Object.keys(content)[0];
          const first = content[firstKey] as Record<string, unknown> | undefined;
          const ex = first?.example as string | undefined;
          body = { mode: 'raw', raw: ex ?? '', rawType: firstKey?.includes('xml') ? 'xml' : 'text' };
        }
      }
      let url = `${baseUrl}${pathKey}`;
      // keep path params as-is: e.g. {id} stays
      const request: ApiRequest = {
        _id: `request:${uuidv4()}`,
        type: 'request',
        collectionId: collection._id,
        folderId: undefined,
        workspaceId,
        name,
        method: m.toUpperCase() as ApiRequest['method'],
        url,
        params,
        headers,
        body,
        auth: { type: 'none', inheritFromParent: true },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: userId,
      };
      if (desc) (request as unknown as Record<string, unknown>).description = desc;
      if (tags.length > 0) {
        const tag = tags[0];
        let folder = tagFolders.get(tag);
        if (!folder) {
          folder = { _id: `folder:${uuidv4()}`, name: tag, description: '', variables: [], requests: [], folders: [] };
          tagFolders.set(tag, folder);
        }
        request.folderId = folder._id;
        folder.requests.push(request);
      } else {
        collection.requests.push(request);
      }
    }
  }
  collection.folders = Array.from(tagFolders.values());
  return collection;
};

const validatePostmanRequest = (request: unknown, path: string, errors: string[]): void => {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    errors.push(`${path}.request must be an object`);
    return;
  }
  const req = request as JsonRecord;
  if (typeof req.method !== 'string' || req.method.trim() === '') {
    errors.push(`${path}.request.method must be a non-empty string`);
  }
  const urlIsRaw = typeof req.url === 'string';
  const urlIsObject =
    !!req.url &&
    typeof req.url === 'object' &&
    !Array.isArray(req.url) &&
    typeof (req.url as JsonRecord).raw === 'string';
  if (!urlIsRaw && !urlIsObject) {
    errors.push(`${path}.request.url must be a string or an object with a "raw" string`);
  }
};

const validatePostmanItems = (items: unknown[], path: string, errors: string[]): void => {
  items.forEach((entry, index) => {
    const itemPath = `${path}[${index}]`;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      errors.push(`${itemPath} must be an object`);
      return;
    }
    const item = entry as JsonRecord;
    if (item.request !== undefined) {
      validatePostmanRequest(item.request, itemPath, errors);
    }
    if (item.item !== undefined) {
      if (!Array.isArray(item.item)) {
        errors.push(`${itemPath}.item must be an array`);
      } else {
        validatePostmanItems(item.item, `${itemPath}.item`, errors);
      }
    }
  });
};

const validatePostmanCollection = (input: unknown): string[] => {
  const errors: string[] = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return ['collection must be an object'];
  }
  const col = input as JsonRecord;
  if (!col.info || typeof col.info !== 'object' || Array.isArray(col.info)) {
    errors.push('missing required top-level "info" object');
  } else {
    const info = col.info as JsonRecord;
    if (typeof info.name !== 'string' || info.name.trim() === '') {
      errors.push('"info.name" must be a non-empty string');
    }
  }
  if (!Array.isArray(col.item)) {
    errors.push('missing required top-level "item" array');
  } else {
    validatePostmanItems(col.item, 'item', errors);
  }
  return errors;
};

router.post('/postman', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { collection: rawCollection, workspaceId } = req.body as { collection?: unknown; workspaceId?: string };

    if (!rawCollection || typeof rawCollection !== 'object' || Array.isArray(rawCollection)) {
      res.status(400).json({ success: false, error: 'Invalid Postman collection: request body must contain a "collection" object' });
      return;
    }

    if (!workspaceId || typeof workspaceId !== 'string') {
      res.status(400).json({ success: false, error: 'workspaceId is required' });
      return;
    }

    const inferRawType = (raw: string | undefined, options: unknown): ApiRequest['body']['rawType'] => {
      const language = (options as Record<string, unknown> | undefined)?.raw as Record<string, unknown> | undefined;
      const lang = typeof language?.language === 'string' ? (language.language as string).toLowerCase() : undefined;
      if (lang === 'json' || lang === 'javascript') return 'json';
      if (lang === 'xml') return 'xml';
      if (lang === 'html') return 'html';
      if (lang === 'text') return 'text';
      if (raw !== undefined) {
        const trimmed = raw.trim();
        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
          try { JSON.parse(trimmed); return 'json'; } catch {}
        }
        if (trimmed.startsWith('<')) return 'xml';
      }
      return 'text';
    };

    const mapPostmanVariables = (vars: unknown): Variable[] => {
      if (!Array.isArray(vars)) return [];
      return (vars as Array<Record<string, unknown>>)
        .map((v) => ({
          key: typeof v.key === 'string' ? v.key : '',
          value: typeof v.value === 'string' ? v.value : String(v.value ?? ''),
          type: v.type === 'secret' ? 'secret' as const : 'default' as const,
          enabled: (v as { enabled?: boolean }).enabled !== false && !(v as { disabled?: boolean }).disabled,
        }))
        .filter((v) => v.key && v.key.trim().length > 0);
    };

    // Detect Postman Environment (has values, no info) — handle separately
    const isPostmanEnvironment = (() => {
      const rec = rawCollection as Record<string, unknown>;
      return Array.isArray(rec.values) && typeof rec.name === 'string' && !rec.info;
    })();

    if (isPostmanEnvironment) {
      const envRec = rawCollection as Record<string, unknown>;
      const envName = typeof envRec.name === 'string' && (envRec.name as string).trim() ? (envRec.name as string).trim() : 'Imported Environment';
      const envValues = Array.isArray(envRec.values) ? envRec.values : [];
      const variables: Variable[] = (envValues as Array<Record<string, unknown>>)
        .map((v) => ({
          key: typeof v.key === 'string' ? v.key : '',
          value: typeof v.value === 'string' ? v.value : String(v.value ?? ''),
          type: v.type === 'secret' ? 'secret' as const : 'default' as const,
          enabled: (v as { enabled?: boolean }).enabled !== false && !(v as { disabled?: boolean }).disabled,
        }))
        .filter((v) => v.key && v.key.trim().length > 0);

      if (variables.length > 0) {
        const varErrors: string[] = [];
        for (const v of variables) {
          if (!v.key.trim() || typeof v.value !== 'string') varErrors.push(`variable ${v.key} invalid`);
        }
        if (varErrors.length) {
          res.status(400).json({ success: false, error: `Invalid Postman environment: ${varErrors.join(', ')}` });
          return;
        }
      }

      const environment = {
        _id: `env:${uuidv4()}`,
        type: 'environment' as const,
        workspaceId,
        name: envName,
        variables,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isGlobal: false,
      };

      await createDocument(environment as unknown as import('@apiforge/shared').Environment);
      res.status(201).json({ success: true, data: environment });
      return;
    }

    const validationErrors = validatePostmanCollection(rawCollection);
    if (validationErrors.length > 0) {
      res.status(400).json({ success: false, error: `Invalid Postman collection: ${validationErrors.join(', ')}` });
      return;
    }

    const postmanCollection = rawCollection as PostmanCollection;

    const collection: Collection = {
      _id: `collection:${uuidv4()}`,
      type: 'collection',
      workspaceId,
      name: postmanCollection.info.name,
      description: postmanCollection.info.description,
      variables: mapPostmanVariables(postmanCollection.variable),
      auth: postmanCollection.auth,
      preRequestScript: (() => {
        const exec = postmanCollection.event?.find((e) => e.listen === 'prerequest')?.script?.exec;
        return Array.isArray(exec) ? exec.join('\n') : (exec as string | undefined);
      })(),
      testScript: (() => {
        const exec = postmanCollection.event?.find((e) => e.listen === 'test')?.script?.exec;
        return Array.isArray(exec) ? exec.join('\n') : (exec as string | undefined);
      })(),
      folders: [],
      requests: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: req.user.userId,
    };

    const parsePostmanItem = (item: PostmanItem, parentFolderId?: string): { requests: ApiRequest[]; folders: Folder[] } => {
      const requests: ApiRequest[] = [];
      const folders: Folder[] = [];

      for (const postmanItem of item.item || []) {
        if (postmanItem.request) {
          const urlObj = postmanItem.request.url;
          const url = typeof urlObj === 'string' 
            ? urlObj 
            : urlObj?.raw || '';
          const queryParams: KeyValue[] = Array.isArray((urlObj as Record<string, unknown> | undefined)?.query)
            ? ((urlObj as Record<string, unknown>).query as Array<Record<string, unknown>>).map((q) => ({
                key: typeof q.key === 'string' ? q.key : '',
                value: typeof q.value === 'string' ? q.value : '',
                description: typeof q.description === 'string' ? q.description : undefined,
                disabled: Boolean((q as { disabled?: boolean }).disabled),
              }))
            : [];

          const headers: KeyValue[] = postmanItem.request.header?.map((h) => ({
            key: h.key,
            value: h.value,
            description: h.description,
          })) || [];

          let body: ApiRequest['body'] = { mode: 'none' };
          
          if (postmanItem.request.body) {
            const bodyMode = postmanItem.request.body.mode;
            const bodyRawOptions = (postmanItem.request.body as Record<string, unknown>).options;
            switch (bodyMode) {
              case 'raw': {
                const raw = postmanItem.request.body.raw;
                body = {
                  mode: 'raw',
                  raw,
                  rawType: inferRawType(raw, bodyRawOptions),
                };
                break;
              }
              case 'formdata':
                body = {
                  mode: 'formdata',
                  formdata: postmanItem.request.body.formdata?.map((f) => ({
                    key: f.key,
                    value: f.value,
                    disabled: f.disabled,
                  })) || [],
                };
                break;
              case 'urlencoded':
                body = {
                  mode: 'urlencoded',
                  urlencoded: postmanItem.request.body.urlencoded?.map((f) => ({
                    key: f.key,
                    value: f.value,
                    disabled: f.disabled,
                  })) || [],
                };
                break;
              case 'graphql':
                body = {
                  mode: 'graphql',
                  graphql: {
                    query: postmanItem.request.body.graphql?.query || '',
                    variables: postmanItem.request.body.graphql?.variables,
                  },
                };
                break;
              default:
                body = { mode: 'none' };
                break;
            }
          }

          // Strip query string from raw URL when params are present to avoid double-encoding (buildUrl will re-add)
          const baseUrl = queryParams.length > 0 && url.includes('?') ? url.split('?')[0] : url;

          const request: ApiRequest = {
            _id: `request:${uuidv4()}`,
            type: 'request',
            collectionId: collection._id,
            folderId: parentFolderId,
            workspaceId: collection.workspaceId,
            name: postmanItem.name,
            method: (postmanItem.request.method || 'GET').toUpperCase() as ApiRequest['method'],
            url: baseUrl,
            params: queryParams,
            headers,
            body,
            auth: postmanItem.request.auth || { type: 'none', inheritFromParent: true },
            preRequestScript: (() => {
              const exec = postmanItem.event?.find((e) => e.listen === 'prerequest')?.script?.exec;
              return Array.isArray(exec) ? exec.join('\n') : (exec as string | undefined);
            })(),
            testScript: (() => {
              const exec = postmanItem.event?.find((e) => e.listen === 'test')?.script?.exec;
              return Array.isArray(exec) ? exec.join('\n') : (exec as string | undefined);
            })(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: req.user.userId,
          };

          requests.push(request);
        }

        if (postmanItem.item) {
          const folderId = `folder:${uuidv4()}`;
          const folderAuth = (postmanItem as unknown as Record<string, unknown>).auth as AuthConfig | undefined;
          const folderVars = mapPostmanVariables((postmanItem as unknown as Record<string, unknown>).variable);
          const folderDesc = typeof (postmanItem as unknown as Record<string, unknown>).description === 'string' ? (postmanItem as unknown as Record<string, unknown>).description as string : '';
          const folderEvents = (postmanItem as { event?: Array<{ listen: 'prerequest' | 'test'; script: { exec: string | string[] } }> }).event;
          const folderPre = (() => {
            const exec = folderEvents?.find((e) => e.listen === 'prerequest')?.script?.exec;
            return Array.isArray(exec) ? exec.join('\n') : (exec as string | undefined);
          })();
          const folderTest = (() => {
            const exec = folderEvents?.find((e) => e.listen === 'test')?.script?.exec;
            return Array.isArray(exec) ? exec.join('\n') : (exec as string | undefined);
          })();
          const folder: Folder = {
            _id: folderId,
            name: postmanItem.name,
            description: folderDesc,
            variables: folderVars,
            auth: folderAuth,
            preRequestScript: folderPre,
            testScript: folderTest,
            requests: [],
            folders: [],
          };

          const nested = parsePostmanItem(postmanItem, folderId);
          folder.requests = nested.requests;
          folder.folders = nested.folders;

          folders.push(folder);
        }
      }

      return { requests, folders };
    };

    const parsed = parsePostmanItem({ item: postmanCollection.item } as PostmanItem);
    collection.requests = parsed.requests;
    collection.folders = parsed.folders;

    await createDocument(collection);
    res.status(201).json({ success: true, data: collection });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ success: false, error: 'Failed to import collection' });
  }
});

// ── OpenAPI 3.x import ───────────────────────────────────────
router.post('/openapi', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }
    const { spec: rawSpec, specText, workspaceId } = req.body as { spec?: unknown; specText?: string; workspaceId?: string };
    if (!workspaceId || typeof workspaceId !== 'string') { res.status(400).json({ success: false, error: 'workspaceId is required' }); return; }
    let specObj: unknown = rawSpec;
    if (typeof specText === 'string' && specText.trim()) {
      const parsed = tryParseOpenApiSpec(specText);
      if (!parsed) { res.status(400).json({ success: false, error: 'Invalid OpenAPI spec: unable to parse JSON/YAML' }); return; }
      specObj = parsed;
    } else if (typeof rawSpec === 'string') {
      const parsed = tryParseOpenApiSpec(rawSpec as string);
      specObj = parsed ?? rawSpec;
    }
    if (!specObj || typeof specObj !== 'object' || Array.isArray(specObj)) { res.status(400).json({ success: false, error: 'Invalid OpenAPI spec: must be an object' }); return; }
    if (!isOpenApiSpec(specObj)) { res.status(400).json({ success: false, error: 'Invalid OpenAPI spec: missing openapi/swagger field' }); return; }
    const collection = convertOpenApiToCollection(specObj as Record<string, unknown>, workspaceId, req.user.userId);
    await createDocument(collection);
    res.status(201).json({ success: true, data: collection });
  } catch (error) {
    console.error('OpenAPI import error:', error);
    res.status(500).json({ success: false, error: 'Failed to import OpenAPI spec' });
  }
});

// ── cURL import ──────────────────────────────────────────────
router.post('/curl', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }
    const { curl, workspaceId, name } = req.body as { curl?: string; workspaceId?: string; name?: string };
    if (!workspaceId || typeof workspaceId !== 'string') { res.status(400).json({ success: false, error: 'workspaceId is required' }); return; }
    if (!curl || typeof curl !== 'string' || !curl.trim().startsWith('curl')) { res.status(400).json({ success: false, error: 'Invalid cURL command: must start with curl' }); return; }
    const parsed = parseCurlCommand(curl);
    if (!parsed) { res.status(400).json({ success: false, error: 'Failed to parse cURL command' }); return; }
    const collectionName = name?.trim() || 'cURL Import';
    // If a collection with that name exists, add request to it; otherwise create new collection
    let collection: Collection | null = null;
    // Try to find existing collection by name in workspace (quick scan)
    try {
      const db = getDb();
      const result = await db.find({ selector: { type: 'collection', workspaceId, name: collectionName } } as unknown as Parameters<typeof db.find>[0]);
      const docs = (result as unknown as { docs: Collection[] }).docs;
      if (docs && docs.length > 0) collection = docs[0];
    } catch {}
    const request: ApiRequest = {
      _id: `request:${uuidv4()}`,
      type: 'request',
      collectionId: collection?._id || '',
      workspaceId,
      name: (() => { try { const u = new URL(parsed.url); return `${parsed.method} ${u.pathname}`; } catch { return `${parsed.method} ${parsed.url}`; } })(),
      method: (parsed.method as ApiRequest['method']) || 'GET',
      url: parsed.url,
      params: parsed.params,
      headers: parsed.headers,
      body: parsed.body,
      auth: parsed.auth || { type: 'none', inheritFromParent: true },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: req.user.userId,
    };
    if (!collection) {
      collection = {
        _id: `collection:${uuidv4()}`,
        type: 'collection',
        workspaceId,
        name: collectionName,
        variables: [],
        folders: [],
        requests: [request],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: req.user.userId,
      };
      request.collectionId = collection._id;
      await createDocument(collection);
    } else {
      request.collectionId = collection._id;
      const updatedRequests = [...(collection.requests || []), request];
      await updateDocument(collection._id, { requests: updatedRequests } as Partial<Collection>);
      collection = { ...collection, requests: updatedRequests } as Collection;
    }
    res.status(201).json({ success: true, data: { collection, request } });
  } catch (error) {
    console.error('cURL import error:', error);
    res.status(500).json({ success: false, error: 'Failed to import cURL' });
  }
});

router.get('/postman/:id', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const collection = await getDocument<Collection>(req.params.id);
    
    if (!collection) {
      res.status(404).json({ success: false, error: 'Collection not found' });
      return;
    }

    const convertRequest = (request: ApiRequest): PostmanItem => {
      const url = typeof request.url === 'string' ? request.url : '';
      const params = Array.isArray(request.params) ? request.params : [];
      const headers = Array.isArray(request.headers) ? request.headers : [];
      const queryParams = params.filter((p) => !p.disabled);

      let body: PostmanItem['request'] extends { body?: infer B } ? B : never = undefined;

      if (request.body?.mode && request.body.mode !== 'none') {
        switch (request.body.mode) {
          case 'raw': {
            const rawTypeToLanguage: Record<string, string> = { json: 'json', xml: 'xml', html: 'html', text: 'text' };
            const lang = rawTypeToLanguage[request.body.rawType || 'text'] || 'text';
            body = { 
              mode: 'raw', 
              raw: request.body.raw,
              options: { raw: { language: lang } } as unknown as PostmanItem['request'] extends { body?: { options?: unknown } } ? { raw: { language: string } } : never,
            } as unknown as PostmanItem['request'] extends { body?: infer B } ? B : never;
            break;
          }
          case 'formdata':
            body = {
              mode: 'formdata',
              formdata: request.body.formdata?.map((f) => ({
                key: f.key,
                value: f.value,
                type: 'text',
                disabled: f.disabled,
              })),
            };
            break;
          case 'urlencoded':
            body = {
              mode: 'urlencoded',
              urlencoded: request.body.urlencoded?.map((f) => ({
                key: f.key,
                value: f.value,
                disabled: f.disabled,
              })),
            };
            break;
          case 'graphql':
            body = {
              mode: 'graphql',
              graphql: {
                query: request.body.graphql?.query || '',
                variables: request.body.graphql?.variables,
              },
            };
            break;
        }
      }

      const requestEvents: PostmanItem['event'] = [];
      if (request.preRequestScript) {
        requestEvents.push({ listen: 'prerequest', script: { type: 'text/javascript', exec: request.preRequestScript.split('\n') } });
      }
      if (request.testScript) {
        requestEvents.push({ listen: 'test', script: { type: 'text/javascript', exec: request.testScript.split('\n') } });
      }

      return {
        name: request.name || 'Untitled request',
        request: {
          method: request.method || 'GET',
          header: headers.filter((h) => !h.disabled).map((h) => ({
            key: h.key,
            value: h.value,
            description: h.description,
          })),
          url: {
            raw: queryParams.length > 0 ? `${url}?${queryParams.map((p) => `${p.key}=${p.value}`).join('&')}` : url,
          },
          body,
          auth: request.auth?.type && request.auth.type !== 'none' ? request.auth : undefined,
        },
        event: requestEvents.length > 0 ? requestEvents : undefined,
      };
    };

    const convertFolder = (folder: Folder): PostmanItem => {
      const folderEvents: PostmanItem['event'] = [];
      if (folder.preRequestScript) {
        folderEvents.push({ listen: 'prerequest', script: { type: 'text/javascript', exec: folder.preRequestScript.split('\n') } });
      }
      if (folder.testScript) {
        folderEvents.push({ listen: 'test', script: { type: 'text/javascript', exec: folder.testScript.split('\n') } });
      }
      return {
        name: folder.name || 'Untitled folder',
        description: folder.description,
        auth: folder.auth?.type && folder.auth.type !== 'none' ? folder.auth : undefined,
        variable: Array.isArray(folder.variables) && folder.variables.length > 0 ? folder.variables : undefined,
        event: folderEvents.length > 0 ? folderEvents : undefined,
        item: [
          ...(Array.isArray(folder.requests) ? folder.requests.map(convertRequest) : []),
          ...(Array.isArray(folder.folders) ? folder.folders.map(convertFolder) : []),
        ],
      } as unknown as PostmanItem;
    };

    const postmanCollection: PostmanCollection = {
      info: {
        name: collection.name || 'Untitled Collection',
        description: collection.description,
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        _postman_id: collection._id,
      },
      item: [
        ...(Array.isArray(collection.requests) ? collection.requests.map(convertRequest) : []),
        ...(Array.isArray(collection.folders) ? collection.folders.map(convertFolder) : []),
      ],
      variable: Array.isArray(collection.variables) ? collection.variables : [],
      auth: collection.auth,
      event: [
        ...(collection.preRequestScript ? [{
          listen: 'prerequest' as const,
          script: { type: 'text/javascript' as const, exec: collection.preRequestScript },
        }] : []),
        ...(collection.testScript ? [{
          listen: 'test' as const,
          script: { type: 'text/javascript' as const, exec: collection.testScript },
        }] : []),
      ],
    };

    res.json({ success: true, data: postmanCollection });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to export collection' });
  }
});

export default router;
