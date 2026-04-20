import { and, eq } from "drizzle-orm";
import { db, schemaReady } from "~/db";
import { userFollower } from "~/db/schema";

export type JsonObject = Record<string, unknown>;

export function nowIso() {
  return new Date().toISOString();
}

export function getId(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : crypto.randomUUID();
}

export function toStoredDate(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return typeof value === "string" ? value : null;
}

export function withStoredDate<T extends JsonObject>(data: T, key: keyof T, fallback?: string) {
  const storedDate = toStoredDate(data[key]);

  return {
    ...data,
    [key]: storedDate ?? fallback ?? nowIso(),
  };
}

export function combineWhere(conditions: Array<any | undefined>) {
  const filters = conditions.filter((condition): condition is any => condition != null);

  if (filters.length === 0) return undefined;
  if (filters.length === 1) return filters[0];

  return and(...filters);
}

export function omitUndefined<T extends JsonObject>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}

export async function clearFollowersForUser(userId: string) {
  await schemaReady;
  await db.delete(userFollower).where(eq(userFollower.followingId, userId));
}

export async function clearFollowsForUser(userId: string) {
  await schemaReady;
  await db.delete(userFollower).where(eq(userFollower.followerId, userId));
}
