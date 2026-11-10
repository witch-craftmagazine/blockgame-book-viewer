/**
 * Minimal SNBT (stringified NBT) reader and string writer.
 *
 * Minecraft 1.21.5+ stores text components (book pages, titles, lore) as real
 * NBT, so commands such as `/give` carry them as SNBT: `{text:"Hi",color:"red"}`
 * rather than a JSON document wrapped in a string. This module is only as
 * complete as the book tooling needs: compounds, lists, quoted/unquoted strings,
 * numbers (with type suffixes) and booleans.
 */

export type SnbtValue = string | number | boolean | SnbtValue[] | { [key: string]: SnbtValue };

const SIMPLE_NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?[bBsSlLfFdD]?$/;
const UNQUOTED = /^[0-9A-Za-z_\-.+]+$/;

/** Quotes a string for SNBT using double quotes. */
export function snbtString(value: string): string {
  let out = '"';
  for (const ch of value) {
    switch (ch) {
      case '\\': out += '\\\\'; break;
      case '"': out += '\\"'; break;
      case '\n': out += '\\n'; break;
      case '\r': out += '\\r'; break;
      case '\t': out += '\\t'; break;
      default: {
        const code = ch.codePointAt(0)!;
        // Other control characters would be mangled by chat input; escape them.
        out += code < 0x20 ? '\\u' + code.toString(16).padStart(4, '0') : ch;
      }
    }
  }
  return out + '"';
}

class Reader {
  private i = 0;
  constructor(private readonly s: string) {}

  parseValue(): SnbtValue {
    this.ws();
    const ch = this.s[this.i];
    if (ch === undefined) throw new Error('Unexpected end of SNBT');
    if (ch === '{') return this.parseCompound();
    if (ch === '[') return this.parseList();
    if (ch === '"' || ch === "'") return this.parseQuoted();
    return this.parseBare();
  }

  atEnd(): boolean {
    this.ws();
    return this.i >= this.s.length;
  }

  private ws(): void {
    while (this.i < this.s.length && /\s/.test(this.s[this.i])) this.i++;
  }

  private parseCompound(): SnbtValue {
    const obj: { [key: string]: SnbtValue } = {};
    this.i++; // {
    this.ws();
    if (this.s[this.i] === '}') { this.i++; return obj; }
    for (;;) {
      this.ws();
      const ch = this.s[this.i];
      const key = ch === '"' || ch === "'" ? this.parseQuoted() : this.parseBareToken();
      this.ws();
      if (this.s[this.i] !== ':') throw new Error(`Expected ':' at ${this.i}`);
      this.i++;
      obj[key] = this.parseValue();
      this.ws();
      const sep = this.s[this.i++];
      if (sep === '}') return obj;
      if (sep !== ',') throw new Error(`Expected ',' or '}' at ${this.i - 1}`);
    }
  }

  private parseList(): SnbtValue {
    const arr: SnbtValue[] = [];
    this.i++; // [
    this.ws();
    if (this.s[this.i] === ']') { this.i++; return arr; }
    for (;;) {
      arr.push(this.parseValue());
      this.ws();
      const sep = this.s[this.i++];
      if (sep === ']') return arr;
      if (sep !== ',') throw new Error(`Expected ',' or ']' at ${this.i - 1}`);
    }
  }

  private parseQuoted(): string {
    const quote = this.s[this.i++];
    let out = '';
    while (this.i < this.s.length) {
      const ch = this.s[this.i++];
      if (ch === quote) return out;
      if (ch !== '\\') { out += ch; continue; }
      const esc = this.s[this.i++];
      switch (esc) {
        case 'n': out += '\n'; break;
        case 'r': out += '\r'; break;
        case 't': out += '\t'; break;
        case 'b': out += '\b'; break;
        case 'f': out += '\f'; break;
        case 's': out += ' '; break;
        case 'x': out += String.fromCharCode(parseInt(this.s.substr(this.i, 2), 16)); this.i += 2; break;
        case 'u': out += String.fromCharCode(parseInt(this.s.substr(this.i, 4), 16)); this.i += 4; break;
        case 'U': out += String.fromCodePoint(parseInt(this.s.substr(this.i, 8), 16)); this.i += 8; break;
        default: out += esc; // \\ \" \' and anything unknown
      }
    }
    throw new Error('Unterminated SNBT string');
  }

  private parseBareToken(): string {
    const start = this.i;
    while (this.i < this.s.length && UNQUOTED.test(this.s[this.i])) this.i++;
    if (start === this.i) throw new Error(`Unexpected '${this.s[this.i]}' at ${this.i}`);
    return this.s.slice(start, this.i);
  }

  private parseBare(): SnbtValue {
    const token = this.parseBareToken();
    if (token === 'true') return true;
    if (token === 'false') return false;
    if (SIMPLE_NUMBER.test(token)) return parseFloat(token);
    return token;
  }
}

/** Parses a single SNBT value. Throws on malformed input. */
export function parseSnbt(input: string): SnbtValue {
  const reader = new Reader(input);
  const value = reader.parseValue();
  if (!reader.atEnd()) throw new Error('Trailing characters after SNBT value');
  return value;
}
