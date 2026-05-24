export interface Braced {
  content: string;
  end: number;
}

export function readBraced(input: string, start: number): Braced | null {
  if (input[start] !== "{") return null;

  let depth = 0;
  for (let i = start; i < input.length; i++) {
    const ch = input[i];
    if (ch === "\\") {
      i++;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        return { content: input.slice(start + 1, i), end: i + 1 };
      }
    }
  }

  return null;
}

export function readOptionalBracket(input: string, start: number): Braced | null {
  if (input[start] !== "[") return null;
  const close = input.indexOf("]", start);
  if (close === -1) return null;
  return { content: input.slice(start + 1, close), end: close + 1 };
}

/** Read `[...]` label content, respecting `{...}` nesting. */
export function readSquareBracket(input: string, start: number): Braced | null {
  if (input[start] !== "[") return null;

  let braceDepth = 0;
  for (let i = start + 1; i < input.length; i++) {
    if (input[i] === "\\") {
      const next = input[i + 1];
      if (next === "{" || next === "}" || next === "[") {
        i++;
        continue;
      }
      i++;
      continue;
    }
    if (input[i] === "{") braceDepth++;
    else if (input[i] === "}") braceDepth--;
    else if (input[i] === "]" && braceDepth === 0) {
      return { content: input.slice(start + 1, i), end: i + 1 };
    }
  }

  return null;
}

export function findEnvironmentEnd(
  input: string,
  env: string,
  from: number,
): number {
  const endTag = `\\end{${env}}`;
  let depth = 1;
  let i = from;

  while (i < input.length) {
    const beginAt = input.indexOf("\\begin{", i);
    const endAt = input.indexOf("\\end{", i);
    if (endAt === -1) return -1;

    const useBegin = beginAt !== -1 && beginAt < endAt;
    if (useBegin) {
      const nameStart = beginAt + 7;
      const close = input.indexOf("}", nameStart);
      if (close === -1) return -1;
      const name = input.slice(nameStart, close);
      if (name === env) depth++;
      i = close + 1;
      continue;
    }

    const nameStart = endAt + 5;
    const close = input.indexOf("}", nameStart);
    if (close === -1) return -1;
    const name = input.slice(nameStart, close);
    if (name === env) {
      depth--;
      if (depth === 0) return endAt;
    }
    i = close + 1;
  }

  return -1;
}

export function findUnescaped(input: string, target: string, from: number): number {
  for (let i = from; i < input.length; i++) {
    if (input[i] === "\\") {
      i++;
      continue;
    }
    if (input[i] === target) return i;
  }
  return -1;
}

/** Find the closing `$` of inline math, allowing nested `$...$` inside `{...}`. */
export function findInlineMathEnd(input: string, from: number): number {
  let braceDepth = 0;
  let i = from;

  while (i < input.length) {
    if (input[i] === "\\") {
      const next = input[i + 1];
      if (next === "{" || next === "}" || next === "$") {
        i += 2;
        continue;
      }
      const nameMatch = input.slice(i + 1).match(/^([a-zA-Z@*]+)/);
      if (nameMatch) {
        i += 1 + nameMatch[1].length;
        continue;
      }
      i += 2;
      continue;
    }

    if (input[i] === "{") {
      braceDepth++;
      i++;
      continue;
    }

    if (input[i] === "}") {
      braceDepth--;
      i++;
      continue;
    }

    if (input[i] === "$") {
      if (input[i + 1] === "$") {
        i += 2;
        continue;
      }
      if (braceDepth > 0) {
        const innerEnd = findInlineMathEnd(input, i + 1);
        if (innerEnd === -1) return -1;
        i = innerEnd + 1;
        continue;
      }
      return i;
    }

    i++;
  }

  return -1;
}

/** True when `pos` lies inside unescaped `$...$` (not `$$`). */
export function isInsideInlineMath(input: string, pos: number): boolean {
  let inMath = false;
  let i = 0;
  while (i < pos) {
    if (input[i] === "\\") {
      i += 2;
      continue;
    }
    if (input[i] === "$") {
      if (input[i + 1] === "$") {
        i += 2;
        continue;
      }
      inMath = !inMath;
    }
    i++;
  }
  return inMath;
}

export function extractBracedCommand(source: string, command: string): string | null {
  const token = `\\${command}`;
  const idx = source.indexOf(token);
  if (idx === -1) return null;
  let i = idx + token.length;
  while (i < source.length && /\s/.test(source[i])) i++;
  const arg = readBraced(source, i);
  return arg ? arg.content.trim() : null;
}
