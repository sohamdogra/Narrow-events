import { NextRequest, NextResponse } from "next/server";
import {
  passesHardFilters,
  preScore,
  rankEvent,
  type SearchEvent,
  type TimeWindow,
} from "../../../lib/search-engine";

export const runtime = "edge";

const DETAIL_CACHE = new Map<string, { expiresAt: number; data: any }>();
const PAGE_CACHE = new Map<string, { expiresAt: number; html: string }>();

const CITY_SLUGS: Record<string, string> = {
  "san francisco": "sf",
  "new york": "nyc",
  "new york city": "nyc",
  "los angeles": "la",
  "washington dc": "dc",
  "washington d c": "dc",
  "salt lake city": "salt-lake-city",
  "mexico city": "mexico-city",
  montreal: "montreal",
};

function citySlug(city: string) {
  const normalized = city
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return CITY_SLUGS[normalized] ?? normalized.replace(/\s+/g, "-");
}

function extractNextData(html: string) {
  const match = html.match(
    /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
  );
  if (!match) throw new Error("Luma discovery data was not found.");
  return JSON.parse(match[1]);
}

function extractStructuredEvent(html: string) {
  const scripts = [...html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )];
  for (const script of scripts) {
    try {
      const value = JSON.parse(script[1]);
      const candidates = Array.isArray(value) ? value : [value];
      const event = candidates.find((item) => item?.["@type"] === "Event");
      if (event) return event;
    } catch {
      // Ignore unrelated malformed structured-data blocks.
    }
  }
  return null;
}

function fromDiscovery(item: any): SearchEvent {
  const event = item.event ?? item;
  const city = event.geo_address_info?.city ?? item.featured_city?.name ?? "";
  return {
    id: event.api_id ?? event.url,
    title: event.name ?? "Untitled event",
    description: item.calendar?.description_short ?? "",
    url: `https://luma.com/${event.url}`,
    image: event.cover_url ?? event.social_image_url ?? null,
    startAt: event.start_at,
    endAt: event.end_at ?? null,
    timezone: event.timezone ?? "UTC",
    city,
    region: event.geo_address_info?.region_short ?? "",
    venue:
      event.geo_address_info?.sublocality ??
      event.geo_address_info?.city_state ??
      city,
    organizer:
      item.calendar?.name ?? item.hosts?.map((host: any) => host.name).join(", ") ?? "",
    formatText: event.event_type ?? "",
    isFree:
      typeof item.ticket_info?.is_free === "boolean"
        ? item.ticket_info.is_free
        : null,
    isSoldOut:
      Boolean(item.ticket_info?.is_sold_out) ||
      item.registration_availability === "waitlist",
    registration: item.registration_availability ?? "unknown",
  };
}

function mergeStructured(base: SearchEvent, data: any): SearchEvent {
  const location = data?.location;
  const address = location?.address;
  const organizers = Array.isArray(data?.organizer)
    ? data.organizer
    : data?.organizer
      ? [data.organizer]
      : [];
  const offers = Array.isArray(data?.offers)
    ? data.offers
    : data?.offers
      ? [data.offers]
      : [];
  const prices = offers
    .map((offer: any) => Number(offer?.price))
    .filter((price: number) => Number.isFinite(price));
  const images = Array.isArray(data?.image) ? data.image : [data?.image];

  return {
    ...base,
    title: data?.name ?? base.title,
    description: data?.description ?? base.description,
    image: images.find(Boolean) ?? base.image,
    startAt: data?.startDate ?? base.startAt,
    endAt: data?.endDate ?? base.endAt,
    city: address?.addressLocality ?? base.city,
    region: address?.addressRegion ?? base.region,
    venue: location?.name ?? address?.streetAddress ?? base.venue,
    organizer:
      organizers.map((organizer: any) => organizer?.name).filter(Boolean).join(", ") ||
      base.organizer,
    isFree: prices.length ? prices.every((price: number) => price === 0) : base.isFree,
    formatText: `${base.formatText} ${data?.description ?? ""}`,
  };
}

async function fetchPublicPage(url: string) {
  const cached = PAGE_CACHE.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.html;

  const response = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "Mozilla/5.0 (compatible; NarrowEventSearch/1.0)",
    },
    cf: { cacheTtl: 900, cacheEverything: true },
  } as RequestInit);
  if (!response.ok) {
    if (cached) return cached.html;
    if (response.status === 429) {
      throw new Error("Luma is briefly rate-limiting public searches. Try again in a minute.");
    }
    throw new Error(`Luma returned ${response.status}.`);
  }
  const html = await response.text();
  if (PAGE_CACHE.size >= 250) {
    const oldestKey = PAGE_CACHE.keys().next().value;
    if (oldestKey) PAGE_CACHE.delete(oldestKey);
  }
  PAGE_CACHE.set(url, { html, expiresAt: Date.now() + 15 * 60 * 1000 });
  return html;
}

async function enrich(events: SearchEvent[]) {
  const output: SearchEvent[] = [];
  for (let index = 0; index < events.length; index += 6) {
    const batch = events.slice(index, index + 6);
    const results = await Promise.all(
      batch.map(async (event) => {
        try {
          const cached = DETAIL_CACHE.get(event.url);
          if (cached && cached.expiresAt > Date.now()) {
            return mergeStructured(event, cached.data);
          }
          const html = await fetchPublicPage(event.url);
          const structured = extractStructuredEvent(html);
          if (!structured) return event;
          if (DETAIL_CACHE.size >= 200) {
            const oldestKey = DETAIL_CACHE.keys().next().value;
            if (oldestKey) DETAIL_CACHE.delete(oldestKey);
          }
          DETAIL_CACHE.set(event.url, {
            data: structured,
            expiresAt: Date.now() + 15 * 60 * 1000,
          });
          return mergeStructured(event, structured);
        } catch {
          return event;
        }
      }),
    );
    output.push(...results);
  }
  return output;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const query = params.get("query")?.trim() ?? "";
  const city = params.get("city")?.trim() ?? "";
  if (query.length < 2 || city.length < 2) {
    return NextResponse.json(
      { error: "Add both a topic and a city." },
      { status: 400 },
    );
  }

  try {
    const slug = citySlug(city);
    const sourceUrl = `https://luma.com/${encodeURIComponent(slug)}`;
    const html = await fetchPublicPage(sourceUrl);
    const data = extractNextData(html);
    const rawEvents = data?.props?.pageProps?.initialData?.data?.events;
    if (!Array.isArray(rawEvents)) {
      throw new Error(`Luma does not have a discoverable city page for “${city}”.`);
    }

    const baseEvents = rawEvents
      .map(fromDiscovery)
      .filter((event: SearchEvent) => event.startAt && event.url);
    const filters = {
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined,
      time: (params.get("time") ?? "any") as TimeWindow,
      format: params.get("format") ?? "any",
      availability: params.get("availability") ?? "any",
    };
    const filtered = baseEvents.filter((event: SearchEvent) =>
      passesHardFilters(event, filters),
    );

    const candidates = filtered
      .map((event: SearchEvent) => ({ event, score: preScore(event, query) }))
      .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
      .slice(0, 12)
      .map((candidate: { event: SearchEvent }) => candidate.event);
    const detailed = await enrich(candidates);
    const results = detailed
      .filter((event) => passesHardFilters(event, filters))
      .map((event) => rankEvent(event, query))
      .filter(Boolean)
      .sort((a, b) => (b?.score ?? 0) - (a?.score ?? 0))
      .slice(0, 12);

    return NextResponse.json(
      {
        results,
        meta: {
          city: data?.props?.pageProps?.initialData?.data?.place?.name ?? city,
          scanned: baseEvents.length,
          afterFilters: filtered.length,
          analyzed: detailed.length,
          sourceUrl,
        },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
        },
      },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "The Luma search could not be completed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
