export interface AutoscrollOptions {
  deadZoneRatio?: number; // Proportion in center where velocity is 0 (default: 0.30)
  maxSpeed?: number; // Max pixels scrolled per frame (default: 14)
}

export interface AutoscrollResult {
  velocity: number; // Negative = scroll up, positive = scroll down, 0 = idle
  direction: 'up' | 'down' | 'idle';
  intensity: number; // 0 to 1
}

/**
 * Calculates smooth autoscroll velocity based on vertical mouse position relative to container height.
 * Emulates the locked autoscroll functionality of middle mouse wheel click.
 */
export function calculateAutoscrollVelocity(
  mouseY: number,
  containerHeight: number,
  options: AutoscrollOptions = {}
): AutoscrollResult {
  if (containerHeight <= 0 || !Number.isFinite(mouseY)) {
    return { velocity: 0, direction: 'idle', intensity: 0 };
  }

  const deadZoneRatio = options.deadZoneRatio ?? 0.30;
  const maxSpeed = options.maxSpeed ?? 14;

  const clampedY = Math.max(0, Math.min(containerHeight, mouseY));
  const ratio = clampedY / containerHeight; // 0.0 at top to 1.0 at bottom

  const deadZoneStart = (1 - deadZoneRatio) / 2; // e.g. (1 - 0.30)/2 = 0.35
  const deadZoneEnd = 1 - deadZoneStart; // e.g. 0.65

  // Neutral middle band (idle)
  if (ratio >= deadZoneStart && ratio <= deadZoneEnd) {
    return { velocity: 0, direction: 'idle', intensity: 0 };
  }

  // Upper band (scroll up)
  if (ratio < deadZoneStart) {
    const rawIntensity = (deadZoneStart - ratio) / deadZoneStart;
    const intensity = Math.max(0, Math.min(1, rawIntensity));
    // Non-linear acceleration curve for fine control near center and swift speed at edges
    const velocity = -1 * (intensity * intensity * (maxSpeed - 2) + intensity * 2);
    return {
      velocity,
      direction: 'up',
      intensity,
    };
  }

  // Lower band (scroll down)
  const rawIntensity = (ratio - deadZoneEnd) / (1 - deadZoneEnd);
  const intensity = Math.max(0, Math.min(1, rawIntensity));
  const velocity = intensity * intensity * (maxSpeed - 2) + intensity * 2;
  return {
    velocity,
    direction: 'down',
    intensity,
  };
}

/**
 * Checks if an element has scrollable overflow.
 */
export function isElementScrollable(element: HTMLElement | null): boolean {
  if (!element) return false;
  return element.scrollHeight > element.clientHeight + 2;
}
