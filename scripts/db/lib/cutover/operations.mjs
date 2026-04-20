// @ts-nocheck

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_AUTH_PATH, DEFAULT_PARITY_PATH } from "./constants.mjs";
import { insertRows } from "./helpers.mjs";
import { buildAuthIntegrityReport, buildParityReport } from "./reports.mjs";
import { ensureTursoSchema, clearTursoData } from "./schema.mjs";
import { loadSourceSnapshot, loadTargetSnapshot, mapSourceRows } from "./snapshot.mjs";

export async function migrateSourceToTurso({ prisma, client }) {
  const source = await loadSourceSnapshot(prisma);
  const mappedRows = mapSourceRows(source.rows);

  await ensureTursoSchema(client);
  await clearTursoData(client);

  await insertRows(client, "user", mappedRows.user);
  await insertRows(client, "account", mappedRows.account);
  await insertRows(client, "session", mappedRows.session);
  await insertRows(client, "verificationToken", mappedRows.verificationToken);
  await insertRows(client, "tweet", mappedRows.tweet);
  await insertRows(client, "like", mappedRows.like);
  await insertRows(client, "userFollower", mappedRows.userFollower);

  const target = await loadTargetSnapshot(client);
  return { source, target };
}

export async function writeEvidenceFiles({ parityReport, authReport }) {
  await mkdir(path.dirname(DEFAULT_PARITY_PATH), { recursive: true });
  await Promise.all([
    writeFile(DEFAULT_PARITY_PATH, parityReport.markdown, "utf8"),
    writeFile(DEFAULT_AUTH_PATH, authReport.markdown, "utf8"),
  ]);
}

export async function verifyCutover({
  prisma,
  client,
  sourceLabel = "mysql",
  targetLabel = "turso",
}) {
  const source = await loadSourceSnapshot(prisma);
  const target = await loadTargetSnapshot(client);
  const generatedAt = new Date().toISOString();

  const parityReport = buildParityReport({
    source: {
      counts: source.counts,
      invariants: source.invariants,
    },
    target: {
      counts: target.counts,
      invariants: target.invariants,
    },
    generatedAt,
    sourceLabel,
    targetLabel,
  });

  const authReport = buildAuthIntegrityReport({
    counts: {
      users: target.counts.users,
      accounts: target.counts.accounts,
      sessions: target.counts.sessions,
      verificationTokens: target.counts.verificationTokens,
      credentials: target.counts.credentials,
      passwordResetTokens: target.counts.passwordResetTokens,
    },
    invariants: target.authInvariants,
    generatedAt,
    sourceLabel: targetLabel,
  });

  await writeEvidenceFiles({ parityReport, authReport });
  return { authReport, parityReport, source, target };
}
