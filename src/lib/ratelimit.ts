/**
 * Simple in-memory rate limiter
 *
 * For production with multiple instances, use Redis-based rate limiting
 * (e.g., @upstash/ratelimit or rate-limiter-flexible)
 *
 * Usage:
 *   import { rateLimit } from "~/lib/ratelimit";
 *
 *   // In API route or tRPC procedure:
 *   const result = await rateLimit({
 *     key: "create-tweet-ip",
 *     limit: 5,
 *     window: 60 * 1000 // 5 requests per minute
 *   });
 *
 *   if (!result.success) {
 *     throw new TRPCError({ code: "TOO_MANY_REQUESTS" });
 *   }
 */

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateLimitEntry>();

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  /** Unique key for the rate limit (e.g., IP address, user ID) */
  key: string;
  /** Maximum number of requests allowed in the window */
  limit: number;
  /** Window duration in milliseconds */
  window: number;
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  success: boolean;
  /** Remaining requests in current window */
  remaining: number;
  /** Unix timestamp when the rate limit resets */
  resetAt: number;
}

/**
 * Simple in-memory rate limiter
 *
 * WARNING: This implementation is for single-instance deployments only.
 * In production with multiple workers/instances, use Redis-based rate limiting.
 */
export async function rateLimit(config: RateLimitConfig): Promise<RateLimitResult> {
  const { key, limit, window } = config;
  const now = Date.now();

  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    // New window
    store.set(key, {
      count: 1,
      resetAt: now + window,
    });

    return {
      success: true,
      remaining: limit - 1,
      resetAt: now + window,
    };
  }

  if (entry.count >= limit) {
    // Rate limited
    return {
      success: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  // Increment count
  entry.count++;
  store.set(key, entry);

  return {
    success: true,
    remaining: limit - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Get rate limit info without incrementing (for checking)
 */
export async function getRateLimitStatus(key: string): Promise<RateLimitResult | null> {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    return null;
  }

  return {
    success: true,
    remaining: 0,
    resetAt: entry.resetAt,
  };
}

/**
 * Clear rate limit for a key (e.g., after successful authentication)
 */
export function clearRateLimit(key: string): void {
  store.delete(key);
}

/**
 * Clean up expired entries (call periodically)
 */
export function cleanupRateLimits(): void {
  const now = Date.now();

  for (const [key, entry] of store.entries()) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}

// Predefined rate limit configs for common use cases
export const RATE_LIMITS = {
  // Auth endpoints
  SIGN_IN: { limit: 5, window: 60 * 1000 }, // 5 attempts per minute
  SIGN_UP: { limit: 3, window: 60 * 1000 }, // 3 attempts per minute
  PASSWORD_RESET: { limit: 3, window: 60 * 1000 }, // 3 attempts per minute

  // API endpoints
  CREATE_TWEET: { limit: 10, window: 60 * 1000 }, // 10 tweets per minute
  TOGGLE_LIKE: { limit: 30, window: 60 * 1000 }, // 30 likes per minute
  TOGGLE_FOLLOW: { limit: 20, window: 60 * 1000 }, // 20 follows per minute
  UNLINK_PROVIDER: { limit: 10, window: 60 * 1000 }, // 10 unlink attempts per minute

  // General
  GENERAL_API: { limit: 100, window: 60 * 1000 }, // 100 requests per minute
} as const;
