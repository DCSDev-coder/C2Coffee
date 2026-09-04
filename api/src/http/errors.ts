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
  const isApiError = error instanceof ApiError || (
    Number.isInteger(apiError.statusCode)
    && Number(apiError.statusCode) >= 400
    && Number(apiError.statusCode) <= 599
    && typeof apiError.code === 'string'
  );
  let statusCode = isApiError ? Number(apiError.statusCode) : 500;
  let code = isApiError ? String(apiError.code) : 'internal_server_error';
  let message =
    isApiError
      ? error.message
      : 'Unexpected server error. Please try again later.';

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
