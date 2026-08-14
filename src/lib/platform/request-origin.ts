export function getRequestOrigin(request: Request) {
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

export function isSameOriginRequest(request: Request) {
  const sourceOrigin = getRequestOrigin(request);
  if (sourceOrigin == null) return false;

  return sourceOrigin === new URL(request.url).origin;
}
