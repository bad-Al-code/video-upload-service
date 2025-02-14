import { describe, it, expect } from 'vitest';
import { greet } from '../index';

describe('greet function', () => {
    it('should return a greeting message', () => {
        expect(greet('Alice')).toBe('Hello, Alice!');
        expect(greet('Bob')).toBe('Hello, Bob!');
    });
});
