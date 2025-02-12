import bcrypt from 'bcryptjs';

import redis from './redisClient';
import { randomUUID } from 'node:crypto';

const USER_PREFIX = 'user:';
const SESSION_PREFIX = 'session:';
const SESSION_EXPIRY = 3600;

interface User {
    username: string;
    password: string;
}

/**
 * Register a user
 *
 * @param username
 * @param password
 * @returns A success message or an error if user exists
 */
export async function regiserUser(
    username: string,
    password: string,
): Promise<string> {
    const userKey = `${USER_PREFIX}${username}`;

    const exists = await redis.exists(userKey);
    if (exists) {
        throw new Error('❌ Username already taken!');
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    await redis.hmset(userKey, { username, passwordHash });

    return '✅ User registered successfully!';
}

/**
 * Login a user with username and password
 *
 * @param username
 * @param password
 * @returns A boolean indicating success or failure
 */
export async function loginUser(
    username: string,
    password: string,
): Promise<string> {
    const userKey = `${USER_PREFIX}${username}`;

    const userData = await redis.hgetall(userKey);
    if (!userData || !userData.passwordHash) {
        throw new Error('❌ Invalid username or password.');
    }

    const match = await bcrypt.compare(password, userData.passwordHash);
    if (!match) {
        console.error('❌ Invalid username or password.');
    }

    const sessionToken = randomUUID();
    const sessionKey = `${SESSION_PREFIX}${sessionToken}`;

    await redis.setex(sessionKey, SESSION_EXPIRY, username);

    return sessionToken;
}

/**
 * Validates a session token
 *
 * @param sessionToken
 * @returns username if session is valid, null otherwise
 */
export async function validateSession(
    sessionToken: string,
): Promise<string | null> {
    const sessionKey = `${SESSION_PREFIX}${sessionToken}`;
    const username = await redis.get(sessionKey);

    return username || null;
}

/**
 * Logs out a user by deleting their session token
 *
 * @param sessionToken
 */
export async function logoutUser(sessionToken: string): Promise<void> {
    const sessionKey = `${SESSION_PREFIX}${sessionToken}`;
    await redis.del(sessionKey);
}
