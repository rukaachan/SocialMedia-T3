// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import { fetch as platformFetch } from "~/server/platform/global-fetch";

describe("platform fetch adapter", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("converts a request-shaped Hrana request to the platform Fetch API", async () => {
    const upstream = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", upstream);

    const request = new Request("https://db.example/v2/pipeline", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requests: [] }),
    });

    await platformFetch(request);

    expect(upstream).toHaveBeenCalledWith(
      "https://db.example/v2/pipeline",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: expect.any(ArrayBuffer),
      }),
    );
  });
});
