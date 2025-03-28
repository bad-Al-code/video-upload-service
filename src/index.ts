import express, {
  json,
  NextFunction,
  Request,
  Response,
  urlencoded,
} from 'express';
import { StatusCodes } from 'http-status-codes';

import { ENV } from './config/env';
import { AppError, InternalServerError } from './errors';

const app = express();
const PORT = ENV.PORT;

app.use(json());
app.use(urlencoded({ extended: true }));

app.get('/ping', (req: Request, res: Response) => {
  res.status(StatusCodes.OK).json({ message: 'Pong' });
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandler error: ', err);

  let statusCode: StatusCodes = StatusCodes.INTERNAL_SERVER_ERROR;
  let message: string = 'Something went wrong';

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  } else {
    const internalError = new InternalServerError(
      err.message || 'An unexpected error occured',
    );
    statusCode = internalError.statusCode;
    message = internalError.message;
  }

  res.status(statusCode).json({ status: 'error', statusCode, message });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost"${PORT}`);
});
