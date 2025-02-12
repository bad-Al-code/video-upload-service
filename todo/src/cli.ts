import { addTodo, listTodos, markTodoDone, removeTodo } from './todoService';
import redis from './redisClient';
import {
    loginUser,
    logoutUser,
    regiserUser,
    validateSession,
} from './authService';

function showHelp(): void {
    console.log(`
Usage:
  todo register USERNAME PASSWORD  - Register a new user & get a session token
  todo login USERNAME PASSWORD     - Login and receive a session token
  todo logout SESSION_TOKEN        - Logout and remove session
  todo validate SESSION_TOKEN      - Validate session token

  todo add "TASK"    - Add a new todo (requires session)
  todo list          - List all todos (requires session)
  todo done ID       - Mark a todo as completed (requires session)
  todo delete ID     - Delete a todo (requires session)
  todo --help        - Show this help message
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
                let sessionToken = await regiserUser(options[0], options[1]);
                console.log(
                    `✅ User registered successfully! Your session token: ${sessionToken}`,
                );
                break;

            case 'login':
                if (options.length !== 2) {
                    console.error('❌ Usage: todo login USERNAME PASSWORD');
                    return;
                }
                sessionToken = await loginUser(options[0], options[1]);
                if (sessionToken) {
                    console.log(
                        `✅ Login successful! Your session token: ${sessionToken}`,
                    );
                } else {
                    console.error('❌ Login failed!');
                }
                break;

            case 'logout':
                if (options.length !== 1) {
                    console.error('❌ Usage: todo logout SESSION_TOKEN');
                    return;
                }
                await logoutUser(options[0]);
                console.log('✅ Logged out successfully.');
                break;

            case 'validate':
                if (options.length !== 1) {
                    console.error('❌ Usage: todo validate SESSION_TOKEN');
                    return;
                }
                const username = await validateSession(options[0]);
                if (username) {
                    console.log(`✅ Session valid for user: ${username}`);
                } else {
                    console.error('❌ Invalid session.');
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
