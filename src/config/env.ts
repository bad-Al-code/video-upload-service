import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.string().regex(/^\d+$/).transform(Number),
  MAX_FILE_SIZE_MB: z.string().regex(/^\d+$/).transform(Number),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  throw new Error(`Invalid Environment Variables: ${parsedEnv.error.format()}`);
}

export const ENV = parsedEnv.data;
