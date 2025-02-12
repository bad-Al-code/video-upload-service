import bcrypt from 'bcryptjs';

import redis from './redisClient';

const USER_PREFIX = 'user:';

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
 * Authenticate a user with username and password
 *
 * @param username
 * @param password
 * @returns A boolean indicating success or failure
 */
export async function authenticate(
    username: string,
    password: string,
): Promise<boolean> {
    const userKey = `${USER_PREFIX}${username}`;

    const userData = await redis.hgetall(userKey);
    if (!userData || !userData.passwordHash) {
        console.error('❌ Invalid username or password.');
        return false;
    }

    const match = await bcrypt.compare(password, userData.passwordHash);
    if (!match) {
        console.error('❌ Invalid username or password.');
    }

    return match;
}
