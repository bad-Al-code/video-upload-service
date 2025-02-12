import { addTodo, listTodos, markTodoDone, removeTodo } from './todoService';
import redis from './redisClient';

/**
 * Display help menu.
 */
function showHelp(): void {
    console.log(`
Usage:
  todo add "TASK"   - Add a new todo
  todo list         - List all todos
  todo done ID      - Mark a todo as completed 
  todo delete ID    - Mark a todo as deleted
  todo --help       - Show this help message
`);
}

/**
 * Parse CLI arguments and execute appropriate command.
 */
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
                await markTodoDone(options[0]);
                break;
            case 'delete':
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
        console.error('Unexpected error:', error);
    } finally {
        await redis.quit();
        console.log('🔌 Redis connection closed.');
    }
}

cli();
