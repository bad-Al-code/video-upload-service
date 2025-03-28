import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { MulterError } from 'multer';

import { MAX_FILE_SIZE_MB } from '../config/constants';
import { AppError, InternalServerError } from '../errors';

interface ResponseBody {
  status: string;
  message: string;
  statusCode: number;
}
export const globalErrorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  console.error('Unhandler error: ', err);

  let statusCode: StatusCodes = StatusCodes.INTERNAL_SERVER_ERROR;
  let responseBody: ResponseBody = {
    status: 'error',
    message: 'Something went wrong',
    statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
  };

  if (err instanceof MulterError) {
    statusCode = StatusCodes.BAD_REQUEST;
    if (err.code === 'LIMIT_FILE_SIZE') {
      responseBody.message = `File too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`;
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      responseBody.message = `Unexpected ield name for file upload. Expected 'videoFile'.`;
    } else {
      responseBody.message = `File upload error: ${err.message}`;
    }
  } else if (err instanceof AppError) {
    statusCode = err.statusCode;
    responseBody.message = err.message;
  } else {
    const internalError = new InternalServerError(
      err.message || 'An unexpected error occured',
    );
    statusCode = internalError.statusCode;
    responseBody.message = internalError.message;
  }

  responseBody.statusCode = statusCode;

  res.status(statusCode).json(responseBody);
};
