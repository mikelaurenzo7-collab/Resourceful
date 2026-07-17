import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const FORBIDDEN_RUNTIME_IMPORTS = [
  '@anthropic-ai/sdk',
  '@google/genai',
  '@google/generative-ai',
] as const;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      return sourceFiles(path);
    }

    return /\.(?:ts|tsx|mts|cts)$/.test(entry.name) ? [path] : [];
  });
}

describe('AI provider contract', () => {
  it('keeps Resourceful runtime code OpenAI-only', () => {
    const srcRoot = join(process.cwd(), 'src');
    const violations = sourceFiles(srcRoot).flatMap((file) => {
      const source = readFileSync(file, 'utf8');

      return FORBIDDEN_RUNTIME_IMPORTS
        .filter((provider) => {
          const escaped = provider.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          return new RegExp(`(?:from\\s+|import\\s*\\()\\s*['\"]${escaped}['\"]`).test(source);
        })
        .map((provider) => `${file.replace(`${process.cwd()}/`, '')}: ${provider}`);
    });

    expect(violations).toEqual([]);
  });
});
