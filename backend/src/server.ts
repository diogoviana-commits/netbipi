import http from 'http';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env';
import { connectDB } from './config/database';
import { requestLogger } from './middlewares/requestLogger';
import { errorHandler } from './middlewares/errorHandler';
import { initSocket } from './socket';
import { startEscalationService } from './services/escalationService';

import authRoutes from './routes/auth';
import alertRoutes from './routes/alerts';
import ticketRoutes from './routes/tickets';
import assetRoutes from './routes/assets';
import logRoutes from './routes/logs';
import networkRoutes from './routes/network';
import dashboardRoutes from './routes/dashboard';
import webhookRoutes from './routes/webhooks';
import knowledgeRoutes from './routes/knowledge';
import reportsRoutes from './routes/reports';
import cloudRoutes from './routes/cloud';
import escalationRoutes from './routes/escalation';
import notificationsRoutes from './routes/notifications';
import shiftRoutes from './routes/shift';
import timelineRoutes from './routes/timeline';

const app = express();

app.use(helmet());
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'NetBIPI Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/network', networkRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/webhooks', webhookRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/cloud', cloudRoutes);
app.use('/api/escalation', escalationRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/shift', shiftRoutes);
app.use('/api/timeline', timelineRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

app.use(errorHandler);

const httpServer = http.createServer(app);
initSocket(httpServer);

const startServer = async () => {
  try {
    await connectDB();
    startEscalationService();
    httpServer.listen(env.PORT, () => {
      console.log(`NetBIPI Backend rodando na porta ${env.PORT}`);
      console.log(`Ambiente: ${env.NODE_ENV}`);
      console.log(`Health check: http://localhost:${env.PORT}/health`);
    });
  } catch (err) {
    console.error('Falha ao iniciar servidor:', err);
    process.exit(1);
  }
};

startServer();

export default app;
