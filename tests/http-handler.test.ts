import { describe, test, expect } from "vitest";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";

// Tests the HTTP handler wiring as it exists on main: no authentication is
// performed — any request is forwarded directly to the CLI router.
//
// TODO(#16): Once the auth PR lands, add tests that assert:
//   - requests without a valid token receive 401
//   - requests with a valid token are forwarded as normal

async function makeHandler(cli: { fetch: (req: Request) => Promise<Response> }) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    // Mirrors the handler in src/index.ts exactly
    const port = 3000;
    const url = new URL(req.url ?? "/", `http://localhost:${port}`);
    const request = new Request(url.toString(), {
      method: req.method,
      headers: req.headers as HeadersInit,
    });
    const response = await cli.fetch(request);
    res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
    res.end(await response.text());
  };
}

async function startServer(handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>): Promise<{ port: number; close: () => Promise<void> }> {
  return new Promise((resolve, reject) => {
    const server = createServer(handler);
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("unexpected address"));
        return;
      }
      resolve({
        port: addr.port,
        close: () => new Promise<void>((res, rej) => server.close((err) => (err ? rej(err) : res()))),
      });
    });
  });
}

describe("HTTP handler (current behavior: no auth)", () => {
  test("forwards a request to the CLI router and returns its response", async () => {
    // #given
    const stubResponse = new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
    const mockCli = { fetch: async (_req: Request) => stubResponse.clone() };
    const handler = await makeHandler(mockCli);
    const { port, close } = await startServer(handler);

    // #when
    const res = await fetch(`http://127.0.0.1:${port}/some-command`);
    const body = await res.json();

    // #then
    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });

    await close();
  });

  test("passes the request path through to the CLI router unchanged", async () => {
    // #given
    let capturedUrl: string | undefined;
    const mockCli = {
      fetch: async (req: Request) => {
        capturedUrl = new URL(req.url).pathname;
        return new Response("ok", { status: 200 });
      },
    };
    const handler = await makeHandler(mockCli);
    const { port, close } = await startServer(handler);

    // #when
    await fetch(`http://127.0.0.1:${port}/open`);

    // #then
    expect(capturedUrl).toBe("/open");

    await close();
  });

  test("propagates the CLI router status code back to the HTTP response", async () => {
    // #given
    const mockCli = {
      fetch: async (_req: Request) => new Response("not found", { status: 404 }),
    };
    const handler = await makeHandler(mockCli);
    const { port, close } = await startServer(handler);

    // #when
    const res = await fetch(`http://127.0.0.1:${port}/nonexistent`);

    // #then
    expect(res.status).toBe(404);

    await close();
  });
});
