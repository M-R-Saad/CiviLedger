import { describe, expect, it } from 'vitest';
import { dhakaDayStart } from './jobs.js';

/**
 * The day boundary decides which receipts land in which anchored root. Getting
 * it wrong by an hour would split a day across two Merkle trees, and the
 * inclusion proof handed to an oversight body would be for the wrong period.
 */
describe('dhakaDayStart', () => {
  const DHAKA_OFFSET = 6 * 3600;

  /** Unix seconds for a wall-clock time in Asia/Dhaka. */
  const dhaka = (iso: string): number => Date.parse(`${iso}Z`) / 1000 - DHAKA_OFFSET;

  it('returns midnight Dhaka for a time during that day', () => {
    const start = dhakaDayStart(dhaka('2027-03-14T14:35:00'));
    expect(start).toBe(dhaka('2027-03-14T00:00:00'));
  });

  it('is stable across the whole day', () => {
    const expected = dhaka('2027-03-14T00:00:00');
    for (const time of ['00:00:00', '00:00:01', '06:00:00', '12:00:00', '23:59:59']) {
      expect(dhakaDayStart(dhaka(`2027-03-14T${time}`))).toBe(expected);
    }
  });

  it('rolls over at local midnight, not at UTC midnight', () => {
    // 18:00 UTC is already the next day in Dhaka. A naive UTC boundary would
    // put these two instants in the same period; they belong to different days.
    const lateEvening = dhaka('2027-03-14T23:59:59');
    const justAfterMidnight = dhaka('2027-03-15T00:00:01');

    expect(dhakaDayStart(lateEvening)).toBe(dhaka('2027-03-14T00:00:00'));
    expect(dhakaDayStart(justAfterMidnight)).toBe(dhaka('2027-03-15T00:00:00'));
    expect(dhakaDayStart(justAfterMidnight) - dhakaDayStart(lateEvening)).toBe(86_400);
  });

  it('gives consecutive days exactly 24 hours apart', () => {
    // Asia/Dhaka has no daylight saving, so this holds all year. A zone that
    // did would need a real calendar here rather than arithmetic.
    let previous = dhakaDayStart(dhaka('2027-01-01T09:00:00'));
    for (let day = 1; day < 365; day += 1) {
      const next = dhakaDayStart(dhaka('2027-01-01T09:00:00') + day * 86_400);
      expect(next - previous).toBe(86_400);
      previous = next;
    }
  });

  it('lands on a midnight boundary in UTC terms', () => {
    const start = dhakaDayStart(dhaka('2027-07-04T17:22:33'));
    expect((start + DHAKA_OFFSET) % 86_400).toBe(0);
  });
});
