import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL as string;

const redis = new Redis(REDIS_URL);

redis.on('connect', () => {
    console.log('Redis Connected');
});

redis.on('error', () => {
    console.log('Error connecting in Redis');
});

export { redis };
