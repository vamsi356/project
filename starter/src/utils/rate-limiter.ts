/**
 * Rate Limiter for API calls and token management
 * Controls request volumes to stay within API rate limits
 *
 * Implements a token bucket structure combined with a sliding window.
 *
 * Core principles:
 * - Monitors requests and tokens consumed over the preceding 60 seconds (sliding window)
 * - Restricts parallel requests to avoid system saturation
 * - Applies token estimation strategies to guard against per-minute thresholds
 */

export interface RateLimiterConfig {
  /** Upper limit of requests per minute */
  maxRequestsPerMinute: number;
  /** Upper limit of tokens per minute */
  maxTokensPerMinute: number;
  /** Maximum allowable parallel requests */
  maxConcurrent: number;
}

export const DEFAULT_RATE_LIMITS: RateLimiterConfig = {
  maxRequestsPerMinute: 50,       // Conservative baseline
  maxTokensPerMinute: 100000,     // Roughly 100k tokens/min
  maxConcurrent: 5                // Parallel request limit
};

interface RequestRecord {
  timestamp: number;
  tokens: number;
}

/**
 * Token bucket implementation featuring a sliding window
 */
export class RateLimiter {
  private config: RateLimiterConfig;
  private requestHistory: RequestRecord[] = [];
  private activeRequests: number = 0;
  private waitQueue: Array<() => void> = [];

  constructor(config: Partial<RateLimiterConfig> = {}) {
    this.config = { ...DEFAULT_RATE_LIMITS, ...config };
  }

  /**
   * Pause execution until the request fits inside established limits
   *
   * Primary entry point for rate control.
   * Guarantees that:
   * 1. Concurrency limits remain unbroken
   * 2. Request and token parameters are respected
   * 3. The transaction is logged for future calculations
   *
   * @param estimatedTokens Projected token consumption for this operation
   */
  async acquire(estimatedTokens: number = 1000): Promise<void> {
    await this.waitForSlot();
    await this.waitForRateLimit(estimatedTokens);

    this.activeRequests += 1;
    this.requestHistory.push({ timestamp: Date.now(), tokens: estimatedTokens });
  }

  /**
   * Release a concurrent execution slot upon finishing
   * @param actualTokens Real token count utilized (refines estimate)
   */
  release(actualTokens?: number): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);

    // Update prior request entry with true token count if supplied
    if (actualTokens !== undefined && this.requestHistory.length > 0) {
      const lastRequest = this.requestHistory[this.requestHistory.length - 1];
      if (lastRequest) {
        lastRequest.tokens = actualTokens;
      }
    }

    // Trigger the next queued request in line
    const next = this.waitQueue.shift();
    if (next) next();
  }

  /**
   * Retrieve current rate limit metrics
   */
  getStatus(): {
    activeRequests: number;
    requestsInWindow: number;
    tokensInWindow: number;
    availableRequests: number;
    availableTokens: number;
  } {
    this.pruneOldRecords();

    const requestsInWindow = this.requestHistory.length;
    const tokensInWindow = this.requestHistory.reduce((sum, r) => sum + r.tokens, 0);

    return {
      activeRequests: this.activeRequests,
      requestsInWindow,
      tokensInWindow,
      availableRequests: Math.max(0, this.config.maxRequestsPerMinute - requestsInWindow),
      availableTokens: Math.max(0, this.config.maxTokensPerMinute - tokensInWindow)
    };
  }

  /**
   * Evaluate whether an operation can run right away
   *
   * @param estimatedTokens Projected tokens for the action
   * @returns true if execution can start instantly without delay
   */
  canProceed(estimatedTokens: number = 1000): boolean {
    this.pruneOldRecords();

    if (this.activeRequests >= this.config.maxConcurrent) {
      return false;
    }

    const requestsInWindow = this.requestHistory.length;
    if (requestsInWindow >= this.config.maxRequestsPerMinute) {
      return false;
    }

    const tokensInWindow = this.requestHistory.reduce((sum, r) => sum + r.tokens, 0);
    if (tokensInWindow + estimatedTokens > this.config.maxTokensPerMinute) {
      return false;
    }

    return true;
  }

  /**
   * Block until an open concurrency slot becomes available
   *
   * Generates a Promise resolving once release() fires
   * and a queued task is waiting.
   */
  private async waitForSlot(): Promise<void> {
    if (this.activeRequests < this.config.maxConcurrent) {
      return;
    }
    return new Promise<void>((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  /**
   * Pause execution until rate thresholds clear the operation
   *
   * Utilizes a sliding window approach.
   * If immediate execution fails, compute the delay duration
   * until the earliest request expires from the 60-second span.
   *
   * @param estimatedTokens Projected token volume for the call
   */
  private async waitForRateLimit(estimatedTokens: number): Promise<void> {
    while (!this.canProceed(estimatedTokens)) {
      this.pruneOldRecords();

      const oldest = this.requestHistory[0];
      if (!oldest) {
        break;
      }

      const expiresAt = oldest.timestamp + 60000;
      const waitTime = Math.min(Math.max(100, expiresAt - Date.now() + 100), 5000);

      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  /**
   * Purge request logs older than 60 seconds (sliding window mechanism)
   *
   * Executed prior to checks to guarantee only active
   * entries within the 60-second window are computed.
   */
  private pruneOldRecords(): void {
    const cutoff = Date.now() - 60000;
    this.requestHistory = this.requestHistory.filter((r) => r.timestamp > cutoff);
  }
}

/**
 * Decorate an asynchronous routine with rate limiting controls
 *
 * Utility wrapper to enforce rate constraints on any arbitrary async task.
 */
export function withRateLimit<T>(
  rateLimiter: RateLimiter,
  fn: () => Promise<T>,
  estimatedTokens: number = 1000
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    try {
      await rateLimiter.acquire(estimatedTokens);
      const result = await fn();
      rateLimiter.release();
      resolve(result);
    } catch (error) {
      rateLimiter.release();
      reject(error);
    }
  });
}

// Default application-wide rate limiter instance
export const globalRateLimiter = new RateLimiter();