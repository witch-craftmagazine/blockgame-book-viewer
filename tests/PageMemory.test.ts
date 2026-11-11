import { describe, it, expect, beforeEach } from 'vitest';
import { PageMemoryManager, getBookStorageKey } from '../src/engine/PageMemoryManager';
import { BlockgameBook } from '../src/engine/types';

describe('PageMemoryManager (Opt-In Reading Progress)', () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    (globalThis as any).window = {
      localStorage: {
        getItem: (k: string) => mockStorage[k] ?? null,
        setItem: (k: string, v: string) => { mockStorage[k] = String(v); },
        removeItem: (k: string) => { delete mockStorage[k]; },
        get length() { return Object.keys(mockStorage).length; },
        key: (i: number) => Object.keys(mockStorage)[i] ?? null,
      },
    };
  });

  const testBook: BlockgameBook = {
    title: 'The Great Journey',
    author: 'Steve',
    pages: ['Page 1', 'Page 2', 'Page 3', 'Page 4', 'Page 5'],
  };

  it('is disabled by default and does not read or write localStorage', () => {
    const memory = new PageMemoryManager();
    expect(memory.isEnabled()).toBe(false);

    memory.save(testBook, 3);
    expect(Object.keys(mockStorage).length).toBe(0);
    expect(memory.load(testBook)).toBeNull();
  });

  it('saves and restores reading progress when explicitly enabled', () => {
    const memory = new PageMemoryManager({ enabled: true });
    expect(memory.isEnabled()).toBe(true);

    memory.save(testBook, 2);
    expect(Object.keys(mockStorage).length).toBe(1);

    const loaded = memory.load(testBook);
    expect(loaded).toBe(2);
  });

  it('clamps loaded page index to valid book bounds', () => {
    const memory = new PageMemoryManager({ enabled: true });
    // Save page index 99 on a 5-page book (max index 4)
    const key = getBookStorageKey(testBook);
    mockStorage[key] = JSON.stringify({ page: 99 });

    expect(memory.load(testBook)).toBe(4);
  });

  it('supports toggling enabled state at runtime', () => {
    const memory = new PageMemoryManager({ enabled: false });
    memory.save(testBook, 1);
    expect(memory.load(testBook)).toBeNull();

    memory.setEnabled(true);
    memory.save(testBook, 1);
    expect(memory.load(testBook)).toBe(1);
  });

  it('clears specific book progress or all book progress records', () => {
    const memory = new PageMemoryManager({ enabled: true });
    const otherBook: BlockgameBook = {
      title: 'Redstone Handbook',
      author: 'Alex',
      pages: ['Intro'],
    };

    memory.save(testBook, 3);
    memory.save(otherBook, 0);
    expect(Object.keys(mockStorage).length).toBe(2);

    memory.clear(testBook);
    expect(memory.load(testBook)).toBeNull();
    expect(memory.load(otherBook)).toBe(0);

    memory.clear();
    expect(memory.load(otherBook)).toBeNull();
    expect(Object.keys(mockStorage).length).toBe(0);
  });
});
