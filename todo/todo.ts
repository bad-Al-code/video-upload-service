import fs from 'node:fs';
import { randomUUID } from 'node:crypto';

import redis from './redis';

const TODO_KEY = 'todos';

interface Todo {
    id: string;
    task: string;
}

async function getTodos(): Promise<Todo[]> {
    const todoJSON = await redis.get(TODO_KEY);
    return todoJSON ? JSON.parse(todoJSON) : [];
}

async function addTodo(task: string): Promise<void> {
    const todos: Todo[] = await getTodos();
    const id = randomUUID();

    todos.push({ id, task });
    saveTodos(todos);

    console.log(`✅ Todo added: [${id}] ${task}`);
}

async function listTodos(): Promise<void> {
    const todos: Todo[] = await getTodos();

    if (todos.length === 0) {
        console.log('📂 No todos found.');
        return;
    }

    console.log('📝 Your Todos:');
    todos.forEach((todo) => {
        console.log(`- [${todo.id}] ${todo.task}`);
    });
}

async function saveTodos(todos: Todo[]): Promise<void> {
    await redis.set(TODO_KEY, JSON.stringify(todos));
}

async function removeTodo(id: string): Promise<void> {
    const todos: Todo[] = await getTodos();
    const index = todos.findIndex((todo) => todo.id === id);

    if (index === -1) {
        console.error(`❌ Todo with ID ${id} not found.`);
        return;
    }

    const removedTodo = todos.splice(index, 1)[0];
    saveTodos(todos);

    console.log(`🗑️ Todo removed: [${removedTodo.id}] ${removedTodo.task}`);
}

function showHelp(): void {
    console.log(`
Usage:
  todo add "TASK"   - Add a new todo
  todo list         - List all todos
  todo done ID      - Mark a todo as completed (delete)
  todo --help       - Show this help message
`);
}

async function cli(): Promise<void> {
    const subCommand = process.argv[2];
    const options = process.argv.slice(3);

    try {
        switch (subCommand) {
            case '--help':
                showHelp();
                break;

            case 'add':
                if (options.length !== 1) {
                    console.error('❌ Usage: todo add "TASK"');
                    return;
                }
                await addTodo(options[0]);
                break;

            case 'done':
                if (options.length !== 1) {
                    console.error('❌ Usage: todo done ID');
                    return;
                }

                await removeTodo(options[0]);
                break;

            case 'list':
                if (options.length !== 0) {
                    console.error('❌ Usage: todo list');
                    return;
                }
                await listTodos();
                break;

            default:
                console.error('❌ Invalid command. Use --help for usage info.');
        }
    } catch (error) {
        console.error('Unexpected error: ', error);
    } finally {
        await redis.quit();
        console.log('🔌 Redis connection closed.');
    }
}

cli();
