import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the context-aware event finder", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Narrow — Context-aware Luma event search<\/title>/i);
  assert.match(html, /Find the event you/);
  assert.match(html, /AI in healthcare/);
  assert.match(html, /Context lock is on/);
  assert.match(html, /Hard filters first/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Starter Project/);
});

test("keeps multi-topic matching conjunctive and explainable", async () => {
  const searchEngine = await readFile(
    new URL("../lib/search-engine.ts", import.meta.url),
    "utf8",
  );
  const route = await readFile(
    new URL("../app/api/search/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(searchEngine, /concepts\.length > 1 && minimumConcept === 0/);
  assert.match(searchEngine, /conceptSpan/);
  assert.match(searchEngine, /Connects/);
  assert.match(searchEngine, /passesHardFilters/);
  assert.match(route, /application\\\/ld\\\+json/);
  assert.match(route, /__NEXT_DATA__/);
  assert.match(route, /slice\(0, 12\)/);
  assert.match(route, /cacheTtl: 900/);
});
