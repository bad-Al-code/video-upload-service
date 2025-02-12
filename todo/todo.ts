import fs from 'node:fs';
import { randomUUID } from 'node:crypto';

const todosPath = 'todo.json';

interface Todo {
    id: string;
    task: string;
}

function getTodos(): Todo[] {
    if (!fs.existsSync(todosPath)) {
        return [];
    }

    try {
        const data = fs.readFileSync(todosPath);
        return JSON.parse(data.toString()) as Todo[];
    } catch (error) {
        console.error('Error reading todo file: ', error);
        return [];
    }
}

function addTodo(task: string): void {
    const todos: Todo[] = getTodos();
    const id = randomUUID();

    todos.push({ id, task });
    saveTodos(todos);

    console.log(`✅ Todo added: [${id}] ${task}`);
}

function listTodos(): void {
    const todos: Todo[] = getTodos();

    if (todos.length === 0) {
        console.log('📂 No todos found.');
        return;
    }

    console.log('📝 Your Todos:');
    todos.forEach((todo) => {
        console.log(`- [${todo.id}] ${todo.task}`);
    });
}

function saveTodos(todos: Todo[]): void {
    try {
        fs.writeFileSync(todosPath, JSON.stringify(todos, null, 2));
    } catch (error) {
        console.error('Error saving todo file:', error);
    }
}

function removeTodo(id: number): void {
    const todos = getTodos();
    const idString = id.toString();

    const index = todos.findIndex((todo) => todo.id === idString);
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

function cli(): void {
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
                addTodo(options[0]);
                break;

            case 'done':
                if (options.length !== 1) {
                    console.error('❌ Usage: todo done ID');
                    return;
                }

                const id = parseInt(options[0], 10);
                if (isNaN(id)) {
                    console.error('❌ Error: ID must be a number.');
                    return;
                }

                removeTodo(id);
                break;

            case 'list':
                if (options.length !== 0) {
                    console.error('❌ Usage: todo list');
                    return;
                }
                listTodos();
                break;

            default:
                console.error('❌ Invalid command. Use --help for usage info.');
        }
    } catch (error) {
        console.error('Unexpected error: ', error);
    }
}

cli();
