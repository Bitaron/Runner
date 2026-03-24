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

router.post('/postman', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { collection: postmanCollection, workspaceId } = req.body as { collection: PostmanCollection; workspaceId?: string };

    if (!postmanCollection || !postmanCollection.info || !postmanCollection.info.name) {
      res.status(400).json({ success: false, error: 'Invalid Postman collection' });
      return;
    }

    const collection: Collection = {
      _id: `collection:${uuidv4()}`,
      type: 'collection',
      workspaceId: workspaceId || 'default',
      name: postmanCollection.info.name,
      description: postmanCollection.info.description,
      variables: postmanCollection.variable || [],
      auth: postmanCollection.auth,
      preRequestScript: postmanCollection.event?.find((e) => e.listen === 'prerequest')?.script?.exec as string,
      testScript: postmanCollection.event?.find((e) => e.listen === 'test')?.script?.exec as string,
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
            preRequestScript: postmanItem.event?.find((e) => e.listen === 'prerequest')?.script?.exec as string,
            testScript: postmanItem.event?.find((e) => e.listen === 'test')?.script?.exec as string,
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
      const url = request.url;
      const queryParams: KeyValue[] = request.params.filter((p) => !p.disabled);

      let body: PostmanItem['request'] extends { body?: infer B } ? B : never = undefined;

      if (request.body.mode !== 'none') {
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
        name: request.name,
        request: {
          method: request.method,
          header: request.headers.filter((h) => !h.disabled).map((h) => ({
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
        name: folder.name,
        item: [
          ...folder.requests.map(convertRequest),
          ...folder.folders.map(convertFolder),
        ],
      };
    };

    const postmanCollection: PostmanCollection = {
      info: {
        name: collection.name,
        description: collection.description,
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        _postman_id: collection._id,
      },
      item: [
        ...collection.requests.map(convertRequest),
        ...collection.folders.map(convertFolder),
      ],
      variable: collection.variables,
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
