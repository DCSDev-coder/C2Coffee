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
  // Fastify can surface errors from hooks through a different module context,
  // where instanceof no longer recognizes our ApiError subclass.
  const apiError = error as FastifyError & {
    statusCode?: unknown;
    code?: unknown;
  };
  const hasHttpStatus =
    Number.isInteger(apiError.statusCode)
    && Number(apiError.statusCode) >= 400
    && Number(apiError.statusCode) <= 599;
  const isApiError = error instanceof ApiError;
  let statusCode = hasHttpStatus ? Number(apiError.statusCode) : 500;
  let code = isApiError
    ? error.code
    : statusCode === 429
      ? 'rate_limit_exceeded'
      : hasHttpStatus && typeof apiError.code === 'string'
        ? apiError.code
        : 'internal_server_error';
  let message = isApiError
    ? error.message
    : statusCode === 429
      ? 'Too many requests. Please wait a moment and try again.'
      : statusCode >= 500
        ? 'Unexpected server error. Please try again later.'
        : 'Request could not be completed. Please try again.';

  // Handle Zod validation errors
  if (error.name === 'ZodError' && (error as any).issues) {
    statusCode = 400;
    code = 'validation_error';
    message = (error as any).issues[0]?.message || 'Invalid input data.';
  }

  request.log.error({ error, statusCode, code }, 'request failed');

  void reply.status(statusCode).send({
    error: {
      code,
      message,
      request_id: request.id
    }
  });
}
