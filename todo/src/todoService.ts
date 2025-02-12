import { randomUUID } from 'node:crypto';

import redis from './redisClient';

const TODO_KEY = 'todos';

interface Todo {
    id: string;
    task: string;
}

/**
 * Fetch all todos from Redis.
 */
export async function getTodos(): Promise<Todo[]> {
    const todoJSON = await redis.get(TODO_KEY);
    return todoJSON ? JSON.parse(todoJSON) : [];
}

/**
 * Save todos to Redis.
 */
async function saveTodos(todos: Todo[]): Promise<void> {
    await redis.set(TODO_KEY, JSON.stringify(todos));
}

/**
 * Add a new todo.
 */
export async function addTodo(task: string): Promise<void> {
    const todos = await getTodos();
    const id = randomUUID();

    todos.push({ id, task });
    await saveTodos(todos);

    console.log(`✅ Todo added: [${id}] ${task}`);
}

/**
 * List all todos.
 */
export async function listTodos(): Promise<void> {
    const todos = await getTodos();

    if (todos.length === 0) {
        console.log('📂 No todos found.');
        return;
    }

    console.log('📝 Your Todos:');
    todos.forEach((todo) => console.log(`- [${todo.id}] ${todo.task}`));
}

/**
 * Remove a todo by ID.
 */
export async function removeTodo(id: string): Promise<void> {
    const todos = await getTodos();
    const index = todos.findIndex((todo) => todo.id === id);

    if (index === -1) {
        console.error(`❌ Todo with ID ${id} not found.`);
        return;
    }

    const removedTodo = todos.splice(index, 1)[0];
    await saveTodos(todos);

    console.log(`🗑️ Todo removed: [${removedTodo.id}] ${removedTodo.task}`);
}
