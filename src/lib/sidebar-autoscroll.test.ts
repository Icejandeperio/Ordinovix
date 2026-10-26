import { describe, it, expect } from 'vitest';
import { calculateAutoscrollVelocity, isElementScrollable } from './sidebar-autoscroll';

describe('Sidebar Autoscroll Engine', () => {
  const containerHeight = 600;

  it('returns idle velocity when mouse is in the neutral center deadzone', () => {
    // Center is 300px (ratio 0.5)
    const centerResult = calculateAutoscrollVelocity(300, containerHeight);
    expect(centerResult.direction).toBe('idle');
    expect(centerResult.velocity).toBe(0);
    expect(centerResult.intensity).toBe(0);

    // Deadzone is 0.35 to 0.65 (210px to 390px)
    const upperDeadzone = calculateAutoscrollVelocity(250, containerHeight);
    expect(upperDeadzone.direction).toBe('idle');
    expect(upperDeadzone.velocity).toBe(0);

    const lowerDeadzone = calculateAutoscrollVelocity(350, containerHeight);
    expect(lowerDeadzone.direction).toBe('idle');
    expect(lowerDeadzone.velocity).toBe(0);
  });

  it('calculates upward velocity when mouse moves towards the top', () => {
    // 100px from top (ratio ~0.166 < 0.35)
    const upperResult = calculateAutoscrollVelocity(100, containerHeight);
    expect(upperResult.direction).toBe('up');
    expect(upperResult.velocity).toBeLessThan(0);
    expect(upperResult.intensity).toBeGreaterThan(0);

    // Extreme top (0px)
    const topResult = calculateAutoscrollVelocity(0, containerHeight);
    expect(topResult.direction).toBe('up');
    expect(topResult.intensity).toBe(1);
    expect(topResult.velocity).toBe(-14);
  });

  it('calculates downward velocity when mouse moves towards the bottom', () => {
    // 500px from top (ratio ~0.833 > 0.65)
    const lowerResult = calculateAutoscrollVelocity(500, containerHeight);
    expect(lowerResult.direction).toBe('down');
    expect(lowerResult.velocity).toBeGreaterThan(0);
    expect(lowerResult.intensity).toBeGreaterThan(0);

    // Extreme bottom (600px)
    const bottomResult = calculateAutoscrollVelocity(600, containerHeight);
    expect(bottomResult.direction).toBe('down');
    expect(bottomResult.intensity).toBe(1);
    expect(bottomResult.velocity).toBe(14);
  });

  it('handles edge cases gracefully (zero height, invalid numbers, negative mouse)', () => {
    expect(calculateAutoscrollVelocity(100, 0).velocity).toBe(0);
    expect(calculateAutoscrollVelocity(NaN, 500).velocity).toBe(0);

    // Negative mouse position is clamped to 0
    const clampedTop = calculateAutoscrollVelocity(-50, containerHeight);
    expect(clampedTop.velocity).toBe(-14);
    expect(clampedTop.direction).toBe('up');

    // Overshot mouse position is clamped to containerHeight
    const clampedBottom = calculateAutoscrollVelocity(800, containerHeight);
    expect(clampedBottom.velocity).toBe(14);
    expect(clampedBottom.direction).toBe('down');
  });

  it('determines scrollability of DOM elements correctly', () => {
    const scrollableEl = { scrollHeight: 750, clientHeight: 600 } as HTMLElement;
    const nonScrollableEl = { scrollHeight: 600, clientHeight: 600 } as HTMLElement;

    expect(isElementScrollable(scrollableEl)).toBe(true);
    expect(isElementScrollable(nonScrollableEl)).toBe(false);
    expect(isElementScrollable(null)).toBe(false);
  });
});
