import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sourceRoot = resolve(process.cwd(), 'src');
const sourceExtensions = ['.ts', '.tsx'] as const;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return sourceExtensions.includes(extname(entry.name) as '.ts' | '.tsx') ? [path] : [];
  });
}

function relativeImports(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  const imports = source.matchAll(/(?:import|export)\s+(?:type\s+)?(?:[^'"]+from\s+)?['"](\.[^'"]+)['"]/g);
  return [...imports].map((match) => match[1]).filter((value): value is string => value !== undefined);
}

function resolveSourceImport(fromFile: string, specifier: string): string | undefined {
  const base = resolve(dirname(fromFile), specifier);
  const candidates = [
    ...sourceExtensions.map((extension) => `${base}${extension}`),
    ...sourceExtensions.map((extension) => resolve(base, `index${extension}`)),
  ];
  return candidates.find(existsSync);
}

function findCycle(graph: ReadonlyMap<string, readonly string[]>): string[] | undefined {
  const visited = new Set<string>();
  const active = new Set<string>();
  const stack: string[] = [];

  function visit(node: string): string[] | undefined {
    if (active.has(node)) {
      const start = stack.indexOf(node);
      return [...stack.slice(start), node];
    }
    if (visited.has(node)) return undefined;

    visited.add(node);
    active.add(node);
    stack.push(node);
    for (const dependency of graph.get(node) ?? []) {
      const cycle = visit(dependency);
      if (cycle !== undefined) return cycle;
    }
    stack.pop();
    active.delete(node);
    return undefined;
  }

  for (const node of graph.keys()) {
    const cycle = visit(node);
    if (cycle !== undefined) return cycle;
  }
  return undefined;
}

describe('module boundaries', () => {
  it('keeps simulation free of presentation and browser dependencies', () => {
    const simulationFiles = sourceFiles(resolve(sourceRoot, 'game/simulation'));
    const bannedImports = /from\s+['"](?:react|zustand|three|@react-three\/fiber|@xyflow\/react)|save\/adapters/;

    for (const file of simulationFiles) {
      expect(readFileSync(file, 'utf8'), relative(sourceRoot, file)).not.toMatch(bannedImports);
    }
  });

  it('contains no circular relative source dependencies', () => {
    const files = sourceFiles(sourceRoot);
    const graph = new Map(
      files.map((file) => [
        file,
        relativeImports(file)
          .map((specifier) => resolveSourceImport(file, specifier))
          .filter((dependency): dependency is string => dependency !== undefined),
      ]),
    );

    expect(findCycle(graph)).toBeUndefined();
  });
});
