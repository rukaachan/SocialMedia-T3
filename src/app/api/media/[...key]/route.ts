import { and, eq, isNull } from "drizzle-orm";
import { db, schemaReady } from "~/db";
import { mediaAsset } from "~/db/schema";
import { resolveMediaBucket } from "~/server/platform/media";

export const dynamic = "force-dynamic";

function isSafeObjectKey(key: string) {
  return (
    key.length > 0 &&
    key.length <= 512 &&
    !key.includes("..") &&
    !key.startsWith("/") &&
    /^[a-zA-Z0-9/_.-]+$/.test(key)
  );
}

export async function GET(request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const objectKey = key.join("/");

  if (!isSafeObjectKey(objectKey)) {
    return new Response("Not found", { status: 404 });
  }

  await schemaReady;
  const asset = await db.query.mediaAsset.findFirst({
    where: and(
      eq(mediaAsset.objectKey, objectKey),
      eq(mediaAsset.status, "attached"),
      isNull(mediaAsset.deletedAt),
    ),
  });
  if (asset == null) {
    return new Response("Not found", { status: 404 });
  }

  let bucket: Awaited<ReturnType<typeof resolveMediaBucket>>;
  try {
    bucket = await resolveMediaBucket();
  } catch {
    return Response.json({ error: "Media storage is unavailable." }, { status: 503 });
  }

  if (bucket == null) {
    return Response.json({ error: "Media storage is not configured." }, { status: 503 });
  }

  let object: Awaited<ReturnType<typeof bucket.get>>;
  try {
    object = await bucket.get(objectKey);
  } catch {
    return Response.json({ error: "Media storage is unavailable." }, { status: 503 });
  }
  if (object == null) {
    return new Response("Not found", { status: 404 });
  }

  const etag = object.httpEtag;
  if (etag != null && request.headers.get("if-none-match") === etag) {
    return new Response(null, {
      status: 304,
      headers: { ETag: etag },
    });
  }

  const headers = new Headers();
  headers.set("Content-Type", object.httpMetadata?.contentType ?? "application/octet-stream");
  headers.set("Content-Length", String(object.size));
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("Content-Disposition", "inline");
  headers.set("X-Content-Type-Options", "nosniff");
  if (etag != null) headers.set("ETag", etag);

  return new Response(object.body, { headers });
}
