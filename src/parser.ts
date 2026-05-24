import katex from "katex";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  applyBuiltinDefinitions,
  createContext,
  parsePreamble,
  type Context,
} from "./preamble.js";
import {
  findEnvironmentEnd,
  findUnescaped,
  readBraced,
  readOptionalBracket,
} from "./tex-read.js";

export interface ParseResult {
  title: string;
  lectures: number[];
  html: string;
}

const TEXT_COMMANDS: Record<string, string> = {
  textbf: "strong",
  textit: "em",
  emph: "em",
  texttt: "code",
};

const MATH_ENVS = new Set([
  "align",
  "align*",
  "equation",
  "equation*",
  "gather",
  "gather*",
  "multline",
  "multline*",
]);

const HEADING_COMMANDS: Record<string, string> = {
  section: "h2",
  subsection: "h3",
  subsubsection: "h4",
};

const ENV_COLORS: Record<string, string> = {
  problem: "#C96600",
  solution: "#295A25",
  "solution*": "#295A25",
  proof: "#5B1E85",
  "proof*": "#5B1E85",
  claim: "#008080",
  remark: "#999999",
};

const XCOLOR_NAMES: Record<string, string> = {
  "black!40": "#999999",
  "teal!40": "#009688",
  "teal!100": "#008080",
  teal: "#008080",
  black: "#000000",
};

const KNOWN_ESCAPES: Record<string, string> = {
  "%": "%",
  $: "$",
  "&": "&",
  "#": "#",
  _: "_",
  "{": "{",
  "}": "}",
  "\\": "\\",
};

export function parseTex(
  bodySource: string,
  preambleSource = "",
  projectRoot = "",
): ParseResult {
  const { preamble: docPreamble, body, title, lectures } = extractDocument(bodySource);
  const preamble = [preambleSource.trim(), docPreamble.trim()]
    .filter(Boolean)
    .join("\n");
  const ctx = createContext();
  ctx.projectRoot = projectRoot;
  parsePreamble(preamble, ctx);
  applyBuiltinDefinitions(ctx);
  const html = renderBody(stripComments(body), ctx);
  return { title, lectures, html };
}

function stripComments(source: string): string {
  let out = "";
  let i = 0;

  while (i < source.length) {
    if (source[i] === "%" && (i === 0 || source[i - 1] !== "\\")) {
      const nl = source.indexOf("\n", i);
      if (nl === -1) break;
      out += "\n";
      i = nl + 1;
      continue;
    }
    out += source[i];
    i++;
  }

  return out;
}

function extractDocument(source: string): {
  preamble: string;
  body: string;
  title: string;
  lectures: number[];
} {
  const docStart = source.indexOf("\\begin{document}");
  let preamble = "";
  let body = source.trim();

  if (docStart !== -1) {
    preamble = source.slice(0, docStart);
    const afterBegin = docStart + "\\begin{document}".length;
    const newline = source.indexOf("\n", afterBegin);
    const bodyStart = newline === -1 ? afterBegin : newline + 1;
    const docEnd = source.indexOf("\\end{document}");
    body =
      docEnd !== -1
        ? source.slice(bodyStart, docEnd).trim()
        : source.slice(bodyStart).trim();
  }

  const titleMatch = preamble.match(/\\title\{([^}]*)\}/);
  const title = titleMatch ? titleMatch[1] : "Page";

  const lecturesMatch = preamble.match(/\\lectures\{([^}]*)\}/);
  if (lecturesMatch) {
    const lectures = lecturesMatch[1]
      .split(",")
      .map((part) => Number.parseInt(part.trim(), 10))
      .filter((n) => !Number.isNaN(n));
    return { preamble, body, title, lectures };
  }

  const lectureMatch = preamble.match(/\\lecture\{(\d+)\}/);
  const lectures = lectureMatch ? [Number.parseInt(lectureMatch[1], 10)] : [];

  return { preamble, body, title, lectures };
}

function renderBody(body: string, ctx: Context): string {
  const parts: string[] = [];
  let i = 0;

  while (i < body.length) {
    i = skipSpace(body, i);
    if (i >= body.length) break;

    if (body.startsWith("\\begin{", i)) {
      const parsed = parseEnvironmentBlock(body, i, ctx);
      if (parsed) {
        parts.push(parsed.html);
        i = parsed.end;
        continue;
      }
    }

    if (body.startsWith("\\[", i)) {
      const close = body.indexOf("\\]", i + 2);
      if (close !== -1) {
        parts.push(renderMath(body.slice(i + 2, close).trim(), true, ctx));
        i = close + 2;
        continue;
      }
    }

    const heading = parseHeadingCommand(body, i, ctx);
    if (heading) {
      parts.push(heading.html);
      i = heading.end;
      continue;
    }

    const nextSpecial = findNextBlockStart(body, i);
    const chunk = body.slice(i, nextSpecial === -1 ? body.length : nextSpecial).trim();
    if (nextSpecial === i) {
      parts.push(renderParagraphBlock(body.slice(i, i + 1), ctx));
      i++;
      continue;
    }
    if (chunk) parts.push(renderParagraphBlock(chunk, ctx));
    i = nextSpecial === -1 ? body.length : nextSpecial;
  }

  return parts.join("\n");
}

function findNextBlockStart(body: string, from: number): number {
  const patterns = [
    "\\begin{",
    "\\[",
    ...Object.keys(HEADING_COMMANDS).map((name) => `\\${name}{`),
  ];
  const candidates = patterns
    .map((pattern) => body.indexOf(pattern, from))
    .filter((n) => n !== -1);
  if (candidates.length === 0) return -1;
  return Math.min(...candidates);
}

function parseHeadingCommand(
  body: string,
  start: number,
  ctx: Context,
): { html: string; end: number } | null {
  if (body[start] !== "\\") return null;

  const rest = body.slice(start + 1);
  const nameMatch = rest.match(/^(subsection|subsubsection|section)/);
  if (!nameMatch) return null;

  const name = nameMatch[1];
  const tag = HEADING_COMMANDS[name];
  let i = start + 1 + name.length;
  const arg = readBraced(body, i);
  if (!arg) return null;

  return {
    html: `<${tag} class="heading-${name}">${parseInline(arg.content, ctx)}</${tag}>`,
    end: arg.end,
  };
}

function parseEnvironmentBlock(
  body: string,
  start: number,
  ctx: Context,
): { html: string; end: number } | null {
  const nameStart = start + 7;
  const nameEnd = body.indexOf("}", nameStart);
  if (nameEnd === -1) return null;
  const env = body.slice(nameStart, nameEnd);
  let i = nameEnd + 1;

  let boxedWidth = "36em";
  if (body[i] === "[") {
    const optional = readOptionalBracket(body, i);
    if (optional) {
      if (env === "boxed-text") boxedWidth = optional.content.trim();
      i = optional.end;
    }
  }

  const args: string[] = [];
  const envDef = ctx.environments.get(env);
  const argCount = envDef?.params ?? 0;
  for (let n = 0; n < argCount; n++) {
    const arg = readBraced(body, i);
    if (!arg) break;
    args.push(arg.content);
    i = arg.end;
  }

  const innerStart = i;
  const innerEnd = findEnvironmentEnd(body, env, innerStart);
  if (innerEnd === -1) return null;

  const inner = body.slice(innerStart, innerEnd).trim();
  const end = innerEnd + `\\end{${env}}`.length;

  if (env === "center") {
    return { html: `<p class="center">${parseInline(inner, ctx)}</p>`, end };
  }

  if (env === "itemize") {
    return { html: renderList(inner, ctx, "ul"), end };
  }

  if (env === "enumerate") {
    return { html: renderList(inner, ctx, "ol"), end };
  }

  if (env === "quote") {
    return {
      html: `<blockquote class="quote">${renderBody(inner, ctx)}</blockquote>`,
      end,
    };
  }

  if (MATH_ENVS.has(env)) {
    return {
      html: renderMath(`\\begin{${env}}${inner}\\end{${env}}`, true, ctx),
      end,
    };
  }

  if (env === "boxed-text") {
    const width = sanitizeCssLength(boxedWidth);
    return {
      html: `<div class="boxed-text" style="max-width:${width}">${renderBody(inner, ctx)}</div>`,
      end,
    };
  }

  if (envDef) {
    const open = stripColorDirectives(substituteArgs(envDef.begin, args));
    const labelHtml = parseInline(open, ctx);
    const innerHtml = renderBody(inner, ctx);
    const color = ENV_COLORS[env];
    const style = color ? ` style="color:${color}"` : "";
    const html = `<section class="env env-${envClassName(env)}"${style}>${mergeEnvPrefix(labelHtml, innerHtml)}</section>`;
    return { html, end };
  }

  return {
    html: `<section class="env env-${env}">${renderBody(inner, ctx)}</section>`,
    end,
  };
}

function sanitizeCssLength(value: string): string {
  const trimmed = value.trim();
  if (/^[\d.]+(em|ex|px|pt|rem|%)$/.test(trimmed)) return trimmed;
  return "36em";
}

function stripColorDirectives(tex: string): string {
  return tex
    .replace(/\\color(\[[^\]]*\])?\{[^}]*\}/g, "")
    .replace(/\\noindent\s*/g, "")
    .replace(/\\vspace\{[^}]*\}/g, "")
    .trim();
}

function envClassName(env: string): string {
  return env.replaceAll("*", "-star");
}

function mergeEnvPrefix(prefix: string, bodyHtml: string): string {
  if (!prefix.trim()) return bodyHtml;
  const label = prefix.trimEnd().endsWith(" ") ? prefix : `${prefix} `;
  const trimmed = bodyHtml.trimStart();
  const match = trimmed.match(/^<p>([\s\S]*?)<\/p>\n?/);
  if (match) {
    return `<p>${label}${match[1]}</p>${trimmed.slice(match[0].length)}`;
  }
  return `<p>${label}${trimmed}</p>`;
}

function splitListItems(inner: string): string[] {
  const items: string[] = [];
  let itemStart = -1;
  let i = 0;
  let envDepth = 0;

  while (i < inner.length) {
    if (inner.startsWith("\\begin{", i)) {
      envDepth++;
      i += 7;
      const close = inner.indexOf("}", i);
      i = close === -1 ? inner.length : close + 1;
      continue;
    }
    if (inner.startsWith("\\end{", i)) {
      envDepth--;
      i += 5;
      const close = inner.indexOf("}", i);
      i = close === -1 ? inner.length : close + 1;
      continue;
    }
    if (envDepth === 0 && inner.startsWith("\\item", i)) {
      let after = i + 5;
      if (inner[after] === "[") {
        const bracketEnd = inner.indexOf("]", after);
        if (bracketEnd !== -1) after = bracketEnd + 1;
      }
      while (after < inner.length && /\s/.test(inner[after])) after++;

      if (itemStart !== -1) {
        items.push(inner.slice(itemStart, i).trim());
      }
      itemStart = after;
      i = after;
      continue;
    }
    i++;
  }

  if (itemStart !== -1) {
    items.push(inner.slice(itemStart).trim());
  }

  return items;
}

function renderList(inner: string, ctx: Context, tag: "ul" | "ol"): string {
  const items = splitListItems(inner);
  const lis = items
    .map((item) => `<li>${renderBody(item, ctx)}</li>`)
    .join("");
  return `<${tag}>${lis}</${tag}>`;
}

function renderParagraphBlock(block: string, ctx: Context): string {
  const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
  return lines
    .map((line) => {
      const heading = parseHeadingCommand(line, 0, ctx);
      if (heading && heading.end === line.length) return heading.html;
      return `<p>${parseInline(line, ctx)}</p>`;
    })
    .join("\n");
}

function parseInline(input: string, ctx: Context): string {
  let out = "";
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (ch === "%") {
      const nl = input.indexOf("\n", i);
      i = nl === -1 ? input.length : nl + 1;
      continue;
    }

    if (ch === "$" && input[i + 1] !== "$") {
      const end = findUnescaped(input, "$", i + 1);
      if (end === -1) {
        out += escapeText(ch);
        i++;
        continue;
      }
      out += renderMath(input.slice(i + 1, end), false, ctx);
      i = end + 1;
      continue;
    }

    if (ch === "~") {
      out += "\u00A0";
      i++;
      continue;
    }

    if (ch === "`" && input[i + 1] === "`") {
      out += "\u201C";
      i += 2;
      continue;
    }

    if (ch === "'" && input[i + 1] === "'") {
      out += "\u201D";
      i += 2;
      continue;
    }

    if (ch === "-" && input[i + 1] === "-" && input[i + 2] === "-") {
      out += "\u2014";
      i += 3;
      continue;
    }

    if (ch === "\\") {
      if (input[i + 1] === "\\") {
        out += "<br>";
        i += 2;
        continue;
      }

      const handled = parseCommand(input, i, ctx);
      if (handled) {
        out += handled.html;
        i = handled.end;
        continue;
      }
    }

    out += escapeText(ch);
    i++;
  }

  return out;
}

function parseCommand(
  input: string,
  start: number,
  ctx: Context,
): { html: string; end: number } | null {
  const rest = input.slice(start + 1);
  const nameMatch = rest.match(/^([a-zA-Z@*]+)/);
  if (!nameMatch) {
    const next = input[start + 1];
    if (next && KNOWN_ESCAPES[next] !== undefined) {
      return { html: escapeText(KNOWN_ESCAPES[next]), end: start + 2 };
    }
    return { html: escapeText(input[start]), end: start + 1 };
  }

  const name = nameMatch[1];
  let i = start + 1 + name.length;

  if (name === "begin" || name === "end") {
    const arg = readBraced(input, i);
    if (!arg) return { html: escapeText(input[start]), end: start + 1 };
    return { html: "", end: arg.end };
  }

  if (name === "noindent" || name === "line" || name === "vspace") {
    if (input[i] === "{") {
      const arg = readBraced(input, i);
      if (arg) return { html: "", end: arg.end };
    }
    return { html: "", end: i };
  }

  if (name === "color") {
    const color = readColorSpec(input, i);
    if (color) {
      if (color.value === "#000000" || color.value === "black") {
        return { html: "", end: color.end };
      }
      const rest = input.slice(color.end);
      return {
        html: `<span style="color:${color.value}">${parseInline(rest, ctx)}</span>`,
        end: input.length,
      };
    }

    const named = readBraced(input, i);
    if (named) {
      const value = XCOLOR_NAMES[named.content.trim()] ?? named.content;
      if (value === "black" || value === "#000000") {
        return { html: "", end: named.end };
      }
      const rest = input.slice(named.end);
      return {
        html: `<span style="color:${value.startsWith("#") ? value : `#${value}`}">${parseInline(rest, ctx)}</span>`,
        end: input.length,
      };
    }
  }

  if (name === "horizontal") {
    return { html: "<hr>", end: i };
  }

  if (name === "circled") {
    const arg = readBraced(input, i);
    if (!arg) return { html: escapeText("\\circled"), end: i };
    return {
      html: `<span class="circled">${parseInline(arg.content, ctx)}</span>`,
      end: arg.end,
    };
  }

  if (name === "frame" || name === "fbox") {
    const arg = readBraced(input, i);
    if (!arg) return { html: escapeText(`\\${name}`), end: i };
    const inner = arg.content.trim();
    if (inner.startsWith("\\includegraphics")) {
      const rendered = parseIncludeGraphicsCommand(inner, 0, ctx, "framed");
      if (rendered) return { html: rendered.html, end: arg.end };
    }
    return {
      html: `<span class="frame">${parseInline(arg.content, ctx)}</span>`,
      end: arg.end,
    };
  }

  if (name === "includegraphics") {
    const rendered = parseIncludeGraphicsCommand(input, start, ctx);
    if (rendered) return rendered;
    return { html: escapeText("\\includegraphics"), end: i };
  }

  const textMacro = ctx.textMacros.get(name);
  if (textMacro) {
    const args = readMacroArgs(input, i, textMacro.params);
    if (textMacro.math) {
      const tex = substituteArgs(textMacro.body, args.values);
      return { html: renderMath(tex, false, ctx), end: args.end };
    }
    const expanded = substituteArgs(textMacro.body, args.values);
    return { html: parseInline(expanded, ctx), end: args.end };
  }

  if (ctx.katexMacros[`\\${name}`]) {
    const args = readMacroArgs(
      input,
      i,
      countMacroParams(ctx.katexMacros[`\\${name}`]),
    );
    let tex = `\\${name}`;
    for (const arg of args.values) tex += `{${arg}}`;
    return { html: renderMath(tex, false, ctx), end: args.end };
  }

  if (name === "textsc") {
    const arg = readBraced(input, i);
    if (!arg) return { html: escapeText(`\\${name}`), end: i };
    return {
      html: `<span class="small-caps">${parseInline(arg.content, ctx)}</span>`,
      end: arg.end,
    };
  }

  if (name === "underline") {
    const arg = readBraced(input, i);
    if (!arg) return { html: escapeText(`\\${name}`), end: i };
    const mathTex = mixedInlineToMathTex(arg.content);
    if (mathTex) {
      return {
        html: renderMath(`\\underline{${mathTex}}`, false, ctx),
        end: arg.end,
      };
    }
    return {
      html: `<span class="underline">${parseInline(arg.content, ctx)}</span>`,
      end: arg.end,
    };
  }

  const tag = TEXT_COMMANDS[name];
  if (tag) {
    const arg = readBraced(input, i);
    if (!arg) return { html: escapeText(`\\${name}`), end: i };
    return {
      html: `<${tag}>${parseInline(arg.content, ctx)}</${tag}>`,
      end: arg.end,
    };
  }

  if (name === "dots" || name === "ldots" || name === "cdots") {
    return { html: "…", end: i };
  }

  if (KNOWN_ESCAPES[name] !== undefined) {
    return { html: escapeText(KNOWN_ESCAPES[name]), end: i };
  }

  if (isLikelyMathCommand(name)) {
    return { html: renderMath(`\\${name}`, false, ctx), end: i };
  }

  return { html: escapeText(`\\${name}`), end: i };
}

function mixedInlineToMathTex(input: string): string {
  const parts: string[] = [];
  let textBuf = "";
  let i = 0;

  const flushText = () => {
    if (!textBuf) return;
    parts.push(`\\text{${escapeTextForMathText(textBuf)}}`);
    textBuf = "";
  };

  while (i < input.length) {
    if (input[i] === "$" && input[i + 1] !== "$") {
      flushText();
      const end = findUnescaped(input, "$", i + 1);
      if (end === -1) {
        textBuf += input[i];
        i++;
        continue;
      }
      const math = input.slice(i + 1, end).trim();
      if (math) parts.push(math);
      i = end + 1;
      continue;
    }

    textBuf += input[i];
    i++;
  }

  flushText();
  return parts.join("");
}

function escapeTextForMathText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/([#$%&_{}])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

function parseIncludeGraphicsCommand(
  input: string,
  start: number,
  ctx: Context,
  extraClass = "",
): { html: string; end: number } | null {
  if (!input.startsWith("\\includegraphics", start)) return null;

  let i = start + "\\includegraphics".length;
  let options = "";
  if (input[i] === "[") {
    const optional = readOptionalBracket(input, i);
    if (optional) {
      options = optional.content;
      i = optional.end;
    }
  }

  const arg = readBraced(input, i);
  if (!arg) return null;

  const src = resolveImageSrc(arg.content.trim(), ctx);
  const style = imageStyleFromOptions(options);
  const classes = extraClass ? `note-figure ${extraClass}` : "note-figure";
  const styleAttr = style ? ` style="${escapeAttr(style)}"` : "";

  return {
    html: `<img src="{{ASSET_PREFIX}}${escapeAttr(src)}" alt="" class="${classes}"${styleAttr}>`,
    end: arg.end,
  };
}

function readColorSpec(
  input: string,
  start: number,
): { value: string; end: number } | null {
  const bracket = readOptionalBracket(input, start);
  if (!bracket) return null;

  if (bracket.content === "HTML") {
    const hex = readBraced(input, bracket.end);
    if (!hex) return null;
    return { value: `#${hex.content}`, end: hex.end };
  }

  const named = XCOLOR_NAMES[bracket.content.trim()];
  if (named) return { value: named, end: bracket.end };

  return { value: bracket.content, end: bracket.end };
}

function readMacroArgs(
  input: string,
  start: number,
  count: number,
): { values: string[]; end: number } {
  const values: string[] = [];
  let i = start;
  for (let n = 0; n < count; n++) {
    const arg = readBraced(input, i);
    if (!arg) break;
    values.push(arg.content);
    i = arg.end;
  }
  return { values, end: i };
}

function countMacroParams(body: string): number {
  const matches = body.match(/#\d/g);
  if (!matches) return 0;
  return Math.max(...matches.map((m) => Number.parseInt(m.slice(1), 10)));
}

function substituteArgs(template: string, args: string[]): string {
  let out = template;
  args.forEach((arg, index) => {
    out = out.replaceAll(`#${index + 1}`, arg);
  });
  return out;
}

function renderMath(tex: string, display: boolean, ctx: Context): string {
  try {
    return katex.renderToString(tex, {
      displayMode: display,
      throwOnError: false,
      strict: "ignore",
      trust: true,
      macros: {
        ...ctx.katexMacros,
        "\\textsc": "\\htmlClass{small-caps}{\\text{#1}}",
      },
    });
  } catch {
    return `<code>${escapeText(tex)}</code>`;
  }
}

function isLikelyMathCommand(name: string): boolean {
  return /^(mathbb|mathds|mathfrak|mathscr|mathcal|mathrm|mathbf|mathit|mathsf|math|operatorname|frac|sqrt|overrightarrow|overleftrightarrow|dot|ddot|dv|pdv|bra|ket|Braket|braket|lcm|im|Stab|Var|Real|blacksquare|square)$/.test(
    name,
  );
}

function normalizeColorCommands(tex: string): string {
  return tex.replace(/\\color\{([^}]+)\}/g, (_match, name: string) => {
    const key = name.trim();
    const hex = XCOLOR_NAMES[key];
    if (!hex) return `\\color{${key}}`;
    return `\\color[HTML]{${hex.slice(1)}}`;
  });
}

function skipSpace(input: string, start: number): number {
  let i = start;
  while (i < input.length && /\s/.test(input[i])) i++;
  return i;
}

function escapeText(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttr(text: string): string {
  return escapeText(text).replaceAll('"', "&quot;");
}

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"];

function resolveImageSrc(name: string, ctx: Context): string {
  const normalizedName = name.replace(/^\.\//, "");
  const hasExtension = /\.[a-zA-Z0-9]+$/.test(normalizedName);

  for (const base of ctx.imagePaths) {
    const prefix = base.endsWith("/") ? base : `${base}/`;
    const candidate = `${prefix}${normalizedName}`;

    if (hasExtension || !ctx.projectRoot) {
      return candidate;
    }

    for (const ext of IMAGE_EXTENSIONS) {
      if (existsSync(join(ctx.projectRoot, candidate + ext))) {
        return candidate + ext;
      }
    }

    return candidate + ".png";
  }

  return normalizedName;
}

function imageStyleFromOptions(options: string): string {
  if (!options.trim()) return "";

  const styles: string[] = [];
  for (const part of options.split(",")) {
    const trimmed = part.trim();
    const match = trimmed.match(/^([a-zA-Z]+)\s*=\s*(.+)$/);
    if (!match) continue;

    const key = match[1];
    const rawValue = match[2].trim();
    const css = imageOptionToCss(key, rawValue);
    if (css) styles.push(css);
  }

  return styles.join("; ");
}

function imageOptionToCss(key: string, rawValue: string): string | null {
  if (key === "width") {
    const textwidth = rawValue.match(/^([\d.]+)\s*\\textwidth$/);
    if (textwidth) {
      const fraction = Number.parseFloat(textwidth[1]);
      if (!Number.isNaN(fraction)) {
        return `max-width:${fraction * 100}%`;
      }
    }
    if (/^[\d.]+(em|ex|px|pt|rem|%)$/.test(rawValue)) {
      return `max-width:${rawValue}`;
    }
    if (/^[\d.]+cm$/.test(rawValue)) {
      return `max-width:${rawValue}`;
    }
  }

  if (key === "height") {
    if (/^[\d.]+(em|ex|px|pt|rem|cm|%)$/.test(rawValue)) {
      return `max-height:${rawValue}`;
    }
  }

  if (key === "scale") {
    const scale = Number.parseFloat(rawValue);
    if (!Number.isNaN(scale)) {
      return `max-width:${scale * 100}%`;
    }
  }

  return null;
}
