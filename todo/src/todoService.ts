import { randomUUID } from 'node:crypto';

import redis from './redisClient';

const TODO_KEY = 'todos';

interface Todo {
    id: string;
    task: string;
    done: boolean;
}

export async function getTodos(): Promise<Todo[]> {
    const todoJSON = await redis.get(TODO_KEY);
    return todoJSON ? JSON.parse(todoJSON) : [];
}

async function saveTodos(todos: Todo[]): Promise<void> {
    await redis.set(TODO_KEY, JSON.stringify(todos));
}

export async function addTodo(task: string): Promise<void> {
    const todos = await getTodos();
    const id = randomUUID();

    todos.push({ id, task, done: false });
    await saveTodos(todos);

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

export async function markTodoDone(id: string): Promise<void> {
    const todos: Todo[] = await getTodos();
    const todo = todos.find((t) => t.id === id);

    if (!todo) {
        console.error(`❌ Todo with ID ${id} not found.`);
        return;
    }

    todo.done = true;
    await saveTodos(todos);

    console.log(`✅ Todo marked as done: [${todo.id}] ${todo.task}`);
}
