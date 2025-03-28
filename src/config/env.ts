import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.string().regex(/^\d+$/).transform(Number),
  MAX_FILE_SIZE_MB: z.string().regex(/^\d+$/).transform(Number),

  DB_HOST: z.string().min(1, 'DB_HOST is required'),
  DB_PORT: z.string().regex(/^\d+$/).transform(Number),
  DB_NAME: z.string().min(1, 'DB_NAME is required'),
  DB_USER: z.string().min(1, 'DB_USER is required'),
  DB_PASSWORD: z.string().min(1, 'DB_PASSWORD is required'),
  DB_ROOT_PASSWORD: z.string().min(1, 'DB_ROOT_PASSWORD is required'),

  DATABASE_URL: z.string(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid Environment Variables:', parsedEnv.error.format());

  throw new Error(`Invalid Environment Variables: ${parsedEnv.error.format()}`);
}

export const ENV = parsedEnv.data;
