// ─── Semaphore — Concurrency Limiter ──────────────────────────────────────────
// Limits concurrent async operations to prevent resource exhaustion.
// Used by: PDF generation (max 3 Chromium instances), API calls.

export class Semaphore {
  private permits: number;
  private queue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    const next = this.queue.shift();
    if (next) {
      next(); // Wake up next waiter
    } else {
      this.permits++;
    }
  }

  get available(): number {
    return this.permits;
  }

  get waiting(): number {
    return this.queue.length;
  }
}

/**
 * Run an async function with semaphore protection.
 * Automatically acquires before and releases after (even on error).
 */
export async function withSemaphore<T>(
  semaphore: Semaphore,
  fn: () => Promise<T>
): Promise<T> {
  await semaphore.acquire();
  try {
    return await fn();
  } finally {
    semaphore.release();
  }
}

// Global PDF generation semaphore — max 3 concurrent Chromium instances
export const pdfSemaphore = new Semaphore(3);
