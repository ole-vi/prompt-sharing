import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchJSON, listPromptsViaContents } from '../../src/modules/github-api';

global.fetch = vi.fn();

describe('github-api', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  describe('fetchJSON', () => {
    it('should return null on network error', async () => {
      fetch.mockRejectedValue(new Error('Network error'));
      const result = await fetchJSON('http://test.com');
      expect(result).toBeNull();
    });

    it('should return null on non-ok response', async () => {
      fetch.mockResolvedValue({ ok: false });
      const result = await fetchJSON('http://test.com');
      expect(result).toBeNull();
    });

    it('should return json on ok response', async () => {
      const mockData = { a: 1 };
      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      });
      const result = await fetchJSON('http://test.com');
      expect(result).toEqual(mockData);
    });
  });

  describe('listPromptsViaContents', () => {
    it('should return an empty array if the initial fetch fails', async () => {
      fetch.mockResolvedValue({ ok: false });
      const result = await listPromptsViaContents('owner', 'repo', 'branch');
      expect(result).toEqual([]);
    });

    it('should recursively fetch directories and filter for markdown files', async () => {
        const mockEntries = [
            { type: 'file', name: 'prompt1.md', path: 'prompts/prompt1.md' },
            { type: 'dir', name: 'subdir', path: 'prompts/subdir' },
            { type: 'file', name: 'other.txt', path: 'prompts/other.txt' },
        ];
        const mockSubDirEntries = [
            { type: 'file', name: 'prompt2.md', path: 'prompts/subdir/prompt2.md' },
        ];

        fetch.mockImplementation((url) => {
            if (url.includes('contents/prompts?ref=')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockEntries),
                });
            } else if (url.includes('contents/prompts/subdir?ref=')) {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockSubDirEntries),
                });
            }
            return Promise.resolve({ ok: false });
        });

        const result = await listPromptsViaContents('owner', 'repo', 'branch', 'prompts');
        expect(result).toHaveLength(2);
        expect(result[0].path).toBe('prompts/prompt1.md');
        expect(result[1].path).toBe('prompts/subdir/prompt2.md');
    });
  });
});
