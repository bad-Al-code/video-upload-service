import { StatusCodes } from 'http-status-codes';

import { AppError } from './AppError';

export class BadRequestError extends AppError {
  constructor(message: string = 'Bad Request') {
    super(message, StatusCodes.BAD_REQUEST);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Not Found') {
    super(message, StatusCodes.NOT_FOUND);
  }
}

export class UnprocessableEntityError extends AppError {
  constructor(message: string = 'Unprocessable Entity') {
    super(message, StatusCodes.UNPROCESSABLE_ENTITY);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = 'Internal Server Error') {
    super(message, StatusCodes.INTERNAL_SERVER_ERROR);
  }
}

export { AppError };
