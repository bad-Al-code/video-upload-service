import { addTodo, listTodos, markTodoDone, removeTodo } from './todoService';
import redis from './redisClient';
import { authenticate, regiserUser } from './authService';

function showHelp(): void {
    console.log(`
Usage:
  todo add "TASK"        - Add a new todo
  todo list              - List all todos
  todo list --completed  - List only completed todos
  todo list --pending    - List only pending todos
  todo done ID           - Mark a todo as completed
  todo delete ID         - Mark a todo as deleted
  todo --help            - Show this help message
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

            case 'register':
                if (options.length !== 2) {
                    console.error('❌ Usage: todo register USERNAME PASSWORD');
                    return;
                }
                console.log(await regiserUser(options[0], options[1]));
                break;

            case 'login':
                if (options.length !== 2) {
                    console.error('❌ Usage: todo login USERNAME PASSWORD');
                    return;
                }
                const isAuthenticated = await authenticate(
                    options[0],
                    options[1],
                );
                if (isAuthenticated) {
                    console.log('✅ Login successful!');
                } else {
                    console.error('❌ Login failed!');
                }

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
                if (options.length > 1) {
                    console.error(
                        '❌ Usage: todo list [--completed | --pending]',
                    );
                    return;
                }

                let filter: 'completed' | 'pending' | undefined;
                if (options[0] === '--completed') {
                    filter = 'completed';
                } else if (options[0] === '--pending') {
                    filter = 'pending';
                } else if (options.length === 1) {
                    console.error(
                        '❌ Invalid option. Use --completed or --pending.',
                    );
                    return;
                }

                await listTodos(filter);
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
