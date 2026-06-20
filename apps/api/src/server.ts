/**
 * ResiliPlan API — Server Entry Point
 * Fastify with security baseline, CORS, rate limiting, health check.
 */

import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { planRoutes } from './routes/plans.js';
import { metricsRoutes } from './routes/metrics.js';
import { resilienceRoutes } from './routes/resilience.js';
import { biaRoutes } from './routes/bia.js';
import { aiRoutes } from './routes/ai.js';
import { userRoutes } from './routes/users.js';
import { billingRoutes } from './routes/billing.js';
import { emailRoutes } from './routes/email.js';
import { settingsRoutes } from './routes/settings.js';
import { CSRF_COOKIE, CSRF_HEADER, createCsrfToken, csrfCookieHeader, readCookieValue, shouldCheckCsrf, verifyCsrfToken } from './auth/csrf-service.js';

export async function buildServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      ...(config.LOG_PRETTY && config.NODE_ENV === 'development'
        ? {
            transport: {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
              },
            },
          }
        : {}),
    },
    disableRequestLogging: false,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    genReqId: () => {
      return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    },
    trustProxy: true,
  });

  // ===== Security =====
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", config.API_URL, config.APP_URL],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false, // Allow embedding
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  });

  // ===== CORS =====
  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow same-origin (no origin) and configured origins
      if (!origin) {
        cb(null, true);
        return;
      }
      const isLoopbackDevOrigin =
        config.NODE_ENV !== 'production' &&
        (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'));
      if (config.CORS_ORIGINS.includes(origin) || isLoopbackDevOrigin) {
        cb(null, true);
        return;
      }
      cb(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-CSRF-Token'],
    exposedHeaders: ['X-Request-ID'],
    maxAge: 86400, // 24 hours
  });

  // ===== Rate Limiting =====
  await app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW,
    cache: 10000, // Cache 10k IPs in memory
    allowList: [], // Add internal IPs here if needed
    errorResponseBuilder: (req, context) => {
      return {
        type: 'https://resiliplan.kantor.local/errors/rate-limit',
        title: 'Too Many Requests',
        status: 429,
        detail: `Rate limit exceeded. Try again in ${context.after}.`,
        instance: req.id,
      };
    },
  });

  // ===== Sensible (HTTP errors helpers) =====
  await app.register(sensible);

  // ===== CSRF double-submit guard =====
  app.addHook('onRequest', async (req, reply) => {
    if (!readCookieValue(req.headers.cookie, CSRF_COOKIE)) {
      reply.header('Set-Cookie', csrfCookieHeader(createCsrfToken()));
    }

    if (!shouldCheckCsrf(req.method, req.url)) return;

    const cookieToken = readCookieValue(req.headers.cookie, CSRF_COOKIE);
    const headerValue = req.headers[CSRF_HEADER];
    const headerToken = Array.isArray(headerValue) ? headerValue[0] : headerValue;
    if (!verifyCsrfToken(cookieToken, headerToken)) {
      return reply.code(403).send({
        type: 'https://resiliplan.kantor.local/errors/csrf',
        title: 'Forbidden',
        status: 403,
        detail: 'CSRF token missing or invalid',
        instance: req.id,
      });
    }
  });

  // ===== Health Check (no auth, no rate limit) =====
  await app.register(healthRoutes);
  await app.register(metricsRoutes);

  // ===== Phase 1 API =====
  await app.register(authRoutes);
  await app.register(planRoutes);
  await app.register(resilienceRoutes);
  await app.register(biaRoutes);
  await app.register(aiRoutes);
  await app.register(userRoutes);
  await app.register(billingRoutes);
  await app.register(emailRoutes);
  await app.register(settingsRoutes);

  // ===== Root route =====
  app.get('/', async () => {
    return {
      name: config.APP_NAME,
      version: '0.1.0',
      environment: config.NODE_ENV,
      docs: '/api/docs',
      health: '/api/health',
    };
  });

  // ===== 404 handler =====
  app.setNotFoundHandler((req, reply) => {
    reply.code(404).send({
      type: 'https://resiliplan.kantor.local/errors/not-found',
      title: 'Not Found',
      status: 404,
      detail: `Route ${req.method} ${req.url} not found`,
      instance: req.id,
    });
  });

  // ===== Error handler =====
  app.setErrorHandler((err, req, reply) => {
    const statusCode = err.statusCode ?? 500;
    const isProduction = config.NODE_ENV === 'production';

    logger.error(
      {
        err: {
          message: err.message,
          stack: err.stack,
          statusCode,
        },
        requestId: req.id,
        url: req.url,
        method: req.method,
      },
      'Request error',
    );

    reply.code(statusCode).send({
      type: `https://resiliplan.kantor.local/errors/${statusCode}`,
      title: err.name || 'Internal Server Error',
      status: statusCode,
      detail: isProduction && statusCode === 500 ? 'Internal server error' : err.message,
      instance: req.id,
    });
  });

  return app;
}

async function start() {
  try {
    const app = await buildServer();

    await app.listen({
      port: config.API_PORT,
      host: config.API_HOST,
    });

    logger.info(
      {
        url: config.API_URL,
        port: config.API_PORT,
        env: config.NODE_ENV,
      },
      `🚀 ${config.APP_NAME} API started`,
    );

    // Graceful shutdown
    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
    for (const signal of signals) {
      process.on(signal, async () => {
        logger.info({ signal }, 'Shutting down gracefully...');
        await app.close();
        process.exit(0);
      });
    }
  } catch (err) {
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
  }
}

// Start if run directly (not imported for testing)
if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}
