import { createServer } from 'node:http';

import { ENV } from './config/env';
import { app } from './app';
import {
  closeRabbitMQConnection,
  connectRabbitMQ,
} from './config/rabbitmq-client';

const PORT = ENV.PORT;

async function startServer() {
  try {
    await connectRabbitMQ();
    console.log(`RabbitMQ connection established successfully.`);

    const server = createServer(app);

    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.syscall !== 'listen') {
        throw error;
      }

      const bind = typeof PORT === 'string' ? 'Pipe ' + PORT : 'Port ' + PORT;
      switch (error.code) {
        case 'EACCES':
          console.error(`${bind} requires elevated privileges`);
          process.exit(1);
          break;
        case 'EADDRINUSE':
          console.error(`${bind} is already in use`);
          process.exit(1);
          break;
        default:
          throw error;
      }
    });

    server.listen(PORT, () => {
      console.log(`   Server ready and listening on http://localhost:${PORT}`);
      console.log(`   API base path: /api/v1`);
      console.log(`   Upload endpoint: POST /api/v1/upload/video`);
      console.log(`   Get video endpoint: GET /api/v1/upload/videos/:videoId`);
    });

    const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

    signals.forEach((signal) => {
      process.on(signal, async () => {
        console.log(`\nReceived ${signal}. Shutting down gracefully...`);

        await closeRabbitMQConnection();
        server.close(() => {
          console.log('HTTP server closed.');
          process.exit(0);
        });

        setTimeout(() => {
          console.error(
            'Could not close connections in time, forcefully shutting down',
          );
          process.exit(1);
        }, 10000);
      });
    });
  } catch (error) {
    console.error('Failed to start server: ', error);

    await closeRabbitMQConnection();
    process.exit(1);
  }
}

startServer();
