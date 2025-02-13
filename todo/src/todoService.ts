import { randomUUID } from 'node:crypto';

import redis from './redisClient';
import { validateSession } from './authService';

interface Todo {
    id: string;
    task: string;
    done: boolean;
    owner: string;
}

/**
 * Retrieves all todos for a specific user from Redis.
 *
 * @param {string} username - The username of the user whose todos are being retrieved.
 * @return {Promise<Todo[]>} A list of the user's stored todos.
 */
async function getTodos(username: string): Promise<Todo[]> {
    const keys = await redis.keys(`todo:${username}:*`);

    if (keys.length === 0) return [];

    const todos = await Promise.all(
        keys.map(async (key) => {
            const todo = await redis.hgetall(key);

            return {
                id: key.replace(`todo:${username}:`, ''),
                task: todo.task ?? 'Unknown Task',
                done: todo.done === 'true',
                owner: username,
            };
        }),
    );

    return todos;
}

/**
 * Adds a new todo and stores it in Redis as a separate key.
 *
 * @param task
 */
export async function addTodo(
    sessionToken: string,
    task: string,
): Promise<void> {
    const username = await validateSession(sessionToken);
    if (!username) {
        throw new Error('❌ Unauthorized: Invalid session.');
    }

    const id = randomUUID();
    const todo: Todo = { id, task, done: false, owner: username };

    await redis.set(`todo:${id}`, JSON.stringify(todo));

    console.log(`✅ Todo added by ${username}: [${id}] ${task}`);
}

/**
 * Lists todos with optional filtering for completed or pending tasks.
 *
 * @param { string} sessionToken
 * @param{ 'completed' | 'pending'} [filter ]- 'completed' to show only completed tasks, 'pending' to show only inomplete tasks
 */
export async function listTodos(
    sessionToken: string,
    filter?: 'completed' | 'pending',
): Promise<void> {
    const username = await validateSession(sessionToken);
    if (!username) {
        console.error('❌ Invalid session. Please log in.');
        return;
    }

    const todos: Todo[] = await getTodos(username);

    if (todos.length === 0) {
        console.log('📂 No todos found.');
        return;
    }

    let filteredTodos = todos;

    if (filter === 'completed') {
        filteredTodos = todos.filter((todo) => todo.done);
    } else if (filter === 'pending') {
        filteredTodos = todos.filter((todo) => !todo.done);
    }

    if (filteredTodos.length === 0) {
        console.log(`📂 No ${filter} todos found.`);
        return;
    }

    console.log('📝 Your Todos:');
    filteredTodos.forEach((todo) => {
        const status = todo.done ? '✅' : '❌';
        console.log(`- [${todo.id}] ${status} ${todo.task}`);
    });
}

/**
 * Removes a todo, ensuring the user owns it.
 *
 * @param {string} sessionToken - The session token of the user.
 * @param {string} id - The ID of the todo to remove.
 */
export async function removeTodo(
    sessionToken: string,
    id: string,
): Promise<void> {
    const username = await validateSession(sessionToken);
    if (!username) {
        console.error('❌ Unauthorized: Invalid session.');
        return;
    }

    const todoKey = `todo:${username}:${id}`;
    const todo = await redis.hgetall(todoKey);

    if (!todo || !todo.task) {
        console.error(
            `❌ Todo with ID ${id} not found or does not belong to you.`,
        );
        return;
    }

    await redis.del(todoKey);
    console.log(`🗑️ Todo removed: [${id}] ${todo.task}`);
}

/**
 * Marks a todo as completed, ensuring the user owns it.
 *
 * @param {string} sessionToken - The session token of the user.
 * @param {string} id - The ID of the todo to mark as completed.
 */
export async function markTodoDone(
    sessionToken: string,
    id: string,
): Promise<void> {
    const username = await validateSession(sessionToken);
    if (!username) {
        console.error('❌ Unauthorized: Invalid session.');
        return;
    }

    const todoKey = `todo:${username}:${id}`;
    const todo = await redis.hgetall(todoKey);

    if (!todo || !todo.task) {
        console.error(
            `❌ Todo with ID ${id} not found or does not belong to you.`,
        );
        return;
    }

    await redis.hset(todoKey, 'done', 'true');
    console.log(`✅ Todo marked as done: [${id}] ${todo.task}`);
}
