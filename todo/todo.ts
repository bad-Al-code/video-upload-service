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
