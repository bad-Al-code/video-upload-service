import { test, expect } from 'vitest';

function add(a: number, b: number): number {
    return a + b;
}

test('adds two numbers', () => {
    const result = add(2, 3);
    console.log('Sum:', result);
    expect(result).toBe(5);
});
