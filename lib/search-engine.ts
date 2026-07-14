export type TimeWindow = "any" | "morning" | "afternoon" | "evening";

export type SearchEvent = {
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
  formatText: string;
  isFree: boolean | null;
  isSoldOut: boolean;
  registration: string;
};

export type RankedEvent = SearchEvent & {
  score: number;
  matchLabel: "Excellent match" | "Strong match" | "Related match";
  reasons: string[];
};

type Concept = { label: string; terms: string[] };

const QUERY_ALIASES: Record<string, string> = {
  vc: "venture capital",
  vcs: "venture capital",
  ml: "machine learning",
  pm: "product management",
  gtm: "go to market",
  saas: "software as a service",
  ar: "augmented reality",
  vr: "virtual reality",
};

const CONCEPTS: Concept[] = [
  {
    label: "AI",
    terms: [
      "ai",
      "artificial intelligence",
      "machine learning",
      "generative ai",
      "genai",
      "llm",
      "large language model",
      "neural network",
      "agentic",
      "ai agent",
      "computer vision",
      "data science",
    ],
  },
  {
    label: "healthcare",
    terms: [
      "healthcare",
      "health care",
      "healthtech",
      "health tech",
      "digital health",
      "medicine",
      "medical",
      "clinical",
      "clinician",
      "patient",
      "hospital",
      "physician",
      "doctor",
      "diagnostic",
      "diagnostics",
      "pharma",
      "therapeutic",
      "care delivery",
    ],
  },
  {
    label: "biotech",
    terms: [
      "biotech",
      "biology",
      "bioeconomy",
      "genomic",
      "genomics",
      "life science",
      "molecular",
      "drug discovery",
    ],
  },
  {
    label: "climate",
    terms: [
      "climate",
      "sustainability",
      "clean energy",
      "cleantech",
      "carbon",
      "renewable",
      "decarbonization",
      "environment",
    ],
  },
  {
    label: "finance",
    terms: [
      "finance",
      "fintech",
      "banking",
      "payments",
      "investing",
      "wealth",
      "capital markets",
      "insurance",
    ],
  },
  {
    label: "venture capital",
    terms: [
      "venture capital",
      "venture capitalist",
      "venture capitalists",
      "venture fund",
      "venture funds",
      "venture investor",
      "venture investors",
      "seed investor",
      "seed investors",
      "angel investor",
      "angel investors",
      "investor",
      "investors",
      "general partner",
      "limited partner",
      "dealflow",
      "deal flow",
    ],
  },
  {
    label: "startups",
    terms: [
      "startup",
      "startups",
      "founder",
      "founders",
      "entrepreneur",
      "pitch",
      "accelerator",
    ],
  },
  {
    label: "design",
    terms: [
      "design",
      "designer",
      "ux",
      "ui",
      "product design",
      "creative technology",
      "typography",
    ],
  },
  {
    label: "education",
    terms: [
      "education",
      "edtech",
      "learning",
      "teaching",
      "teacher",
      "school",
      "student",
      "university",
    ],
  },
  {
    label: "crypto",
    terms: [
      "crypto",
      "blockchain",
      "web3",
      "bitcoin",
      "ethereum",
      "defi",
      "token",
    ],
  },
  {
    label: "security",
    terms: [
      "cybersecurity",
      "cyber security",
      "security",
      "privacy",
      "biosecurity",
      "trust and safety",
      "infosec",
    ],
  },
  {
    label: "food",
    terms: ["food", "cooking", "culinary", "restaurant", "chef", "tasting"],
  },
  {
    label: "arts",
    terms: [
      "art",
      "artist",
      "music",
      "film",
      "theater",
      "photography",
      "ceramic",
      "dance",
      "gallery",
    ],
  },
];

export const FORMAT_TERMS: Record<string, string[]> = {
  meetup: ["meetup", "meet up", "community gathering"],
  panel: ["panel", "fireside", "roundtable", "discussion"],
  workshop: ["workshop", "hands-on", "training", "masterclass", "lab"],
  hackathon: ["hackathon", "hack night", "buildathon", "build night"],
  networking: ["networking", "mixer", "happy hour", "social"],
  conference: ["conference", "summit", "expo", "convention", "symposium"],
  talk: ["talk", "lecture", "presentation", "speaker", "seminar"],
  dinner: ["dinner", "supper", "brunch", "breakfast", "lunch"],
};

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "at",
  "for",
  "in",
  "near",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
  "x",
]);

export function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function expandQuery(query: string) {
  return normalize(query)
    .split(" ")
    .map((token) => QUERY_ALIASES[token] ?? token)
    .join(" ");
}

export function searchVariants(query: string) {
  const original = query.trim();
  const normalized = normalize(original);
  const expanded = expandQuery(original);
  const variants = [original];
  if (expanded && expanded !== normalized) variants.push(expanded);
  if (normalized === "vc" || normalized === "vcs") variants.push("investor");
  return [...new Set(variants)].slice(0, 3);
}

function includesTerm(text: string, term: string) {
  const haystack = ` ${text} `;
  const needle = ` ${normalize(term)} `;
  return haystack.includes(needle);
}

function queryConcepts(query: string) {
  const normalized = expandQuery(query);
  return CONCEPTS.filter((concept) =>
    concept.terms.some((term) => includesTerm(normalized, term)),
  );
}

function matchedTerms(text: string, concept: Concept) {
  return concept.terms.filter((term) => includesTerm(text, term));
}

function conceptConfidence(
  concept: Concept,
  title: string,
  description: string,
  supporting: string,
) {
  const titleMatches = matchedTerms(title, concept);
  if (titleMatches.length) return { confidence: 1, terms: titleMatches };

  const descriptionMatches = matchedTerms(description, concept);
  if (descriptionMatches.length > 1) {
    return { confidence: 0.88, terms: descriptionMatches };
  }
  if (descriptionMatches.length === 1) {
    return { confidence: 0.68, terms: descriptionMatches };
  }

  const supportMatches = matchedTerms(supporting, concept);
  return supportMatches.length
    ? { confidence: 0.45, terms: supportMatches }
    : { confidence: 0, terms: [] as string[] };
}

function conceptSpan(text: string, concepts: Concept[]) {
  if (concepts.length < 2) return 0;
  const positions = concepts.map((concept) => {
    const hits = concept.terms
      .map((term) => text.indexOf(normalize(term)))
      .filter((position) => position >= 0);
    return hits.length ? hits : [-1];
  });
  if (positions.some((group) => group[0] === -1)) return Number.POSITIVE_INFINITY;

  let best = Number.POSITIVE_INFINITY;
  const walk = (depth: number, selected: number[]) => {
    if (depth === positions.length) {
      best = Math.min(best, Math.max(...selected) - Math.min(...selected));
      return;
    }
    for (const position of positions[depth].slice(0, 8)) {
      walk(depth + 1, [...selected, position]);
    }
  };
  walk(0, []);
  return best;
}

function tokenCoverage(query: string, text: string, concepts: Concept[]) {
  const tokens = normalize(query)
    .split(" ")
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
  if (!tokens.length) return 0;

  const covered = tokens.filter((token) => {
    if (includesTerm(text, token)) return true;
    const matchingConcept = concepts.find((concept) =>
      concept.terms.some((term) => includesTerm(normalize(term), token)),
    );
    return Boolean(
      matchingConcept?.terms.some((term) => includesTerm(text, term)),
    );
  });
  return covered.length / tokens.length;
}

function eventLocalParts(event: SearchEvent) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: event.timezone || "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(event.startAt));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
  };
}

export function passesHardFilters(
  event: SearchEvent,
  filters: {
    from?: string;
    to?: string;
    time?: TimeWindow;
    format?: string;
    availability?: string;
  },
) {
  const local = eventLocalParts(event);
  if (filters.from && local.date < filters.from) return false;
  if (filters.to && local.date > filters.to) return false;

  if (filters.time === "morning" && (local.hour < 5 || local.hour >= 12)) {
    return false;
  }
  if (filters.time === "afternoon" && (local.hour < 12 || local.hour >= 17)) {
    return false;
  }
  if (filters.time === "evening" && (local.hour < 17 || local.hour >= 24)) {
    return false;
  }

  const fullText = normalize(
    `${event.title} ${event.description} ${event.formatText}`,
  );
  if (
    filters.format &&
    filters.format !== "any" &&
    !FORMAT_TERMS[filters.format]?.some((term) => includesTerm(fullText, term))
  ) {
    return false;
  }

  if (filters.availability === "open" && event.isSoldOut) return false;
  if (filters.availability === "free" && event.isFree !== true) return false;
  return true;
}

export function preScore(event: SearchEvent, query: string) {
  const semanticQuery = expandQuery(query);
  const title = normalize(event.title);
  const supporting = normalize(`${event.organizer} ${event.formatText}`);
  const concepts = queryConcepts(query);
  const conceptHits = concepts.filter(
    (concept) =>
      matchedTerms(title, concept).length || matchedTerms(supporting, concept).length,
  ).length;
  const healthcareAdjacent = concepts.some((concept) => concept.label === "healthcare") &&
    ["biotech", "biology", "bioeconomy", "genomic", "genomics", "life science"]
      .some((term) => includesTerm(`${title} ${supporting}`, term));
  return Math.min(100,
    tokenCoverage(semanticQuery, `${title} ${supporting}`, concepts) * 60 +
    (concepts.length ? (conceptHits / concepts.length) * 40 : 0) +
    (healthcareAdjacent ? 24 : 0)
  );
}

export function rankEvent(event: SearchEvent, query: string): RankedEvent | null {
  const originalQuery = normalize(query);
  const cleanQuery = expandQuery(query);
  if (!cleanQuery) return null;

  const title = normalize(event.title);
  const semanticDescription = event.description
    .split(/\n\s*(?:sponsors?|sponsored by|supported by|partners?):?\s*\n?/i)[0]
    .slice(0, 7000);
  const description = normalize(semanticDescription);
  const supporting = normalize(
    `${event.organizer} ${event.city} ${event.region}`,
  );
  const fullText = `${title} ${description} ${supporting}`.trim();
  const concepts = queryConcepts(query);
  const conceptResults = concepts.map((concept) => ({
    concept,
    ...conceptConfidence(concept, title, description, supporting),
  }));
  const conceptScore = conceptResults.length
    ? conceptResults.reduce((sum, result) => sum + result.confidence, 0) /
      conceptResults.length
    : 0;
  const minimumConcept = conceptResults.length
    ? Math.min(...conceptResults.map((result) => result.confidence))
    : 1;
  const lexical = tokenCoverage(cleanQuery, fullText, concepts);
  const titleRelevance = Math.max(
    tokenCoverage(cleanQuery, title, concepts),
    conceptResults.length
      ? conceptResults.filter((result) => result.confidence === 1).length /
          conceptResults.length
      : 0,
  );
  const phrase =
    includesTerm(fullText, cleanQuery) || includesTerm(fullText, originalQuery)
      ? 1
      : 0;

  let score = concepts.length
    ? conceptScore * 46 + lexical * 26 + titleRelevance * 18 + phrase * 10
    : lexical * 58 + titleRelevance * 32 + phrase * 10;

  if (concepts.length > 1 && minimumConcept === 0) score *= 0.42;

  const span = conceptSpan(`${title} ${description}`, concepts);
  if (concepts.length > 1 && Number.isFinite(span) && span > 700) {
    score = Math.min(score, 55);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const minimumScore = concepts.length > 1 ? 58 : 50;
  if (score < minimumScore) return null;

  const reasons: string[] = [];
  const coveredConcepts = conceptResults
    .filter((result) => result.confidence > 0)
    .map((result) => result.concept.label);
  if (coveredConcepts.length) {
    reasons.push(`Connects ${coveredConcepts.join(" + ")}`);
  }

  const related = conceptResults
    .flatMap((result) => result.terms)
    .filter((term) => !includesTerm(cleanQuery, term))
    .slice(0, 3);
  if (related.length) reasons.push(`Related signals: ${related.join(", ")}`);
  if (titleRelevance >= 0.66) reasons.push("Strong title match");
  if (phrase) reasons.push("Exact phrase found");

  return {
    ...event,
    score,
    matchLabel:
      score >= 84
        ? "Excellent match"
        : score >= 70
          ? "Strong match"
          : "Related match",
    reasons: reasons.slice(0, 3),
  };
}

export function knownConceptLabels(query: string) {
  return queryConcepts(query).map((concept) => concept.label);
}
