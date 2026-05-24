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
