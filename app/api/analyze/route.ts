import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type AnalyzeRequest = {
  text?: string;
  url?: string;
  image?: {
    data: string;
    mediaType: string;
  } | null;
};

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};

type SearchEvidence = {
  query: string;
  results: SearchResult[];
};

type FetchedSource = {
  title: string;
  url: string;
  domain: string;
  ok: boolean;
  status?: number;
  contentType?: string;
  text: string;
  error?: string;
};

type ClaimInput = {
  claim: string;
  searchSeed: string;
  submittedSource?: FetchedSource;
};

type VerdictResult = {
  verdict: "CREDIBLE" | "SUSPICIOUS" | "LIKELY FAKE";
  confidence: number;
  summary: string;
  sources: Array<{ title: string; url: string; supports: boolean }>;
  signals: Array<{ name: string; score: number; note: string }>;
  red_flags: string[];
  positive_indicators: string[];
};

const MODEL = process.env.FIREWORKS_MODEL || "accounts/fireworks/models/kimi-k2p6";
const FIREWORKS_CHAT_API = "https://api.fireworks.ai/inference/v1/chat/completions";
const BRAVE_SEARCH_API = "https://api.search.brave.com/res/v1/web/search";
const GDELT_DOC_API = "https://api.gdeltproject.org/api/v2/doc/doc";
const DUCKDUCKGO_API = "https://api.duckduckgo.com/";
const GOOGLE_NEWS_RSS = "https://news.google.com/rss/search";
const MAX_FETCH_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 12000;
const USER_AGENT = "Mozilla/5.0 (compatible; VerityLab/1.0; +https://example.local)";
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function currentDateLabel() {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "Asia/Kolkata"
  }).format(new Date());
}

function send(controller: ReadableStreamDefaultController, payload: unknown) {
  controller.enqueue(new TextEncoder().encode(`${JSON.stringify(payload)}\n`));
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function htmlToText(html: string) {
  return decodeHtml(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n/g, "\n\n")
    .trim();
}

function xmlToText(value: string) {
  return htmlToText(
    value
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<[^>]+>/g, " ")
  );
}

function extractTitle(html: string) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return title ? htmlToText(title).slice(0, 180) : "";
}

function getDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function searchSeedFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    const pathWords = parsed.pathname
      .replace(/\.[a-z0-9]+$/i, "")
      .split("/")
      .filter(Boolean)
      .slice(-4)
      .join(" ")
      .replace(/[-_]+/g, " ")
      .replace(/\b(20\d{2}|0?[1-9]|1[0-2])\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return [pathWords, parsed.hostname.replace(/^www\./, "").split(".")[0]]
      .filter(Boolean)
      .join(" ")
      .trim();
  } catch {
    return url
      .replace(/^https?:\/\//, "")
      .replace(/[^a-z0-9]+/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
}

function normalizeUrl(value: string) {
  const parsed = new URL(value);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only http and https URLs are supported.");
  }
  return parsed.toString();
}

async function readLimitedResponse(response: Response) {
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    const remaining = MAX_FETCH_BYTES - received;
    if (value.length > remaining) {
      chunks.push(value.slice(0, remaining));
      break;
    }

    chunks.push(value);
    received += value.length;
    if (received >= MAX_FETCH_BYTES) break;
  }

  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return new TextDecoder().decode(merged);
}

async function webFetch(url: string): Promise<FetchedSource> {
  const normalized = normalizeUrl(url);
  try {
    const response = await fetch(normalized, {
      headers: { "user-agent": USER_AGENT },
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    });

    const contentType = response.headers.get("content-type") || "";
    const status = response.status;

    if (!response.ok) {
      return {
        title: getDomain(normalized),
        url: normalized,
        domain: getDomain(normalized),
        ok: false,
        status,
        contentType,
        text: "",
        error: `HTTP ${status}`
      };
    }

    const raw = await readLimitedResponse(response);
    const title = contentType.includes("text/html") ? extractTitle(raw) : getDomain(normalized);
    const text = contentType.includes("text/html") ? htmlToText(raw) : raw.trim();

    return {
      title: title || getDomain(normalized),
      url: normalized,
      domain: getDomain(normalized),
      ok: true,
      status,
      contentType,
      text: text.slice(0, 9000)
    };
  } catch (error) {
    return {
      title: getDomain(normalized),
      url: normalized,
      domain: getDomain(normalized),
      ok: false,
      text: "",
      error: error instanceof Error ? error.message : "Fetch failed"
    };
  }
}

async function duckDuckGoSearch(query: string, count: number): Promise<SearchResult[]> {
  const params = new URLSearchParams({ q: query });
  const response = await fetch(`https://html.duckduckgo.com/html/?${params}`, {
    headers: { "user-agent": BROWSER_USER_AGENT },
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    throw new Error(`DuckDuckGo search failed with status ${response.status}.`);
  }

  const html = await response.text();
  const results: SearchResult[] = [];
  const linkRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
  const links = [...html.matchAll(linkRegex)];
  const snippets = [...html.matchAll(snippetRegex)];

  for (let index = 0; index < links.length && results.length < count; index += 1) {
    const url = decodeDuckDuckGoUrl(decodeHtml(links[index][1]));
    const title = htmlToText(links[index][2]);
    const snippet = snippets[index] ? htmlToText(snippets[index][1]) : "";
    if (!url.startsWith("http") || url.includes("duckduckgo.com") || !title) continue;
    results.push({ title, url, snippet });
  }

  return results;
}

type DuckDuckGoTopic = {
  FirstURL?: string;
  Text?: string;
  Topics?: DuckDuckGoTopic[];
};

type DuckDuckGoInstantAnswer = {
  AbstractText?: string;
  AbstractURL?: string;
  Heading?: string;
  RelatedTopics?: DuckDuckGoTopic[];
};

function flattenDuckDuckGoTopics(topics: DuckDuckGoTopic[] = []): DuckDuckGoTopic[] {
  return topics.flatMap((topic) => [topic, ...flattenDuckDuckGoTopics(topic.Topics || [])]);
}

async function duckDuckGoInstantAnswerSearch(query: string, count: number): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: "json",
    no_html: "1",
    no_redirect: "1",
    skip_disambig: "1"
  });

  const response = await fetch(`${DUCKDUCKGO_API}?${params}`, {
    headers: { "user-agent": BROWSER_USER_AGENT },
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    throw new Error(`DuckDuckGo API search failed with status ${response.status}.`);
  }

  const data = (await response.json()) as DuckDuckGoInstantAnswer;
  const results: SearchResult[] = [];

  if (data.AbstractURL && data.Heading) {
    results.push({
      title: htmlToText(data.Heading),
      url: data.AbstractURL,
      snippet: htmlToText(data.AbstractText || "DuckDuckGo instant answer result.")
    });
  }

  for (const topic of flattenDuckDuckGoTopics(data.RelatedTopics || [])) {
    if (!topic.FirstURL || !topic.Text) continue;
    results.push({
      title: htmlToText(topic.Text.split(" - ")[0] || topic.Text).slice(0, 160),
      url: topic.FirstURL,
      snippet: htmlToText(topic.Text)
    });
    if (results.length >= count) break;
  }

  const seen = new Set<string>();
  return results
    .filter((result) => {
      if (!result.title || !result.url.startsWith("http") || seen.has(result.url)) return false;
      seen.add(result.url);
      return true;
    })
    .slice(0, count);
}

type BraveSearchResponse = {
  web?: {
    results?: Array<{
      title?: string;
      url?: string;
      description?: string;
      extra_snippets?: string[];
    }>;
  };
};

type GdeltDocResponse = {
  articles?: Array<{
    title?: string;
    url?: string;
    domain?: string;
    sourceCountry?: string;
    seendate?: string;
  }>;
};

async function braveSearch(query: string, count: number): Promise<SearchResult[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;
  if (!apiKey) return [];

  const params = new URLSearchParams({
    q: query,
    count: String(Math.min(Math.max(count, 1), 20)),
    country: "us",
    search_lang: "en",
    safesearch: "moderate",
    spellcheck: "1"
  });

  const response = await fetch(`${BRAVE_SEARCH_API}?${params}`, {
    headers: {
      "accept": "application/json",
      "accept-encoding": "gzip",
      "x-subscription-token": apiKey
    },
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Brave Search failed with status ${response.status}.${detail ? ` ${detail.slice(0, 180)}` : ""}`);
  }

  const data = (await response.json()) as BraveSearchResponse;
  return (data.web?.results || [])
    .map((result) => ({
      title: htmlToText(result.title || ""),
      url: result.url || "",
      snippet: htmlToText([result.description, ...(result.extra_snippets || [])].filter(Boolean).join(" "))
    }))
    .filter((result) => result.title && result.url.startsWith("http"))
    .slice(0, count);
}

async function gdeltSearch(query: string, count: number): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    query,
    mode: "artlist",
    format: "json",
    maxrecords: String(Math.min(Math.max(count, 1), 50)),
    sort: "hybridrel"
  });

  const response = await fetch(`${GDELT_DOC_API}?${params}`, {
    headers: { "accept": "application/json" },
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    throw new Error(`GDELT search failed with status ${response.status}.`);
  }

  const data = (await response.json()) as GdeltDocResponse;
  return (data.articles || [])
    .map((article) => {
      const domain = article.domain || (article.url ? getDomain(article.url) : "");
      const date = article.seendate ? `Seen ${article.seendate}. ` : "";
      const country = article.sourceCountry ? `Source country: ${article.sourceCountry}. ` : "";
      return {
        title: htmlToText(article.title || ""),
        url: article.url || "",
        snippet: `${date}${country}${domain ? `Source: ${domain}.` : ""}`.trim()
      };
    })
    .filter((result) => result.title && result.url.startsWith("http"))
    .slice(0, count);
}

async function googleNewsSearch(query: string, count: number): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    hl: "en-US",
    gl: "US",
    ceid: "US:en"
  });

  const response = await fetch(`${GOOGLE_NEWS_RSS}?${params}`, {
    headers: { "user-agent": BROWSER_USER_AGENT },
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    throw new Error(`Google News RSS search failed with status ${response.status}.`);
  }

  const xml = await response.text();
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];
  return items
    .map((item) => {
      const raw = item[1];
      const title = xmlToText(raw.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || "");
      const url = decodeHtml(raw.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || "").trim();
      const snippet = xmlToText(raw.match(/<description>([\s\S]*?)<\/description>/i)?.[1] || "");
      return { title, url, snippet };
    })
    .filter((result) => result.title && result.url.startsWith("http"))
    .slice(0, count);
}

async function webSearch(query: string, count: number): Promise<SearchResult[]> {
  if (process.env.BRAVE_SEARCH_API_KEY) {
    try {
      return await braveSearch(query, count);
    } catch (error) {
      console.warn(error instanceof Error ? error.message : "Brave Search failed.");
    }
  }

  try {
    const results = await duckDuckGoInstantAnswerSearch(query, count);
    if (results.length) return results;
  } catch (error) {
    console.warn(error instanceof Error ? error.message : "DuckDuckGo API search failed.");
  }

  try {
    const results = await googleNewsSearch(query, count);
    if (results.length) return results;
  } catch (error) {
    console.warn(error instanceof Error ? error.message : "Google News RSS search failed.");
  }

  try {
    const results = await gdeltSearch(query, count);
    if (results.length) return results;
  } catch (error) {
    console.warn(error instanceof Error ? error.message : "GDELT search failed.");
  }

  try {
    return await duckDuckGoSearch(query, count);
  } catch (error) {
    console.warn(error instanceof Error ? error.message : "DuckDuckGo search failed.");
    return [];
  }
}

function decodeDuckDuckGoUrl(url: string) {
  try {
    const parsed = new URL(url, "https://duckduckgo.com");
    const encoded = parsed.searchParams.get("uddg");
    return encoded ? decodeURIComponent(encoded) : parsed.href;
  } catch {
    const match = url.match(/[?&]uddg=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : url;
  }
}

function buildSearchQueries(input: string) {
  const base = input.replace(/\s+/g, " ").trim().slice(0, 180);
  const compact = buildKeywordQuery(base);
  const queries = [
    compact,
    base,
    `${compact || base} fact check`,
    `${compact || base} Reuters AP BBC`,
    `${compact || base} Snopes PolitiFact FactCheck.org`
  ];
  return [...new Set(queries.map((query) => query.trim()).filter(Boolean))].slice(0, 4);
}

function buildKeywordQuery(input: string) {
  const stopWords = new Set([
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "claim",
    "claims",
    "confirm",
    "confirms",
    "is",
    "it",
    "of",
    "on",
    "or",
    "says",
    "the",
    "this",
    "to",
    "will",
    "with"
  ]);

  return input
    .replace(/['’]s\b/gi, "")
    .replace(/['"“”‘’]/g, "")
    .replace(/[^a-z0-9.\s-]/gi, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2 || /\d/.test(word))
    .filter((word) => !stopWords.has(word.toLowerCase()))
    .slice(0, 10)
    .join(" ");
}

function sourceScore(result: SearchResult) {
  const haystack = `${result.title} ${result.url}`.toLowerCase();
  if (/reuters|apnews|associatedpress|bbc|snopes|politifact|factcheck\.org|fullfact|leadstories/.test(haystack)) {
    return 100;
  }
  if (/gov|edu|who\.int|un\.org|nasa\.gov|nih\.gov/.test(haystack)) return 85;
  if (/nytimes|washingtonpost|theguardian|cnn|cnbc|npr|aljazeera|thehindu|indianexpress/.test(haystack)) {
    return 70;
  }
  if (/wikipedia/.test(haystack)) return 45;
  return 40;
}

function selectSources(evidence: SearchEvidence[]) {
  const seen = new Set<string>();
  return evidence
    .flatMap((item) => item.results)
    .filter((result) => {
      if (seen.has(result.url)) return false;
      seen.add(result.url);
      return true;
    })
    .sort((a, b) => sourceScore(b) - sourceScore(a))
    .slice(0, 5);
}

function buildEvidenceText(searchEvidence: SearchEvidence[], fetchedSources: FetchedSource[]) {
  const searches = searchEvidence
    .map((item, index) => {
      const results = item.results
        .slice(0, 6)
        .map(
          (result, resultIndex) =>
            `${resultIndex + 1}. ${result.title}\nURL: ${result.url}\nSnippet: ${result.snippet || "No snippet."}`
        )
        .join("\n\n");
      return `Search ${index + 1}: ${item.query}\n${results || "No results."}`;
    })
    .join("\n\n---\n\n");

  const fetched = fetchedSources
    .map((source, index) => {
      const status = source.ok
        ? "ok"
        : `fetch blocked or failed (${source.error || source.status || "unknown"}). This is not evidence that the claim is false.`;

      return `Fetched source ${index + 1}: ${source.title}\nURL: ${source.url}\nDomain: ${source.domain}\nStatus: ${status}\nContent excerpt:\n${
        source.text || "No readable content from this URL."
      }`;
    })
    .join("\n\n---\n\n");

  return `SEARCH RESULTS\n${searches || "No search results."}\n\nFETCHED PAGES\n${fetched || "No fetched pages."}`;
}

function buildVerdictPrompt(claim: string, searchEvidence: SearchEvidence[], fetchedSources: FetchedSource[]) {
  return `You are an expert misinformation analyst. You are not browsing live. The server already searched and fetched web pages for you.

Analyze the claim using ONLY the evidence below. If evidence is weak or contradictory, say so.
Today's date is ${currentDateLabel()}. Dates before today are in the past. Dates after today are in the future. Do not reject 2026 evidence as future-dated unless it is after today's date.
When reliable sources report a death or other dated event before today's date, treat it as current historical evidence, not as a hoax solely because older fact-checks debunked earlier rumors.
If a submitted URL fetch is blocked with HTTP 403 or another access error, do not treat that as evidence against the claim. Use search results and other fetched sources for corroboration.

Return ONLY one valid JSON object. No markdown. No prose outside JSON.

Required schema:
{
  "verdict": "CREDIBLE" | "SUSPICIOUS" | "LIKELY FAKE",
  "confidence": <number 0-100>,
  "summary": "<direct one paragraph answer. Start with yes/no when the claim is phrased as a yes/no claim. Mention the most important evidence.>",
  "sources": [
    { "title": "...", "url": "...", "supports": true | false }
  ],
  "signals": [
    { "name": "Emotional Language", "score": <0-10>, "note": "..." },
    { "name": "Source Quality", "score": <0-10>, "note": "..." },
    { "name": "Logical Consistency", "score": <0-10>, "note": "..." },
    { "name": "Factual Accuracy", "score": <0-10>, "note": "..." },
    { "name": "Bias Indicators", "score": <0-10>, "note": "..." },
    { "name": "Headline Accuracy", "score": <0-10>, "note": "..." }
  ],
  "red_flags": ["...", "..."],
  "positive_indicators": ["...", "..."]
}

Claim:
${claim}

Evidence:
${buildEvidenceText(searchEvidence, fetchedSources)}`;
}

function extractJson(raw: string) {
  const clean = raw.replace(/```json|```/g, "").trim();
  const first = clean.indexOf("{");
  const last = clean.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return clean;
  return clean.slice(first, last + 1);
}

function buildRepairPrompt(claim: string, searchEvidence: SearchEvidence[], rawText: string) {
  const sources = searchEvidence
    .flatMap((item) => item.results)
    .slice(0, 8)
    .map((source, index) => `${index + 1}. ${source.title}\nURL: ${source.url}\nSnippet: ${source.snippet || "No snippet."}`)
    .join("\n\n");

  return `Convert the analysis below into ONLY one valid JSON object. Do not add markdown or prose outside JSON.

Required JSON shape:
{
  "verdict": "CREDIBLE" | "SUSPICIOUS" | "LIKELY FAKE",
  "confidence": <number 0-100>,
  "summary": "<direct one paragraph answer using the evidence>",
  "sources": [{ "title": "...", "url": "...", "supports": true | false }],
  "signals": [],
  "red_flags": [],
  "positive_indicators": []
}

Claim:
${claim}

Available sources:
${sources || "No search results."}

Analysis to convert:
${rawText || "No usable analysis text."}`;
}

async function askKimiRaw(apiKey: string, prompt: string) {
  const response = await fetch(FIREWORKS_CHAT_API, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Fireworks failed with status ${response.status}.`);
  }

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content || "";
}

async function askKimiForVerdict(apiKey: string, prompt: string, repairPrompt: (rawText: string) => string) {
  const text = await askKimiRaw(apiKey, prompt);

  try {
    return JSON.parse(extractJson(text));
  } catch {
    const repaired = await askKimiRaw(apiKey, repairPrompt(text));
    return JSON.parse(extractJson(repaired));
  }
}

function normalizeVerdict(value: unknown, evidence: SearchEvidence[]): VerdictResult {
  const input = (value || {}) as Partial<VerdictResult>;
  const allowedVerdicts = ["CREDIBLE", "SUSPICIOUS", "LIKELY FAKE"] as const;
  const verdict = allowedVerdicts.includes(input.verdict as VerdictResult["verdict"])
    ? (input.verdict as VerdictResult["verdict"])
    : "SUSPICIOUS";

  const fallbackSources = evidence
    .flatMap((item) => item.results)
    .slice(0, 6)
    .map((source) => ({ title: source.title, url: source.url, supports: false }));

  const requiredSignalNames = [
    "Emotional Language",
    "Source Quality",
    "Logical Consistency",
    "Factual Accuracy",
    "Bias Indicators",
    "Headline Accuracy"
  ];

  const sourceSignals = Array.isArray(input.signals) ? input.signals : [];
  const signals = requiredSignalNames.map((name) => {
    const existing = sourceSignals.find((signal) => signal?.name === name);
    const score = Number(existing?.score);
    return {
      name,
      score: Number.isFinite(score) ? Math.max(0, Math.min(10, score)) : 5,
      note: existing?.note || "The model did not provide a detailed score for this signal."
    };
  });

  return {
    verdict,
    confidence: Number.isFinite(Number(input.confidence))
      ? Math.max(0, Math.min(100, Number(input.confidence)))
      : 50,
    summary:
      input.summary ||
      "The app searched and fetched sources, but the model returned an incomplete verdict. Review the listed sources directly.",
    sources: Array.isArray(input.sources) && input.sources.length ? input.sources : fallbackSources,
    signals,
    red_flags: Array.isArray(input.red_flags) ? input.red_flags : ["Incomplete model verdict."],
    positive_indicators: Array.isArray(input.positive_indicators) ? input.positive_indicators : []
  };
}

function fallbackVerdictFromEvidence(evidence: SearchEvidence[]): VerdictResult {
  const sources = evidence
    .flatMap((item) => item.results)
    .slice(0, 6)
    .map((source) => ({ title: source.title, url: source.url, supports: false }));

  return {
    verdict: "SUSPICIOUS",
    confidence: sources.length ? 55 : 35,
    summary: sources.length
      ? `The claim remains unverified from the available search results. The app found ${sources.length} potentially relevant source${sources.length === 1 ? "" : "s"}, but automated synthesis failed, so inspect the cited sources before treating the claim as true or false.`
      : "The claim remains unverified because the app could not find usable search results or produce a structured verdict. Try a more specific claim or add an article URL.",
    sources,
    signals: [
      { name: "Emotional Language", score: 5, note: "Manual review needed." },
      { name: "Source Quality", score: sources.length ? 5 : 2, note: "Automated synthesis failed." },
      { name: "Logical Consistency", score: 5, note: "Manual review needed." },
      { name: "Factual Accuracy", score: 5, note: "Manual review needed." },
      { name: "Bias Indicators", score: 5, note: "Manual review needed." },
      { name: "Headline Accuracy", score: 5, note: "Manual review needed." }
    ],
    red_flags: ["The model did not return valid verdict JSON."],
    positive_indicators: sources.length ? ["Search results were found for manual verification."] : []
  };
}

async function buildClaimInput(controller: ReadableStreamDefaultController, body: AnalyzeRequest): Promise<ClaimInput> {
  const text = body.text?.trim() || "";
  const url = body.url?.trim() || "";
  let submittedSource: FetchedSource | undefined;

  if (url) {
    send(controller, { type: "status", label: "Fetching submitted URL...", query: url });
    submittedSource = await webFetch(url);
    send(controller, {
      type: "fetched_source",
      source: {
        title: submittedSource.title,
        url: submittedSource.url,
        domain: submittedSource.domain,
        ok: submittedSource.ok,
        status: submittedSource.status,
        error: submittedSource.error
      }
    });
  }

  const parts: string[] = [];
  if (text) parts.push(text);
  if (submittedSource) {
    parts.push(
      `Submitted URL: ${submittedSource.url}\nTitle: ${submittedSource.title}\nSource text:\n${submittedSource.text}`
    );
  }
  if (body.image) {
    parts.push(
      "The user uploaded an image. If the model cannot inspect it in this flow, analyze the text/URL evidence and state that screenshot OCR was not available."
    );
  }

  const claim = parts.join("\n\n").trim();
  const searchSeed =
    text ||
    [submittedSource?.ok ? submittedSource.title : "", submittedSource?.text.slice(0, 260), url ? searchSeedFromUrl(url) : ""]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

  return { claim, searchSeed, submittedSource };
}

async function streamAnalysis(controller: ReadableStreamDefaultController, body: AnalyzeRequest) {
  const apiKey = process.env.FIREWORKS_API_KEY;
  if (!apiKey) {
    send(controller, {
      type: "error",
      message: "Missing FIREWORKS_API_KEY. Add it to .env.local and restart the dev server."
    });
    return;
  }

  const { claim, searchSeed, submittedSource } = await buildClaimInput(controller, body);
  if (!claim) {
    send(controller, { type: "error", message: "Provide text, a URL, or an image to analyze." });
    return;
  }

  send(controller, { type: "status", label: "Let me search for current information about this." });

  const searchEvidence: SearchEvidence[] = [];
  const queries = buildSearchQueries(searchSeed || claim);
  for (const query of queries) {
    send(controller, { type: "status", label: "Searching the web...", query });
    const results = await webSearch(query, 6);
    searchEvidence.push({ query, results });
    send(controller, { type: "search_results", query, results });
  }

  const selectedSources = selectSources(searchEvidence);
  const fetchedSources: FetchedSource[] = submittedSource ? [submittedSource] : [];
  for (const source of selectedSources) {
    if (submittedSource?.url === source.url) continue;
    send(controller, { type: "status", label: "Fetching source page...", query: source.url });
    const fetched = await webFetch(source.url);
    fetchedSources.push({
      ...fetched,
      title: fetched.title || source.title
    });
  }

  send(controller, { type: "status", label: "Writing verdict JSON..." });

  let result: VerdictResult;
  try {
    const rawVerdict = await askKimiForVerdict(
      apiKey,
      buildVerdictPrompt(claim, searchEvidence, fetchedSources),
      (rawText) => buildRepairPrompt(claim, searchEvidence, rawText)
    );
    result = normalizeVerdict(rawVerdict, searchEvidence);
  } catch (error) {
    console.warn(error instanceof Error ? error.message : "Verdict synthesis failed.");
    result = fallbackVerdictFromEvidence(searchEvidence);
  }

  send(controller, {
    type: "result",
    result,
    searchQueries: queries
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as AnalyzeRequest;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        await streamAnalysis(controller, body);
      } catch (error) {
        send(controller, {
          type: "error",
          message: error instanceof Error ? error.message : "Analysis failed."
        });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-cache, no-transform"
    }
  });
}
