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

    const validationErrors = validatePostmanCollection(rawCollection);
    if (validationErrors.length > 0) {
      res.status(400).json({ success: false, error: `Invalid Postman collection: ${validationErrors.join(', ')}` });
      return;
    }

    const postmanCollection = rawCollection as PostmanCollection;

    if (!workspaceId || typeof workspaceId !== 'string') {
      res.status(400).json({ success: false, error: 'workspaceId is required' });
      return;
    }

    const collection: Collection = {
      _id: `collection:${uuidv4()}`,
      type: 'collection',
      workspaceId,
      name: postmanCollection.info.name,
      description: postmanCollection.info.description,
      variables: postmanCollection.variable || [],
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
          const url = typeof postmanItem.request.url === 'string' 
            ? postmanItem.request.url 
            : postmanItem.request.url?.raw || '';

          const headers: KeyValue[] = postmanItem.request.header?.map((h) => ({
            key: h.key,
            value: h.value,
            description: h.description,
          })) || [];

          let body: ApiRequest['body'] = { mode: 'none' };
          
          if (postmanItem.request.body) {
            switch (postmanItem.request.body.mode) {
              case 'raw':
                body = {
                  mode: 'raw',
                  raw: postmanItem.request.body.raw,
                  rawType: 'json',
                };
                break;
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
            }
          }

          const request: ApiRequest = {
            _id: `request:${uuidv4()}`,
            type: 'request',
            collectionId: collection._id,
            folderId: parentFolderId,
            workspaceId: collection.workspaceId,
            name: postmanItem.name,
            method: (postmanItem.request.method || 'GET').toUpperCase() as ApiRequest['method'],
            url,
            params: [],
            headers,
            body,
            auth: postmanItem.request.auth || { type: 'none' },
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
          const folder: Folder = {
            _id: folderId,
            name: postmanItem.name,
            description: '',
            variables: [],
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
          case 'raw':
            body = { mode: 'raw', raw: request.body.raw };
            break;
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
          auth: request.auth,
        },
      };
    };

    const convertFolder = (folder: Folder): PostmanItem => {
      return {
        name: folder.name || 'Untitled folder',
        item: [
          ...(Array.isArray(folder.requests) ? folder.requests.map(convertRequest) : []),
          ...(Array.isArray(folder.folders) ? folder.folders.map(convertFolder) : []),
        ],
      };
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
