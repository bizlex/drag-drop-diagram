import { describe, expect, it } from 'vitest';

import { tokenizeSourceText } from './tokenizer';

function ids(...values: string[]) {
  let index = 0;
  return () => values[index++] ?? `generated-${index}`;
}

describe('tokenizeSourceText', () => {
  it.each([
    ['', []],
    [' \t\n\r\u00a0\u2003 ', []],
    ['one two', ['one', 'two']],
    ['one\ttwo\nthree', ['one', 'two', 'three']],
    ['one\u00a0\u2003two\u2028three', ['one', 'two', 'three']],
    ['Hello, world!', ['Hello,', 'world!']],
    ['same same', ['same', 'same']],
    ['In the beginning, God created.', ['In', 'the', 'beginning,', 'God', 'created.']],
    ['русский текст', ['русский', 'текст']],
    ['Ἐν ἀρχῇ ἦν', ['Ἐν', 'ἀρχῇ', 'ἦν']],
    ['בְּרֵאשִׁית בָּרָא', ['בְּרֵאשִׁית', 'בָּרָא']],
  ])('tokenizes %j', (source, expected) => {
    expect(tokenizeSourceText(source, ids('a', 'b', 'c', 'd', 'e'))).toEqual(
      expected.map((text, index) => ({ id: ['a', 'b', 'c', 'd', 'e'][index], index, text })),
    );
  });

  it('uses unique deterministic IDs and preserves source text exactly', () => {
    const source = '  Слово\tἘν\nבְּרֵאשִׁית  ';
    const tokens = tokenizeSourceText(source, ids('token-1', 'token-2', 'token-3'));
    expect(tokens.map((token) => token.id)).toEqual(['token-1', 'token-2', 'token-3']);
    expect(tokens.map((token) => token.index)).toEqual([0, 1, 2]);
    expect(source).toBe('  Слово\tἘν\nבְּרֵאשִׁית  ');
  });
});
