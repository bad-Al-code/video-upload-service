import express, {
  json,
  NextFunction,
  Request,
  Response,
  urlencoded,
} from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { NotFoundError } from './errors';
import { ensureDirectoryExists } from './utils/fsUtils';
import { TEMP_DIR, UPLOAD_DIR } from './config/constants';
import { globalErrorHandler } from './middleware/errorHandler.middleware';
import mainRouter from './routes';

const app = express();

ensureDirectoryExists(UPLOAD_DIR);
ensureDirectoryExists(TEMP_DIR);

app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(json());
app.use(urlencoded({ extended: true }));

app.use('/api/v1', mainRouter);

app.use((req: Request, res: Response, next: NextFunction) => {
  next(new NotFoundError(`Route not found: ${req.method} ${req.originalUrl}`));
});

app.use(globalErrorHandler);

export { app };
