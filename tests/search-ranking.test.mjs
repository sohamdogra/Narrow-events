import assert from "node:assert/strict";
import test from "node:test";
import { passesHardFilters, rankEvent } from "../lib/search-engine.ts";

const base = {
  id: "evt-test",
  url: "https://luma.com/test",
  image: null,
  startAt: "2026-07-16T17:30:00.000-07:00",
  endAt: "2026-07-16T20:30:00.000-07:00",
  timezone: "America/Los_Angeles",
  city: "San Francisco",
  region: "CA",
  venue: "Test venue",
  organizer: "Test host",
  formatText: "discussion",
  isFree: true,
  isSoldOut: false,
  registration: "open",
};

test("ranks a genuine AI and healthcare intersection", () => {
  const result = rankEvent(
    {
      ...base,
      title: "Genomics, Diagnostics, and Data",
      description:
        "A conversation about how AI is shaping clinical diagnostics, physician workflows, and better patient outcomes.",
    },
    "AI in healthcare",
  );

  assert.ok(result);
  assert.ok(result.score >= 58);
  assert.match(result.reasons[0], /AI \+ healthcare/);
});

test("rejects an unrelated event with a healthcare sponsor footer", () => {
  const result = rankEvent(
    {
      ...base,
      title: "AI Philosophy Night",
      description:
        "A salon about philosophy, intelligence, and what it means to care about ideas.\nSponsors:\nA clinical-stage medical company working on medicine and patient care.",
    },
    "AI in healthcare",
  );

  assert.equal(result, null);
});

test("keeps biotech adjacent but distinct from healthcare", () => {
  const result = rankEvent(
    {
      ...base,
      title: "AI x Biosecurity Benchmark Launch",
      description:
        "Technical talks about frontier model evaluations for biosecurity and laboratory safety.",
    },
    "AI in healthcare",
  );

  assert.equal(result, null);
});

test("applies date, time, format, and availability as hard filters", () => {
  const event = {
    ...base,
    title: "Clinical AI Workshop",
    description: "A hands-on workshop.",
    formatText: "workshop",
  };

  assert.equal(
    passesHardFilters(event, {
      from: "2026-07-16",
      to: "2026-07-16",
      time: "evening",
      format: "workshop",
      availability: "free",
    }),
    true,
  );
  assert.equal(passesHardFilters(event, { time: "morning" }), false);
  assert.equal(passesHardFilters(event, { format: "hackathon" }), false);
});
