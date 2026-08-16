import type { IdGenerator } from '../../shared/ids';
import type { SourceToken } from './types';

/** Split source text into stable, whitespace-delimited tokens without changing it. */
export function tokenizeSourceText(
  sourceText: string,
  generateId: IdGenerator,
): SourceToken[] {
  const tokens: SourceToken[] = [];
  let tokenStart = -1;

  for (let index = 0; index <= sourceText.length; index += 1) {
    const character = sourceText[index];
    const isWhitespace = index === sourceText.length || /\s/u.test(character ?? '');

    if (isWhitespace) {
      if (tokenStart >= 0) {
        tokens.push({
          id: generateId(),
          index: tokens.length,
          text: sourceText.slice(tokenStart, index),
        });
        tokenStart = -1;
      }
    } else if (tokenStart < 0) {
      tokenStart = index;
    }
  }

  return tokens;
}
