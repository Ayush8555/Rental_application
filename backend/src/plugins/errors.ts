import type { FastifyError, FastifyInstance } from 'fastify';
import { AppError } from '../lib/errors.ts';
import { Prisma } from '../services/db.ts';

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((err: FastifyError | AppError | Error, req, reply) => {
    if (err instanceof AppError) {
      return reply.status(err.status).send({
        error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
      });
    }
    const fe = err as FastifyError;
    if (fe.statusCode === 429) {
      return reply.status(429).send({ error: { code: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' } });
    }
    if (fe.statusCode && fe.statusCode >= 400 && fe.statusCode < 500) {
      // Fastify's own errors (bad JSON, body too large, wrong content type).
      const code = fe.statusCode === 413 ? 'TOO_LARGE' : fe.statusCode === 415 ? 'UNSUPPORTED_TYPE' : 'BAD_REQUEST';
      return reply.status(fe.statusCode).send({ error: { code, message: 'The request could not be read' } });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return reply.status(409).send({ error: { code: 'DUPLICATE', message: 'This already exists' } });
    }
    // Unknown error: log it with the request id, tell the client nothing useful to an attacker.
    req.log.error({ err }, 'unhandled error');
    return reply.status(500).send({ error: { code: 'SERVER_ERROR', message: 'Something went wrong on our side. Please try again.' } });
  });

  app.setNotFoundHandler((_req, reply) => {
    reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Not found' } });
  });
}
