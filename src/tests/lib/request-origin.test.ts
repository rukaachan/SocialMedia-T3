// @vitest-environment node

import { describe, expect, it } from "vitest";
import { getRequestOrigin, isSameOriginRequest } from "~/lib/platform/request-origin";

describe("request origin helpers", () => {
  it("accepts an Origin header matching the request URL", () => {
    const request = new Request("https://tweeva.example/api/media/upload", {
      headers: { origin: "https://tweeva.example" },
    });
    expect(getRequestOrigin(request)).toBe("https://tweeva.example");
    expect(isSameOriginRequest(request)).toBe(true);
  });

  it("uses Referer as a fallback and rejects missing or cross-site origins", () => {
    const refererRequest = new Request("https://tweeva.example/api/media/upload", {
      headers: { referer: "https://tweeva.example/settings" },
    });
    const crossSiteRequest = new Request("https://tweeva.example/api/media/upload", {
      headers: { origin: "https://attacker.example" },
    });
    const missingRequest = new Request("https://tweeva.example/api/media/upload");

    expect(isSameOriginRequest(refererRequest)).toBe(true);
    expect(isSameOriginRequest(crossSiteRequest)).toBe(false);
    expect(isSameOriginRequest(missingRequest)).toBe(false);
  });
});
