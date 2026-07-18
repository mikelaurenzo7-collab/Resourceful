import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const FORBIDDEN_RUNTIME_IMPORTS = new Set([
  '@anthropic-ai/sdk',
  '@google/genai',
  '@google/generative-ai',
]);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      return sourceFiles(path);
    }

    return /\.(?:ts|tsx|mts|cts)$/.test(entry.name) ? [path] : [];
  });
}

function scriptKind(file: string): ts.ScriptKind {
  if (file.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (file.endsWith('.mts')) return ts.ScriptKind.TS;
  if (file.endsWith('.cts')) return ts.ScriptKind.TS;
  return ts.ScriptKind.TS;
}

function importedModules(file: string, source: string): string[] {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(file)
  );
  const modules: string[] = [];

  const addStringLiteral = (node: ts.Node | undefined) => {
    if (node && ts.isStringLiteralLike(node)) modules.push(node.text);
  };

  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      addStringLiteral(node.moduleSpecifier);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      addStringLiteral(node.moduleReference.expression);
    } else if (ts.isCallExpression(node)) {
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require';
      if (isDynamicImport || isRequire) addStringLiteral(node.arguments[0]);
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return modules;
}

describe('AI provider contract', () => {
  it('keeps Resourceful runtime code OpenAI-only', () => {
    const srcRoot = join(process.cwd(), 'src');
    const violations = sourceFiles(srcRoot).flatMap((file) => {
      const source = readFileSync(file, 'utf8');

      return importedModules(file, source)
        .filter((provider) => FORBIDDEN_RUNTIME_IMPORTS.has(provider))
        .map((provider) => `${file.replace(`${process.cwd()}/`, '')}: ${provider}`);
    });

    expect(violations).toEqual([]);
  });
});
