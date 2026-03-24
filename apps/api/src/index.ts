import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { initDatabase } from './config/database';
import { initSyncWebSocket } from './websocket';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import workspaceRoutes from './routes/workspaces';
import collectionRoutes from './routes/collections';
import requestRoutes from './routes/requests';
import environmentRoutes from './routes/environments';
import teamRoutes from './routes/teams';
import historyRoutes from './routes/history';
import executeRoutes from './routes/execute';
import importExportRoutes from './routes/importExport';
import uploadRoutes from './routes/upload';
import searchRoutes from './routes/search';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));

app.use(compression());
app.use(morgan('dev'));
app.use(cookieParser());

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { success: false, error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/environments', environmentRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/execute', executeRoutes);
app.use('/api/import', importExportRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/search', searchRoutes);

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'API is running' });
});

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
  });
});

app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

const startServer = async () => {
  try {
    await initDatabase();
    console.log('Database initialized');

    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    initSyncWebSocket(server);
    console.log('Sync WebSocket server initialized');
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
