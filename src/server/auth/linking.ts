import { and, eq, isNotNull } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/libsql";
import { db } from "~/db";
import { account, type betterAuthSchema, user } from "~/db/better-auth-schema";

type BetterAuthDatabase = ReturnType<typeof drizzle<typeof betterAuthSchema>>;

export type LinkedProvider = {
  id: string;
  provider: string;
  providerAccountId: string;
  type: string;
  userId: string;
};

export type LinkProviderInput = {
  userId: string;
  provider: string;
  providerAccountId: string;
  type: string;
};

export type UnlinkProviderInput = {
  userId: string;
  provider: string;
  providerAccountId: string;
};

export type ConflictDetectionInput = {
  email: string;
  provider: string;
  providerAccountId: string;
};

export type ConflictResult =
  | {
      hasConflict: false;
    }
  | {
      hasConflict: true;
      existingUserId: string;
      existingEmail: string;
      message: string;
    };

type LinkingServiceOptions = {
  createId?: () => string;
  database?: BetterAuthDatabase;
};

function getDatabase(database?: BetterAuthDatabase) {
  return database ?? (db as unknown as BetterAuthDatabase);
}

function getId(createId?: () => string) {
  return createId?.() ?? crypto.randomUUID();
}

function toLinkedProvider(
  linkedAccount: typeof account.$inferSelect
): LinkedProvider {
  return {
    id: linkedAccount.id,
    provider: linkedAccount.providerId,
    providerAccountId: linkedAccount.accountId,
    type: linkedAccount.providerId === "credential" ? "credentials" : "oauth",
    userId: linkedAccount.userId,
  };
}

async function getAllAccountsForUser(
  userId: string,
  database: BetterAuthDatabase
) {
  return database.select().from(account).where(eq(account.userId, userId));
}

async function hasCredentialAccount(
  userId: string,
  database: BetterAuthDatabase
) {
  const credentialAccount = await database
    .select({ id: account.id })
    .from(account)
    .where(
      and(
        eq(account.userId, userId),
        eq(account.providerId, "credential"),
        isNotNull(account.password)
      )
    )
    .limit(1);

  return credentialAccount.length > 0;
}

export async function getLinkedProviders(
  userId: string,
  options: LinkingServiceOptions = {}
): Promise<LinkedProvider[]> {
  const database = getDatabase(options.database);
  const accounts = await getAllAccountsForUser(userId, database);

  return accounts
    .filter((linkedAccount) => linkedAccount.providerId !== "credential")
    .map(toLinkedProvider);
}

export async function linkProvider(
  input: LinkProviderInput,
  options: LinkingServiceOptions = {}
): Promise<LinkedProvider> {
  const database = getDatabase(options.database);
  const id = getId(options.createId);
  const existingAccount = await database
    .select()
    .from(account)
    .where(
      and(
        eq(account.providerId, input.provider),
        eq(account.accountId, input.providerAccountId)
      )
    )
    .limit(1);

  const existing = existingAccount[0];

  if (existing != null) {
    if (existing.userId === input.userId) {
      throw new Error(
        `Provider "${input.provider}" is already linked to your account.`
      );
    }

    throw new Error(
      `This ${input.provider} account is already linked to another account.`
    );
  }

  const now = new Date();

  await database.insert(account).values({
    id,
    accountId: input.providerAccountId,
    createdAt: now,
    providerId: input.provider,
    updatedAt: now,
    userId: input.userId,
  });

  return {
    id,
    provider: input.provider,
    providerAccountId: input.providerAccountId,
    type: input.type,
    userId: input.userId,
  };
}

export async function unlinkProvider(
  input: UnlinkProviderInput,
  options: LinkingServiceOptions = {}
): Promise<void> {
  const database = getDatabase(options.database);
  const existingAccount = await database
    .select()
    .from(account)
    .where(
      and(
        eq(account.userId, input.userId),
        eq(account.providerId, input.provider),
        eq(account.accountId, input.providerAccountId)
      )
    )
    .limit(1);

  const linkedAccount = existingAccount[0];

  if (linkedAccount == null) {
    throw new Error(
      `Provider "${input.provider}" is not linked to your account.`
    );
  }

  const allAccounts = await getAllAccountsForUser(input.userId, database);

  if (allAccounts.length <= 1) {
    throw new Error(
      "Cannot remove your last authentication method. Link another provider or set a password first."
    );
  }

  await database.delete(account).where(eq(account.id, linkedAccount.id));
}

export async function detectProviderConflict(
  input: ConflictDetectionInput,
  options: LinkingServiceOptions = {}
): Promise<ConflictResult> {
  const database = getDatabase(options.database);
  const normalizedEmail = input.email.trim().toLowerCase();
  const existingUser = await database
    .select()
    .from(user)
    .where(eq(user.email, normalizedEmail))
    .limit(1);

  const matchedUser = existingUser[0];

  if (matchedUser == null) {
    return { hasConflict: false };
  }

  const existingAccount = await database
    .select()
    .from(account)
    .where(
      and(
        eq(account.userId, matchedUser.id),
        eq(account.providerId, input.provider),
        eq(account.accountId, input.providerAccountId)
      )
    )
    .limit(1);

  if (existingAccount[0] != null) {
    return { hasConflict: false };
  }

  const message = (await hasCredentialAccount(matchedUser.id, database))
    ? `An account with email ${normalizedEmail} already exists. Sign in with your password, then link ${input.provider} from account settings.`
    : `An account with email ${normalizedEmail} already exists with a different sign-in method. Sign in to your existing account, then link ${input.provider} from account settings.`;

  return {
    hasConflict: true,
    existingEmail: matchedUser.email,
    existingUserId: matchedUser.id,
    message,
  };
}
