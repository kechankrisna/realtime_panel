import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
    it('merges class names', () => {
        expect(cn('foo', 'bar')).toBe('foo bar');
    });

    it('handles conditional classes', () => {
        expect(cn('base', false && 'hidden', 'visible')).toBe('base visible');
    });

    it('merges tailwind classes correctly (last wins)', () => {
        // tailwind-merge resolves conflicts: p-2 overrides p-4
        expect(cn('p-4', 'p-2')).toBe('p-2');
    });

    it('handles undefined and null gracefully', () => {
        expect(cn('foo', undefined, null, 'bar')).toBe('foo bar');
    });

    it('handles object syntax', () => {
        expect(cn({ 'text-red-500': true, 'text-blue-500': false })).toBe('text-red-500');
    });

    it('returns empty string for no arguments', () => {
        expect(cn()).toBe('');
    });
});
