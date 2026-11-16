import { describe, it, expect } from 'bun:test';
import {
  centerLineText,
  solveBoldSpaces,
  detectUnsupportedMinecraftChars,
  MINECRAFT_LINES_PER_PAGE,
  MINECRAFT_PAGE_MAX_CHARS,
  formatSinglePage,
} from '../src/index';

describe('Typography & Minecraft Engine Utilities', () => {
  it('exports canonical constants', () => {
    expect(MINECRAFT_LINES_PER_PAGE).toBe(14);
    expect(MINECRAFT_PAGE_MAX_CHARS).toBe(1024);
  });

  describe('detectUnsupportedMinecraftChars', () => {
    it('passes standard ASCII and BMP symbols', () => {
      const res = detectUnsupportedMinecraftChars('Hello world! ⚔ ✦ █ ░ ╔═╗');
      expect(res.count).toBe(0);
      expect(res.chars).toEqual([]);
    });

    it('identifies SMP characters > U+FFFF', () => {
      const res = detectUnsupportedMinecraftChars('Test 😀 with 🔥 and 💀');
      expect(res.count).toBe(3);
      expect(res.chars).toContain('😀');
      expect(res.chars).toContain('🔥');
      expect(res.chars).toContain('💀');
    });
  });

  describe('solveBoldSpaces', () => {
    it('solves 0 margin', () => {
      expect(solveBoldSpaces(0)).toEqual({ regular: 0, bold: 0, achievedPx: 0 });
    });

    it('solves multiples of 4 with regular spaces', () => {
      const res = solveBoldSpaces(16);
      expect(res.achievedPx).toBe(16);
      expect(res.regular * 4 + res.bold * 5).toBe(16);
    });

    it('solves combinations of 4 and 5', () => {
      // 13 = 2*4 + 1*5
      const res = solveBoldSpaces(13);
      expect(res.achievedPx).toBe(13);
      expect(res.regular * 4 + res.bold * 5).toBe(13);
    });
  });

  describe('centerLineText', () => {
    it('returns empty string if input is blank', () => {
      expect(centerLineText('   ')).toBe('');
    });

    it('centers short text by prepending spaces', () => {
      const centered = centerLineText('Title');
      expect(centered).toMatch(/^\s*(?:§l\s*§r)?Title/);
      expect(centered.endsWith('Title')).toBe(true);
    });

    it('re-centers already padded lines without drift', () => {
      const centered1 = centerLineText('Chapter I');
      const centered2 = centerLineText(centered1);
      expect(centered2).toBe(centered1);
    });
  });

  describe('formatSinglePage', () => {
    const lines = ['§lChapter 1§r', 'Once upon a time'];

    it('formats raw', () => {
      expect(formatSinglePage(lines, 'raw')).toBe('§lChapter 1§r\nOnce upon a time');
    });

    it('formats ampersand', () => {
      expect(formatSinglePage(lines, 'ampersand')).toBe('&lChapter 1&r\nOnce upon a time');
    });

    it('formats plain', () => {
      expect(formatSinglePage(lines, 'plain')).toBe('Chapter 1\nOnce upon a time');
    });

    it('formats give command', () => {
      const cmd = formatSinglePage(lines, 'give', { title: 'Test', author: 'Author' });
      expect(cmd).toContain('/give @p written_book');
      expect(cmd).toContain('Chapter 1');
    });
  });
});
