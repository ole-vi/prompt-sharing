import { describe, it, expect } from 'vitest';
import { sanitizeTitle, extractTitleFromPrompt } from '../../utils/title.js';

describe('Title Sanitization', () => {
  it('removes control characters', () => {
    // Control chars: U+0000-U+001F, U+007F-U+009F
    const input = 'Hello\u0000World\u001F\u007F\u009F';
    const output = sanitizeTitle(input);
    expect(output).toBe('HelloWorld');
  });

  it('removes bi-directional text override characters', () => {
    // U+202A-U+202E
    const input = 'Right\u202ELeft\u202A';
    const output = sanitizeTitle(input);
    expect(output).toBe('RightLeft');
  });

  it('removes zero-width characters', () => {
    // U+200B-U+200D, U+FEFF
    const input = 'Zero\u200BWidth\uFEFFSpace';
    const output = sanitizeTitle(input);
    expect(output).toBe('ZeroWidthSpace');
  });

  it('normalizes homographs (Cyrillic to Latin)', () => {
    // Cyrillic 'а', 'е', 'о', 'р', 'с', 'х', 'у' -> Latin equivalent
    // 'а' (U+0430) vs 'a' (U+0061)
    const input = 'My P\u0430ssword'; // P\u0430ssword where \u0430 is cyrillic 'a'
    const output = sanitizeTitle(input);
    expect(output).toBe('My Password');
  });

  it('normalizes homographs (Greek to Latin)', () => {
    // Greek 'ο' (omicron) -> 'o'
    const input = 'G\u03BFogle'; // G\u03BFogle where \u03BF is greek omicron
    const output = sanitizeTitle(input);
    expect(output).toBe('Google');
  });

  it('handles empty strings', () => {
    expect(sanitizeTitle(null)).toBe('');
    expect(sanitizeTitle(undefined)).toBe('');
    expect(sanitizeTitle('')).toBe('');
  });

  it('handles safe titles correctly', () => {
    const input = 'Safe Title 123!';
    expect(sanitizeTitle(input)).toBe(input);
  });
});

describe('extractTitleFromPrompt', () => {
  it('sanitizes extracted title', () => {
    const prompt = '# H\u0435llo World\nContent'; // \u0435 is cyrillic 'e'
    const title = extractTitleFromPrompt(prompt);
    expect(title).toBe('Hello World');
  });

  it('handles length limits after sanitization', () => {
    // 110 chars title, sanitized
    const longTitle = 'a'.repeat(110);
    const prompt = `# ${longTitle}`;
    const title = extractTitleFromPrompt(prompt);
    expect(title.length).toBe(100);
  });

  it('removes markdown heading syntax', () => {
    const prompt = '# Title';
    expect(extractTitleFromPrompt(prompt)).toBe('Title');
  });
});
