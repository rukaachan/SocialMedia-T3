import { z } from "zod";
import { isSameOriginRequest } from "~/lib/platform/request-origin";
import { getServerAuthSession } from "~/lib/auth/server";
import { rateLimit, RATE_LIMITS } from "~/lib/ratelimit";
import {
  createMediaService,
  MAX_ALT_TEXT_LENGTH,
  MAX_MEDIA_BYTES,
  MediaValidationError,
  MEDIA_PURPOSES,
} from "~/server/platform/media";

export const dynamic = "force-dynamic";

const uploadFieldsSchema = z.object({
  purpose: z.enum(MEDIA_PURPOSES),
  altText: z.string().trim().max(MAX_ALT_TEXT_LENGTH).optional(),
});

const MAX_MULTIPART_BODY_BYTES = MAX_MEDIA_BYTES + 64 * 1024;

function isUploadFile(value: FormDataEntryValue | null): value is File {
  return (
    value != null &&
    typeof value !== "string" &&
    typeof value.size === "number" &&
    typeof value.type === "string" &&
    typeof value.arrayBuffer === "function"
  );
}

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return jsonError("Invalid request origin.", 403);
  }

  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return jsonError("Authentication required.", 401);
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_MULTIPART_BODY_BYTES) {
    return jsonError("The image upload is too large.", 413);
  }

  const rateLimitResult = await rateLimit({
    key: `upload-media-${session.user.id}`,
    limit: RATE_LIMITS.UPLOAD_MEDIA.limit,
    window: RATE_LIMITS.UPLOAD_MEDIA.window,
  });
  if (!rateLimitResult.success) {
    return jsonError("Too many image uploads. Try again later.", 429);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("The upload form is invalid.", 400);
  }

  const fields = uploadFieldsSchema.safeParse({
    purpose: formData.get("purpose"),
    altText: formData.get("altText") ?? undefined,
  });
  if (!fields.success) {
    return jsonError("The upload fields are invalid.", 400);
  }

  const file = formData.get("file");
  if (!isUploadFile(file)) {
    return jsonError("Choose an image file.", 400);
  }

  try {
    const mediaService = await createMediaService();
    const result = await mediaService.upload({
      ownerId: session.user.id,
      purpose: fields.data.purpose,
      file,
      altText: fields.data.altText,
    });

    return Response.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof MediaValidationError) {
      return jsonError(error.message, error.status);
    }

    console.error("Media upload failed", error);
    return jsonError("The image could not be uploaded. Try again.", 503);
  }
}
