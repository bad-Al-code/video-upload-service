import { cleanInput } from './repl';

import { describe, test, expect } from 'vitest';

describe.each([
    {
        input: '  ',
        expected: [],
    },
    {
        input: '  hello  ',
        expected: ['hello'],
    },
    {
        input: '  hello  world  ',
        expected: ['hello', 'world'],
    },
    {
        input: '  HellO  World  ',
        expected: ['hello', 'world'],
    },
])('cleanInput($input)', ({ input, expected }) => {
    test(`Expected: ${expected}`, () => {
        const actual = cleanInput(input);
        expect(actual).toHaveLength(expected.length);
        for (const i in expected) {
            expect(actual[i]).toBe(expected[i]);
        }
    });
});
