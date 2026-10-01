import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { DailyEntryService } from '../../app/services/daily-entry.service.js';
import { healthRoutes } from './routes/health.routes.js';
import { dashboardRoutes } from './routes/dashboard.routes.js';
import { entryRoutes } from './routes/entry.routes.js';
import { negentropyRoutes } from './routes/negentropy.routes.js';

export function createHttpServer(dailyEntryService: DailyEntryService): FastifyInstance {
  const server = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] || 'info',
    },
  });

  // Enable CORS
  server.register(cors, {
    origin: true, // Allow all origins for dev/docker
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // Register health route
  server.register(healthRoutes);

  // Register domain routes
  server.register(dashboardRoutes, { dailyEntryService });
  server.register(entryRoutes, { dailyEntryService });
  server.register(negentropyRoutes, { dailyEntryService });

  return server;
}
