import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import { ProcessController } from './controllers/ProcessController';
import { logger } from './utils/logger';
import { ensureDirectoryExists, getTempDir, getOutputDir } from './utils/paths';

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.BACKEND_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure required directories exist
ensureDirectoryExists(getTempDir());
ensureDirectoryExists(getOutputDir());

// Controllers
const processController = new ProcessController(io);

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

app.get('/api/gpu-info', (req, res) => processController.getGPUInfo(req, res));
app.post('/api/process', (req, res) => processController.processVideo(req, res));
app.post('/api/cancel/:jobId', (req, res) => processController.cancelProcess(req, res));
app.get('/api/status/:jobId', (req, res) => processController.getStatus(req, res));

// WebSocket connection
io.on('connection', (socket) => {
  logger.info('Client connected', { socketId: socket.id });

  socket.on('disconnect', () => {
    logger.info('Client disconnected', { socketId: socket.id });
  });
});

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
function startServer() {
  httpServer.listen(PORT, () => {
    logger.info(`Backend server running on port ${PORT}`);
    logger.info(`WebSocket server ready`);
    logger.info(`Temp directory: ${getTempDir()}`);
    logger.info(`Output directory: ${getOutputDir()}`);
  });
}

// Export for Electron to use
export { app, httpServer, io, startServer };

// Start if running directly
if (require.main === module) {
  startServer();
}
