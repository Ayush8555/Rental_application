// Every error that reaches a client has the shape {error:{code,message}}.
// Anything not thrown as AppError becomes a generic 500 with no details.

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export const badRequest = (message = 'Please check the details and try again', code = 'BAD_REQUEST', details?: Record<string, unknown>) =>
  new AppError(400, code, message, details);
export const unauthorized = (message = 'Please sign in again', code = 'UNAUTHORIZED') => new AppError(401, code, message);
export const forbidden = (message = 'You are not allowed to do this', code = 'FORBIDDEN') => new AppError(403, code, message);
export const notFound = (message = 'Not found', code = 'NOT_FOUND') => new AppError(404, code, message);
export const conflict = (message: string, code = 'CONFLICT') => new AppError(409, code, message);
export const tooMany = (message = 'Too many requests. Please try again later.', code = 'RATE_LIMITED') =>
  new AppError(429, code, message);
