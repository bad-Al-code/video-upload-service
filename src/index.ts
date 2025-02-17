import 'dotenv/config';
import { redis } from './config/db';
import { Server } from 'node:http';
import app from './app';

const server = new Server(app);

async function main() {
    await redis;

    server.listen(3000, () => {
        console.log('Listening on port 3000');
    });
}

main();
