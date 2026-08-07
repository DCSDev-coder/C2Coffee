import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  const statusCode = error instanceof ApiError ? error.statusCode : 500;
  const code = error instanceof ApiError ? error.code : 'internal_server_error';
  const message =
    error instanceof ApiError
      ? error.message
      : 'Unexpected server error. Please try again later.';

  request.log.error({ error, statusCode, code }, 'request failed');

  void reply.status(statusCode).send({
    error: {
      code,
      message,
      request_id: request.id
    }
  });
}
