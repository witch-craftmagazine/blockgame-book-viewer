import { MinecraftBook } from './types';

/**
 * Computes a fast deterministic 32-bit FNV-1a hash of a string.
 */
function fnv1a(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

/**
 * Generates a unique, deterministic storage key for a book.
 */
export function getBookStorageKey(book: MinecraftBook, prefix = 'mc_book_progress_'): string {
  const title = book.title || 'untitled';
  const author = book.author || 'unknown';
  const totalPages = book.pages?.length || 0;
  const sample = book.pages?.[0]?.slice(0, 80) || '';
  const descriptor = `${title}__${author}__${totalPages}__${sample}`;
  return `${prefix}${fnv1a(descriptor)}`;
}

/**
 * Manages persistent reading progress in localStorage.
 * STRICTLY OPT-IN: defaults to disabled so books reset to page 1 on page refresh unless explicitly requested.
 */
export class PageMemoryManager {
  private enabled: boolean;
  private prefix: string;

  constructor(options: { enabled?: boolean; prefix?: string } = {}) {
    this.enabled = options.enabled ?? false;
    this.prefix = options.prefix ?? 'mc_book_progress_';
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Persists the current 0-based page index to localStorage if enabled.
   */
  public save(book: MinecraftBook, pageIndex: number): void {
    if (!this.enabled || !book) return;
    if (typeof window === 'undefined' || !window.localStorage) return;

    try {
      const key = getBookStorageKey(book, this.prefix);
      window.localStorage.setItem(
        key,
        JSON.stringify({
          page: pageIndex,
          timestamp: Date.now(),
        })
      );
    } catch {
      // Gracefully handle Private Browsing / QuotaExceededError
    }
  }

  /**
   * Retrieves the saved 0-based page index from localStorage if enabled.
   * Returns null if disabled, no record exists, or index is out of bounds.
   */
  public load(book: MinecraftBook): number | null {
    if (!this.enabled || !book) return null;
    if (typeof window === 'undefined' || !window.localStorage) return null;

    try {
      const key = getBookStorageKey(book, this.prefix);
      const raw = window.localStorage.getItem(key);
      if (!raw) return null;

      const data = JSON.parse(raw);
      if (typeof data?.page === 'number' && Number.isFinite(data.page)) {
        const page = Math.floor(data.page);
        const maxPage = Math.max(0, (book.pages?.length || 1) - 1);
        return Math.max(0, Math.min(page, maxPage));
      }
    } catch {
      // Gracefully handle parse error or storage access denied
    }

    return null;
  }

  /**
   * Clears saved reading progress for a given book, or clears all book progress records if omitted.
   */
  public clear(book?: MinecraftBook): void {
    if (typeof window === 'undefined' || !window.localStorage) return;

    try {
      if (book) {
        const key = getBookStorageKey(book, this.prefix);
        window.localStorage.removeItem(key);
      } else {
        const keysToRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key && key.startsWith(this.prefix)) {
            keysToRemove.push(key);
          }
        }
        for (const k of keysToRemove) {
          window.localStorage.removeItem(k);
        }
      }
    } catch {
      // Storage access safety
    }
  }
}
