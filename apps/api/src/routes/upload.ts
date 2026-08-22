import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

const ALLOWED_FILE_EXTENSIONS = ['.json', '.yaml', '.yml', '.xml', '.txt', '.md', '.csv', '.har', '.zip'];

const ALLOWED_MIME_TYPES = new Set([
  'application/json',
  'application/yaml',
  'application/x-yaml',
  'text/yaml',
  'text/x-yaml',
  'application/xml',
  'text/xml',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/csv',
  'application/octet-stream',
  'application/zip',
  'application/x-zip-compressed',
]);

const sanitizeFilename = (filename: string): string =>
  path.basename(filename.replace(/\\/g, '/')).replace(/[\u0000-\u001f]/g, '');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueId = uuidv4();
    const ext = path.extname(sanitizeFilename(file.originalname)).toLowerCase();
    cb(null, `${uniqueId}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(sanitizeFilename(file.originalname)).toLowerCase();
    if (!ALLOWED_FILE_EXTENSIONS.includes(ext)) {
      cb(new Error(`Unsupported file type "${ext || 'none'}". Allowed types: ${ALLOWED_FILE_EXTENSIONS.join(', ')}`));
      return;
    }
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(new Error(`Unsupported content type "${file.mimetype}".`));
      return;
    }
    cb(null, true);
  },
});

router.post('/', authMiddleware, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      res.status(status).json({ success: false, error: err.message });
      return;
    }
    if (err) {
      res.status(415).json({ success: false, error: err.message });
      return;
    }
    next();
  });
}, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file provided' });
      return;
    }

    const fileInfo = {
      id: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      path: req.file.path,
      url: `/api/files/${req.file.filename}`,
    };

    res.status(201).json({ success: true, data: fileInfo });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to upload file' });
  }
});

router.get('/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, '../../uploads', filename);
  
  res.sendFile(filePath, (err) => {
    if (err) {
      res.status(404).json({ success: false, error: 'File not found' });
    }
  });
});

export default router;
