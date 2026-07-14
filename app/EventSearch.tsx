"use client";

import { FormEvent, useMemo, useState } from "react";

type Result = {
  id: string;
  title: string;
  description: string;
  url: string;
  image: string | null;
  startAt: string;
  endAt: string | null;
  timezone: string;
  city: string;
  region: string;
  venue: string;
  organizer: string;
  isFree: boolean | null;
  isSoldOut: boolean;
  registration: string;
  score: number;
  matchLabel: string;
  reasons: string[];
};

type SearchResponse = {
  results: Result[];
  meta: {
    city: string;
    scanned: number;
    afterFilters: number;
    analyzed: number;
    sourceUrl: string;
  };
};

const CITY_OPTIONS = [
  "San Francisco",
  "New York",
  "Los Angeles",
  "Austin",
  "Boston",
  "Chicago",
  "Denver",
  "London",
  "Miami",
  "Seattle",
  "Toronto",
  "Vancouver",
  "Washington DC",
];

const EXAMPLES = ["AI in healthcare", "climate founders", "design workshops"];

function formatDate(result: Result) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: result.timezone || undefined,
    timeZoneName: "short",
  }).format(new Date(result.startAt));
}

function excerpt(value: string) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > 210 ? `${clean.slice(0, 207)}…` : clean;
}

export function EventSearch() {
  const [query, setQuery] = useState("AI in healthcare");
  const [city, setCity] = useState("San Francisco");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [time, setTime] = useState("any");
  const [format, setFormat] = useState("any");
  const [availability, setAvailability] = useState("any");
  const [data, setData] = useState<SearchResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [searchedFor, setSearchedFor] = useState("");

  const searchParams = useMemo(() => {
    const params = new URLSearchParams({
      query,
      city,
      time,
      format,
      availability,
    });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return params;
  }, [availability, city, format, from, query, time, to]);

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSearchedFor(query);
    try {
      const response = await fetch(`/api/search?${searchParams.toString()}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Search failed.");
      setData(payload);
    } catch (caught) {
      setData(null);
      setError(
        caught instanceof Error
          ? caught.message
          : "Something interrupted the search. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Narrow home">
          <span className="brand-mark" aria-hidden="true">
            N
          </span>
          <span>Narrow</span>
        </a>
        <div className="source-pill">
          <span className="live-dot" aria-hidden="true" />
          Live public Luma events
        </div>
      </header>

      <section className="hero" id="top">
        <div className="eyebrow">EVENT DISCOVERY, WITHOUT THE NOISE</div>
        <h1>
          Find the event you <em>actually</em> meant.
        </h1>
        <p className="hero-copy">
          Narrow keeps your city, date, and time filters strict—then checks the
          full event context before calling something a match.
        </p>

        <form className="search-console" onSubmit={handleSearch}>
          <div className="query-block">
            <label htmlFor="query">What are you looking for?</label>
            <div className="query-row">
              <input
                id="query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="e.g. AI in healthcare"
                minLength={2}
                required
              />
              <button className="search-button" disabled={loading} type="submit">
                {loading ? "Checking context…" : "Find events"}
                <span aria-hidden="true">↗</span>
              </button>
            </div>
            <div className="example-row" aria-label="Example searches">
              <span>Try</span>
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setQuery(example)}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-grid">
            <label>
              <span>City</span>
              <input
                list="cities"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                placeholder="City"
                required
              />
              <datalist id="cities">
                {CITY_OPTIONS.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            </label>
            <label>
              <span>From</span>
              <input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </label>
            <label>
              <span>To</span>
              <input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(event) => setTo(event.target.value)}
              />
            </label>
            <label>
              <span>Time</span>
              <select value={time} onChange={(event) => setTime(event.target.value)}>
                <option value="any">Any time</option>
                <option value="morning">Morning</option>
                <option value="afternoon">Afternoon</option>
                <option value="evening">Evening</option>
              </select>
            </label>
            <label>
              <span>Format</span>
              <select
                value={format}
                onChange={(event) => setFormat(event.target.value)}
              >
                <option value="any">Any format</option>
                <option value="meetup">Meetup</option>
                <option value="panel">Panel / discussion</option>
                <option value="workshop">Workshop</option>
                <option value="hackathon">Hackathon</option>
                <option value="networking">Networking</option>
                <option value="conference">Conference / summit</option>
                <option value="talk">Talk / seminar</option>
                <option value="dinner">Meal</option>
              </select>
            </label>
            <label>
              <span>Availability</span>
              <select
                value={availability}
                onChange={(event) => setAvailability(event.target.value)}
              >
                <option value="any">Any availability</option>
                <option value="open">Spots open</option>
                <option value="free">Free events</option>
              </select>
            </label>
          </div>

          <div className="search-policy">
            <span className="shield" aria-hidden="true">✓</span>
            <p>
              <strong>Context lock is on.</strong> Multi-topic searches must
              contain evidence for every topic near each other—not just one keyword.
            </p>
          </div>
        </form>
      </section>

      <section className="results-section" aria-live="polite">
        {loading && (
          <div className="loading-state" role="status">
            <div className="scan-line" />
            <p>Reading event descriptions and checking topic overlap…</p>
          </div>
        )}

        {error && !loading && (
          <div className="empty-state error-state">
            <span>Search paused</span>
            <h2>We couldn’t complete this scan.</h2>
            <p>{error}</p>
          </div>
        )}

        {!loading && data && (
          <>
            <div className="results-heading">
              <div>
                <div className="eyebrow">CONFIDENT MATCHES</div>
                <h2>
                  {data.results.length
                    ? `${data.results.length} events worth your time`
                    : "No context-safe matches yet"}
                </h2>
              </div>
              <p>
                Scanned {data.meta.scanned} public events in {data.meta.city};
                analyzed the {data.meta.analyzed} most plausible in detail.
              </p>
            </div>

            {data.results.length === 0 ? (
              <div className="empty-state">
                <span>Zero false confidence</span>
                <h3>Nothing cleared the relevance bar.</h3>
                <p>
                  We found events, but none matched every part of “{searchedFor}”
                  closely enough. Try a wider date range or a slightly broader topic.
                </p>
              </div>
            ) : (
              <div className="result-list">
                {data.results.map((result, index) => (
                  <article className="event-card" key={result.id}>
                    <div className="event-index">{String(index + 1).padStart(2, "0")}</div>
                    <div className="event-image-wrap">
                      {result.image ? (
                        <img src={result.image} alt="" className="event-image" />
                      ) : (
                        <div className="event-image fallback-image" aria-hidden="true">
                          <span>{result.title.slice(0, 1)}</span>
                        </div>
                      )}
                      <div className="score-badge">
                        <strong>{result.score}%</strong>
                        <span>{result.matchLabel}</span>
                      </div>
                    </div>
                    <div className="event-content">
                      <div className="event-meta">
                        <span>{formatDate(result)}</span>
                        <span>{result.city}{result.region ? `, ${result.region}` : ""}</span>
                        {result.isFree === true && <span>Free</span>}
                        {result.isSoldOut && <span>Waitlist</span>}
                      </div>
                      <h3>{result.title}</h3>
                      <p className="organizer">By {result.organizer || "Luma host"}</p>
                      <p className="event-description">
                        {excerpt(result.description) || "Open the event for full details."}
                      </p>
                      <div className="reason-row">
                        {result.reasons.map((reason) => (
                          <span key={reason}>{reason}</span>
                        ))}
                      </div>
                      <div className="card-footer">
                        <span>{result.venue || result.city}</span>
                        <a href={result.url} target="_blank" rel="noreferrer">
                          View on Luma <span aria-hidden="true">↗</span>
                        </a>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}

            <div className="source-note">
              Results come from public, discoverable Luma pages. Private and
              invite-only events cannot be included.
              <a href={data.meta.sourceUrl} target="_blank" rel="noreferrer">
                View city source
              </a>
            </div>
          </>
        )}

        {!loading && !data && !error && (
          <div className="method-grid">
            <div>
              <span>01</span>
              <h3>Hard filters first</h3>
              <p>Wrong city, date, time, or format? It never reaches ranking.</p>
            </div>
            <div>
              <span>02</span>
              <h3>Full context next</h3>
              <p>Titles, descriptions, organizers, and related terms are checked together.</p>
            </div>
            <div>
              <span>03</span>
              <h3>Explain the match</h3>
              <p>Every result shows its score and the signals that earned it.</p>
            </div>
          </div>
        )}
      </section>

      <footer>
        <span>Narrow</span>
        <p>Independent event discovery using public Luma listings.</p>
      </footer>
    </main>
  );
}
