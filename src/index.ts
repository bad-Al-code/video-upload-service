import express, {
  json,
  NextFunction,
  Request,
  Response,
  urlencoded,
} from 'express';

import { NotFoundError } from './errors';
import { ensureDirectoryExists } from './utils/fsUtils';
import { TEMP_DIR, UPLOAD_DIR } from './config/constants';
import { globalErrorHandler } from './middleware/errorHandler.middleware';
import mainRouter from './routes';

const app = express();

ensureDirectoryExists(UPLOAD_DIR);
ensureDirectoryExists(TEMP_DIR);

app.use(json());
app.use(urlencoded({ extended: true }));

app.use('/api/v1', mainRouter);

app.use((req: Request, res: Response, next: NextFunction) => {
  next(new NotFoundError(`Route not found: ${req.method} ${req.originalUrl}`));
});

app.use(globalErrorHandler);

app.listen(3000);

export { app };
