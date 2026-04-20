import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit, RATE_LIMITS } from "~/lib/ratelimit";
import { logAuthEvent } from "~/lib/auth/audit";
import { getServerAuthSession } from "~/lib/auth/server";
import { unlinkProvider } from "~/server/auth/linking";

const unlinkSchema = z.object({
  provider: z.string().min(1),
  providerAccountId: z.string().min(1),
});

function getRequestOrigin(request: NextRequest) {
  const originHeader = request.headers.get("origin");
  if (originHeader != null && originHeader.length > 0) {
    return originHeader;
  }

  const refererHeader = request.headers.get("referer");
  if (refererHeader == null || refererHeader.length === 0) {
    return null;
  }

  try {
    return new URL(refererHeader).origin;
  } catch {
    return null;
  }
}

function isSameOriginRequest(request: NextRequest) {
  const sourceOrigin = getRequestOrigin(request);
  if (sourceOrigin == null) {
    return false;
  }

  return sourceOrigin === new URL(request.url).origin;
}

export async function POST(request: NextRequest) {
  try {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
    }

    // Verify authentication
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    logAuthEvent("unlink_provider_attempt", { userId: session.user.id });

    const rateLimitResult = await rateLimit({
      key: `unlink-provider-${session.user.id}`,
      limit: RATE_LIMITS.UNLINK_PROVIDER.limit,
      window: RATE_LIMITS.UNLINK_PROVIDER.window,
    });

    if (!rateLimitResult.success) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000),
      );

      return NextResponse.json(
        {
          error: `Too many unlink attempts. Try again in ${retryAfterSeconds} seconds.`,
        },
        { status: 429 },
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const parsed = unlinkSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    // Unlink the provider
    await unlinkProvider({
      userId: session.user.id,
      provider: parsed.data.provider,
      providerAccountId: parsed.data.providerAccountId,
    });

    logAuthEvent("unlink_provider_success", {
      userId: session.user.id,
      provider: parsed.data.provider,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to unlink provider";
    logAuthEvent("unlink_provider_failure", {
      message,
    });

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
