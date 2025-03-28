import express, {
  json,
  NextFunction,
  Request,
  Response,
  urlencoded,
} from 'express';
import { StatusCodes } from 'http-status-codes';

import { ENV } from './config/env';

const app = express();
const PORT = ENV.PORT;

app.use(json());
app.use(urlencoded({ extended: true }));

app.get('/ping', (req: Request, res: Response) => {
  res.status(StatusCodes.OK).json({ message: 'Pong' });
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandler error: ', err);
  res
    .status(StatusCodes.INTERNAL_SERVER_ERROR)
    .json({ message: 'Something went wrong!', error: err.message });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost"${PORT}`);
});
