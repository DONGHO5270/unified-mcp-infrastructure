import { SerperClient } from './serper-client.js';
import { ISearchParams } from '../types/serper.js';

describe('SerperClient Query Building', () => {
  let client: SerperClient;

  beforeEach(() => {
    client = new SerperClient('test-key');
  });

  describe('buildAdvancedQuery', () => {
    const testCases = [
      {
        name: 'basic query without operators',
        input: {
          q: 'test query'
        },
        expected: 'test query'
      },
      {
        name: 'query with site operator',
        input: {
          q: 'test query',
          site: 'example.com'
        },
        expected: 'test query site:example.com'
      },
      {
        name: 'query with multiple operators',
        input: {
          q: 'test query',
          site: 'example.com',
          filetype: 'pdf',
          after: '2023-01-01'
        },
        expected: 'test query site:example.com filetype:pdf after:2023-01-01'
      },
      {
        name: 'query with exact phrase',
        input: {
          q: 'test',
          exact: 'exact phrase'
        },
        expected: 'test "exact phrase"'
      },
      {
        name: 'query with exclude terms',
        input: {
          q: 'test',
          exclude: 'spam,unwanted'
        },
        expected: 'test -spam -unwanted'
      },
      {
        name: 'query with OR terms',
        input: {
          q: 'test',
          or: 'option1,option2'
        },
        expected: 'test (option1 OR option2)'
      },
      {
        name: 'complex query with multiple operators',
        input: {
          q: 'search term',
          site: 'github.com',
          filetype: 'pdf',
          inurl: 'docs',
          intitle: 'guide',
          before: '2024-01-01',
          after: '2023-01-01',
          exclude: 'draft',
          or: 'tutorial,documentation'
        },
        expected: 'search term site:github.com filetype:pdf inurl:docs intitle:guide before:2024-01-01 after:2023-01-01 -draft (tutorial OR documentation)'
      }
    ];

    testCases.forEach(({ name, input, expected }) => {
      it(name, () => {
        expect(client['buildAdvancedQuery'](input)).toBe(expected);
      });
    });

    // Edge cases
    describe('edge cases', () => {
      it('should handle empty query', () => {
        const params: ISearchParams = { q: '' };
        expect(client['buildAdvancedQuery'](params)).toBe('');
      });

      it('should handle query with only spaces', () => {
        const params: ISearchParams = { q: '   ' };
        expect(client['buildAdvancedQuery'](params)).toBe('');
      });

      it('should handle special characters in query', () => {
        const params: ISearchParams = {
          q: 'test & query + more',
          site: 'example.com'
        };
        expect(client['buildAdvancedQuery'](params)).toBe('test & query + more site:example.com');
      });

      it('should handle empty strings for exclude/or parameters', () => {
        const params: ISearchParams = {
          q: 'test',
          exclude: '',
          or: ''
        };
        expect(client['buildAdvancedQuery'](params)).toBe('test');
      });

      it('should handle unicode characters', () => {
        const params: ISearchParams = {
          q: '测试',
          site: 'example.com'
        };
        expect(client['buildAdvancedQuery'](params)).toBe('测试 site:example.com');
      });

      it('should handle multiple consecutive spaces', () => {
        const params: ISearchParams = {
          q: 'test    query',
          site: 'example.com'
        };
        expect(client['buildAdvancedQuery'](params)).toBe('test query site:example.com');
      });
    });

    // Error cases
    describe('error cases', () => {
      it('should handle invalid date format gracefully', () => {
        const params: ISearchParams = {
          q: 'test',
          before: 'invalid-date'
        };
        expect(client['buildAdvancedQuery'](params)).toBe('test before:invalid-date');
      });

      it('should handle malformed URLs in site parameter', () => {
        const params: ISearchParams = {
          q: 'test',
          site: 'not a url!'
        };
        expect(client['buildAdvancedQuery'](params)).toBe('test site:not a url!');
      });

      it('should handle undefined optional parameters', () => {
        const params: ISearchParams = {
          q: 'test',
          site: undefined,
          filetype: undefined,
          exclude: undefined,
          or: undefined
        };
        expect(client['buildAdvancedQuery'](params)).toBe('test');
      });
    });
  });
});
