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

    const data = fs.readFileSync(todosPath);
    return JSON.parse(data.toString()) as Todo[];
}

function addTodo(task: string): void {
    const todos: Todo[] = getTodos();
    const id = randomUUID();
    todos.push({ id, task });

    saveTodos(todos);
    console.log(`Saved Todo: ${id}, ${task}`);
}

function listTodos(): void {
    const todos: Todo[] = getTodos();

    for (let i = 0; i < todos.length; i++) {
        console.log(`${todos[i].id}: ${todos[i].task}`);
    }
}

function saveTodos(todos: Todo[]): void {
    fs.writeFileSync(todosPath, JSON.stringify(todos));
}

function removeTodos(id: number): void {
    const todos: Todo[] = getTodos();
    const taskId = id.toString();

    const index = todos.findIndex(function (todo) {
        return todo.id === taskId;
    });

    if (index === -1) {
        throw new Error(`Could not found with id: ${taskId}`);
    }

    const removedTodo = todos.splice(index, 1)[0];
    saveTodos(todos);
    console.log(`Removed Todo: ${removedTodo.id}: ${removedTodo.task}`);
}

function cli(): void {
    const subCommand = process.argv[2];
    const options = process.argv.slice(3);

    switch (subCommand) {
        case '--help':
            console.log('todo add TASK \t\t add todo');
            console.log('todo done ID \t\t complete a todo');
            console.log('todo list \t\t list todo');

        case 'add':
            if (options.length === 1) {
                addTodo(options[0]);
            } else {
                console.log(`Invalid number of suboptions`);
            }
            break;
        case 'done':
            if (options.length === 1) {
                const id = parseInt(options[0]);
                if (isNaN(id)) {
                    console.log(`Options must be number`);
                } else {
                    removeTodos(id);
                }
            } else {
                console.log(`Invalid number of suboptions`);
            }
            break;
        case 'list':
            if (options.length === 0) {
                listTodos();
            } else {
                console.log(`Invalid number of suboptions`);
            }
            break;

        default:
            console.log('Invalid commands');
    }
}

cli();
