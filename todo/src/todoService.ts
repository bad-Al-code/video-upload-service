import { randomUUID } from 'node:crypto';

import redis from './redisClient';

interface Todo {
    id: string;
    task: string;
    done: boolean;
}

/**
 * Retrieves all todos from Redis.
 * @returns A list of all stored todos.
 */
async function getTodos(): Promise<Todo[]> {
    const keys = await redis.keys('todo:*');

    if (keys.length === 0) return [];

    const todos = await Promise.all(
        keys.map(async (key) => {
            const todo = await redis.hgetall(key);

            return {
                id: key.replace('todo:', ''),
                task: todo.task ?? 'Unknown Task',
                done: todo.done === 'true',
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
export async function addTodo(task: string): Promise<void> {
    const id = randomUUID();
    const todo: Todo = { id, task, done: false };

    await redis.hset(`todo:${id}`, todo);

    console.log(`✅ Todo added: [${id}] ${task}`);
}

/**
 * Lists todos with optional filtering for completed or pending tasks.
 *
 * @param filter - 'completed' to show only completed tasks, 'pending' to show only inomplete tasks
 */
export async function listTodos(
    filter?: 'completed' | 'pending',
): Promise<void> {
    const todos: Todo[] = await getTodos();

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

export async function removeTodo(id: string): Promise<void> {
    const removed = await redis.del(`todo:${id}`);

    if (removed === 0) {
        console.error(`❌ Todo with ID ${id} not found.`);
        return;
    }

    console.log(`🗑️ Todo removed: [${id}]`);
}

/**
 * Marks a todo as completed.
 *
 * @param id
 */
export async function markTodoDone(id: string): Promise<void> {
    const todo = await redis.hgetall(`todo:${id}`);

    if (!todo || !todo.task) {
        console.error(`❌ Todo with ID ${id} not found.`);
        return;
    }

    await redis.hset(`todo:${id}`, 'done', 'true');

    console.log(`✅ Todo marked as done: [${id}] ${todo.task}`);
}
