import { StatusCodes } from 'http-status-codes';

export class AppError extends Error {
  public readonly statusCode: StatusCodes;

  constructor(message: string, statusCode: StatusCodes) {
    super(message);
    this.statusCode = statusCode;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }

    Object.setPrototypeOf(this, AppError.prototype);
  }
}
