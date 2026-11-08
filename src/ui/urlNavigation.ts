/**
 * Utilities for deep-linking and sharing links to specific issues and pages of the magazine.
 */

export interface BookUrlState {
  issueId: string | null;
  page: number | null; // 1-indexed page number
}

/**
 * Parses issue and page information from a URL string, window.location.hash, or search string.
 *
 * Supported formats:
 * - `#issue=issue1&page=13`
 * - `#page=13&issue=issue1`
 * - `#issue1/13` or `#issue1:13`
 * - `#issue1&page=13`
 * - `#issue=issue1` or `#issue1`
 * - `?issue=issue1&page=13`
 */
export function parseBookUrl(input: string, validIssueIds?: readonly string[]): BookUrlState {
  let issueId: string | null = null;
  let page: number | null = null;

  if (!input) {
    return { issueId: null, page: null };
  }

  // 1. If full URL or query params are provided, check search params first
  if (input.includes('?')) {
    const searchPart = input.split('?')[1]?.split('#')[0] || '';
    const searchParams = new URLSearchParams(searchPart);
    if (searchParams.has('issue')) {
      issueId = searchParams.get('issue');
    }
    if (searchParams.has('page')) {
      const p = parseInt(searchParams.get('page') || '', 10);
      if (!isNaN(p) && p > 0) page = p;
    }
  }

  // 2. Check hash part (hash takes precedence over query params if both present)
  let hashPart = '';
  if (input.includes('#')) {
    hashPart = input.substring(input.indexOf('#') + 1);
  } else if (!input.startsWith('http://') && !input.startsWith('https://') && !input.startsWith('?')) {
    // Treat raw input as hash if it's not a full URL
    hashPart = input;
  }

  if (hashPart) {
    // Check if hash has query-style parameters (e.g. issue=issue1&page=13 or issue1&page=13)
    if (hashPart.includes('=') || hashPart.includes('&')) {
      const hashParams = new URLSearchParams(hashPart.startsWith('?') ? hashPart.substring(1) : hashPart);
      if (hashParams.has('issue')) {
        issueId = hashParams.get('issue');
      }
      if (hashParams.has('page')) {
        const p = parseInt(hashParams.get('page') || '', 10);
        if (!isNaN(p) && p > 0) page = p;
      }
      // Check for standalone key like #issue1&page=13
      for (const [key, val] of hashParams.entries()) {
        if (!val && (!validIssueIds || validIssueIds.includes(key))) {
          issueId = key;
        }
      }
    } else {
      // Check shorthand formats: "issue1/13" or "issue1:13" or "issue11.5:1"
      const slashMatch = hashPart.match(/^([a-zA-Z0-9_.-]+)[/:]([0-9]+)$/);
      if (slashMatch) {
        issueId = slashMatch[1];
        const p = parseInt(slashMatch[2], 10);
        if (!isNaN(p) && p > 0) page = p;
      } else {
        // Plain issue id: "issue1"
        issueId = hashPart;
      }
    }
  }

  // Validate issueId against whitelist if provided
  if (validIssueIds && issueId && !validIssueIds.includes(issueId)) {
    issueId = null;
  }

  return { issueId, page };
}

/**
 * Builds a canonical hash string for deep linking to a specific issue and page.
 * Example: `#issue=issue1&page=13`
 */
export function buildBookHash(issueId: string, page: number = 1): string {
  const p = Math.max(1, Math.floor(page));
  return `#issue=${issueId}&page=${p}`;
}

/**
 * Builds the complete shareable URL for an issue and page.
 */
export function buildShareableUrl(issueId: string, page: number = 1, baseUrl?: string): string {
  const base = baseUrl || (typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '');
  return `${base}${buildBookHash(issueId, page)}`;
}
