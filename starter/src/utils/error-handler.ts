/**
 * Custom error exception tailored for review activities
 */
export class ReviewError extends Error {
  constructor(
    message: string,
    public code: string,
    public metadata?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ReviewError';
    Error.captureStackTrace(this, ReviewError);
  }
}

/**
 * Standard error codes utilized across the review workflow
 */
export const ErrorCodes = {
  // Configuration issues
  MISSING_API_KEY: 'MISSING_API_KEY',
  MISSING_GITHUB_TOKEN: 'MISSING_GITHUB_TOKEN',
  INVALID_CONFIG: 'INVALID_CONFIG',

  // GitHub operational faults
  PR_NOT_FOUND: 'PR_NOT_FOUND',
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  GITHUB_API_ERROR: 'GITHUB_API_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',

  // Subagent processing faults
  AGENT_TIMEOUT: 'AGENT_TIMEOUT',
  AGENT_FAILED: 'AGENT_FAILED',
  STRUCTURED_OUTPUT_FAILED: 'STRUCTURED_OUTPUT_FAILED',

  // Generic errors
  RETRY_EXHAUSTED: 'RETRY_EXHAUSTED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

/**
 * Retry helper mechanism leveraging exponential backoff and jitter
 *
 * Implements a robust retry pattern structure.
 *
 * Strategy:
 * 1. Attempt task execution
 * 2. Return output on success
 * 3. On failure with remaining retries:
 *    - Compute backoff interval: delayMs * 2^(attempt - 1)
 *    - Apply jitter (random 0-100ms) to avoid traffic spikes
 *    - Sleep for the computed duration
 *    - Re-attempt
 * 4. Raise ReviewError under RETRY_EXHAUSTED code if all loops fail
 *
 * @param fn Asynchronous function to attempt
 * @param maxRetries Maximum number of retries permitted (default: 3)
 * @param delayMs Base delay interval in milliseconds (default: 1000)
 * @returns Result of the successful execution
 * @throws ReviewError with RETRY_EXHAUSTED if attempts are depleted
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) {
        break;
      }

      const backoff = delayMs * Math.pow(2, attempt - 1);
      const jitter = Math.random() * 100;
      await new Promise((resolve) => setTimeout(resolve, backoff + jitter));
    }
  }

  throw new ReviewError(
    `Operation failed after ${maxRetries} attempts: ${formatError(lastError)}`,
    ErrorCodes.RETRY_EXHAUSTED,
    { attempts: maxRetries, lastError: formatError(lastError) }
  );
}

/**
 * Enforce a timeout window on an asynchronous execution
 *
 * Races the target routine against a threshold timer.
 *
 * @param fn Asynchronous function to execute
 * @param timeoutMs Maximum duration in milliseconds
 * @param errorMessage Custom message on timeout expiration
 * @returns Output of the function if finished in time
 * @throws ReviewError with AGENT_TIMEOUT code if the duration is breached
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  errorMessage: string = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new ReviewError(errorMessage, ErrorCodes.AGENT_TIMEOUT, { timeoutMs }));
      }, timeoutMs);
    }),
  ]);
}

/**
 * Type guard to determine if an error is a ReviewError instance
 */
export function isReviewError(error: unknown): error is ReviewError {
  return error instanceof ReviewError;
}

/**
 * Format errors for log outputs and presentation purposes
 */
export function formatError(error: unknown): string {
  if (isReviewError(error)) {
    return `[${error.code}] ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}