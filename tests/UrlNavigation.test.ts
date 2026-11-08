import { describe, it, expect } from 'vitest';
import { parseBookUrl, buildBookHash, buildShareableUrl } from '../src/ui/urlNavigation';

const VALID_ISSUES = ['intro', 'issue1', 'issue2', 'issue13', 'issue2023', 'issue11.5', 'issueX'];

describe('URL Navigation and Deep-linking', () => {
  it('parses Issue X shorthand (#issueX/1)', () => {
    const res = parseBookUrl('#issueX/1', VALID_ISSUES);
    expect(res.issueId).toBe('issueX');
    expect(res.page).toBe(1);
  });
  it('parses decimal issue identifiers in shorthand (#issue11.5/3)', () => {
    const res = parseBookUrl('#issue11.5/3', VALID_ISSUES);
    expect(res.issueId).toBe('issue11.5');
    expect(res.page).toBe(3);
  });
  it('parses standard key-value hash format (#issue=issue1&page=13)', () => {
    const res = parseBookUrl('#issue=issue1&page=13', VALID_ISSUES);
    expect(res.issueId).toBe('issue1');
    expect(res.page).toBe(13);
  });

  it('parses reversed key-value hash format (#page=13&issue=issue1)', () => {
    const res = parseBookUrl('#page=13&issue=issue1', VALID_ISSUES);
    expect(res.issueId).toBe('issue1');
    expect(res.page).toBe(13);
  });

  it('parses slash shorthand format (#issue1/13)', () => {
    const res = parseBookUrl('#issue1/13', VALID_ISSUES);
    expect(res.issueId).toBe('issue1');
    expect(res.page).toBe(13);
  });

  it('parses colon shorthand format (#issue2:5)', () => {
    const res = parseBookUrl('#issue2:5', VALID_ISSUES);
    expect(res.issueId).toBe('issue2');
    expect(res.page).toBe(5);
  });

  it('parses mixed shorthand hash (#issue1&page=13)', () => {
    const res = parseBookUrl('#issue1&page=13', VALID_ISSUES);
    expect(res.issueId).toBe('issue1');
    expect(res.page).toBe(13);
  });

  it('parses issue only without page (#issue=issue2 or #issue2)', () => {
    const res1 = parseBookUrl('#issue=issue2', VALID_ISSUES);
    expect(res1.issueId).toBe('issue2');
    expect(res1.page).toBeNull();

    const res2 = parseBookUrl('#issue2', VALID_ISSUES);
    expect(res2.issueId).toBe('issue2');
    expect(res2.page).toBeNull();
  });

  it('parses full URL with search query params (https://example.com/?issue=issue13&page=7)', () => {
    const res = parseBookUrl('https://example.com/?issue=issue13&page=7', VALID_ISSUES);
    expect(res.issueId).toBe('issue13');
    expect(res.page).toBe(7);
  });

  it('prefers hash over search query when both are present', () => {
    const res = parseBookUrl('https://example.com/?issue=issue1&page=1#issue=issue2&page=9', VALID_ISSUES);
    expect(res.issueId).toBe('issue2');
    expect(res.page).toBe(9);
  });

  it('ignores invalid issue IDs if valid list is provided', () => {
    const res = parseBookUrl('#issue=invalid_issue&page=5', VALID_ISSUES);
    expect(res.issueId).toBeNull();
    expect(res.page).toBe(5);
  });

  it('builds canonical book hash and shareable URL', () => {
    const hash = buildBookHash('issue1', 13);
    expect(hash).toBe('#issue=issue1&page=13');

    const url = buildShareableUrl('issue1', 13, 'https://minecraft-magazine.com/');
    expect(url).toBe('https://minecraft-magazine.com/#issue=issue1&page=13');
  });

  it('normalizes non-integer or negative page numbers', () => {
    const hash = buildBookHash('issue1', -5);
    expect(hash).toBe('#issue=issue1&page=1');

    const floatHash = buildBookHash('issue1', 3.7);
    expect(floatHash).toBe('#issue=issue1&page=3');
  });
});
