type RequestLike = {
  url: string;
  method?: string;
  headers?: {
    entries(): Iterable<[string, string]>;
  };
  arrayBuffer?(): Promise<ArrayBuffer>;
};

function isRequestLike(input: unknown): input is RequestLike {
  return (
    typeof input === "object" && input != null && "url" in input && typeof input.url === "string"
  );
}

export async function fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  // hrana-client constructs its Request with cross-fetch. Convert that
  // request to the platform Fetch API before calling workerd's fetch().
  if (init == null && isRequestLike(input)) {
    const method = input.method ?? "GET";
    const headers = input.headers == null ? undefined : Object.fromEntries(input.headers.entries());

    return globalThis.fetch(input.url, {
      method,
      headers,
      ...(method !== "GET" && method !== "HEAD" && input.arrayBuffer != null
        ? { body: await input.arrayBuffer() }
        : {}),
    });
  }

  return globalThis.fetch(input, init);
}

export const Headers = globalThis.Headers;
export const Request = globalThis.Request;
export const Response = globalThis.Response;

export default fetch;
