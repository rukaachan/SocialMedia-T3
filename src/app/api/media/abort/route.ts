import { z } from "zod";
import { isSameOriginRequest } from "~/lib/platform/request-origin";
import { getServerAuthSession } from "~/lib/auth/server";
import { rateLimit, RATE_LIMITS } from "~/lib/ratelimit";
import { createMediaService } from "~/server/platform/media";

export const dynamic = "force-dynamic";

const abortSchema = z.object({
  ids: z.array(z.string().min(1).max(200)).min(1).max(4),
});

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const rateLimitResult = await rateLimit({
    key: `upload-media-${session.user.id}`,
    limit: RATE_LIMITS.UPLOAD_MEDIA.limit,
    window: RATE_LIMITS.UPLOAD_MEDIA.window,
  });
  if (!rateLimitResult.success) {
    return Response.json({ error: "Too many image operations. Try again later." }, { status: 429 });
  }

  const parsed = abortSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid media cleanup request." }, { status: 400 });
  }

  try {
    const service = await createMediaService();
    for (const id of parsed.data.ids) {
      await service.abortPendingAsset({ id, ownerId: session.user.id });
    }
    return Response.json({ success: true });
  } catch (error) {
    console.error("Media cleanup failed", error);
    return Response.json({ error: "Media cleanup is unavailable." }, { status: 503 });
  }
}
