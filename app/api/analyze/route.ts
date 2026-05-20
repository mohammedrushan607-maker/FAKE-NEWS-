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

type GoogleAiOverview = {
  query: string;
  url: string;
  text: string;
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
  overview?: CredibilityOverview;
  signals: Array<{ name: string; score: number; note: string }>;
  red_flags: string[];
  positive_indicators: string[];
};

type CredibilityOverview = {
  headline: string;
  short_answer: string;
  confidence_reason: string;
  key_points: string[];
  caveat: string;
};

const HARDCODED_LLM_PROVIDER = "gemini_web";
const HARDCODED_GOOGLE_AI_OVERVIEW_SCRAPE = "0";

const HARDCODED_GEMINI_COOKIES = "__Secure-BUCKET=CGU; _ga=GA1.1.1347665487.1770808337; HSID=An5evMeLrGhQAvgXN; SSID=AiC9HIHHXpPufTfk1; APISID=H9aRJXLasgZRpSmr/A4-oK7HNxdpYpsyoR; SAPISID=M8zjv42MUo4T35TM/AnvLfbyMOLN75_oCT; __Secure-1PAPISID=M8zjv42MUo4T35TM/AnvLfbyMOLN75_oCT; __Secure-3PAPISID=M8zjv42MUo4T35TM/AnvLfbyMOLN75_oCT; SEARCH_SAMESITE=CgQI5aAB; SID=g.a000-AjunEH5pfMf3sZe6CbmzHJAbJRTBKI85AeZ6jt2j1GfZqixuQR_5f1XHR__oUqf3jdk7gACgYKAT8SARASFQHGX2Miu5hLDGwk3xny3urka9f0vxoVAUF8yKpxnB3j6NhTNqR4Vzv8W62K0076; __Secure-1PSID=g.a000-AjunEH5pfMf3sZe6CbmzHJAbJRTBKI85AeZ6jt2j1GfZqixTMNitHUlJ_jM0uoGtT2faQACgYKAbwSARASFQHGX2Mi4hJh8NKIzuY_4CL246IYYBoVAUF8yKrPSXhHJ4lRtRx_oUekC0eh0076; __Secure-3PSID=g.a000-AjunEH5pfMf3sZe6CbmzHJAbJRTBKI85AeZ6jt2j1GfZqixk1hCrZhopUvQPikqrP06MgACgYKAXkSARASFQHGX2MirG8O-38N6tGTFZcNYOo21hoVAUF8yKpWF41DS5t66v0PdRStt-QC0076; AEC=AaJma5v22wpRMPQwdqBhCv6M4myQf-s6qsmoo7PU8uG4FAMKibQZLxp-hw; NID=531=KEIGyP-GYTrGR-PTYq_LP2LlJtTuh2SNQsbGpi2cG8-_bD5PCOZ2UUjS01I25q1WaIVQ52iuuZCh6bytZmySZJYhnu0PvOqWG8AWqWI5UTZ_aCLmykmV-R1auWuLbk3BtsnL92LwyXKdDiWEIjDBIFlzBHt3VIs60O5I5gnPwnh2kaR0SzEJ0sQdNb9xW3PGNbBv-3_sij_OAAuZneckVhzf-fHCQ0ydYu1d6psNKwYLi6pbXxHTJugQY-VKw6-BMqdRVDE4ZbCnsB713RJXwd2wh9QSNB7HcMRofNXpSfXY7FIXIF5VsshApFBOrMBOB9xNsQv9Q_jlohbOxVx5HrIgUrUd0Nrd20P0ZQKTQdNn8WpM3X34TvG4whPwL6QkX84Ona9f34tyNxCHVYgwj6rvjrBlJXSCHu9VQrxNQNZgSJfHxipkI6dpaKuIyCflFelD1d8a2cU2tgQaWQKlzicWjGbwx0V4hcNEvb5xDhyON_yxD8CRk-DevevKQgNLPTTkRL7GzpzogDE3NYbfDUstKApFOmpq_EPwT02odMzzOf8g4k2jd5BldfgJ8PrZSv2pBZjTgcMRBzsGyfdbv0bmjnBikzm-QLQeiKOQeRApynhn84uutOeJFJyVHXI3HnWRjnLw3mTjyMRfT80khrvZ2pZ1A_RLVfCy8I7-R6O3ervQOlZ2ry1uqGFJX1VKWbWDhJcW6ZP_w0Lig_t-rr3u5Tczvvq9l606cSJ2-mzSrW5Uf7nASVMiHFpCdNof; __Secure-1PSIDTS=sidts-CjYBhkeRd8EaN_1XeDnQYRBdNQNAl6GORYPHEe44s8QSocIrQPkxHh7wYqrkqrwqdm2BI1Hqi2AQAA; __Secure-1PSIDRTS=sidts-CjYBhkeRd8EaN_1XeDnQYRBdNQNAl6GORYPHEe44s8QSocIrQPkxHh7wYqrkqrwqdm2BI1Hqi2AQAA; __Secure-3PSIDTS=sidts-CjYBhkeRd8EaN_1XeDnQYRBdNQNAl6GORYPHEe44s8QSocIrQPkxHh7wYqrkqrwqdm2BI1Hqi2AQAA; __Secure-3PSIDRTS=sidts-CjYBhkeRd8EaN_1XeDnQYRBdNQNAl6GORYPHEe44s8QSocIrQPkxHh7wYqrkqrwqdm2BI1Hqi2AQAA; __Secure-STRP=AEEP7gIOGoDors7rxm6r_P1DNK80UYTd679Lwp6j6RBJRgY3UER617SvrNL7cH7NgjEKA_UD1EfhOJSyAyMsxy4gdNxuMcLXGCFI; _gcl_au=1.1.1564651390.1779295495; COMPASS=gemini-pd=CjwACWuJV93jFYb_b6k1ZbZc5AVi75OXfwVJx6huPFdJgLZgT-iphNSBtyIyTho-2Gurv4U86El7hPmdVFUQhO280AYaZgAJa4lXHHlOPllW_xWyzyyQ3eKXRBA5Yu90gZA6g526LN8m1cPDsTZ-_GDrkuGymKqK-w3DFD4s_P1eHulntZ-ONLpIMf7Mif9RvRqU82zUrllRbclz73TZh4fYnD-CrOxMioVrtyABMAE:gemini-hl=CkkACWuJV4Jq7gXnYGXm-CCWRGf1MNczIJ0yMsen8R98zb0fdd_v1HDcw_-Y0Gxw7WZu_GGVl89NUAGecp6EG6tM_DjudIlkdiK-EKntvNAGGnMACWuJV1lqq4jcZMzGnH4JC0kOtQrQsNrgkW-CH0QXfyAr_d-OLLBpADBcikON3JSEL4soD9HBZ27dYPrmlTQjDlkqu_XVwpEqjDcJCHFOkd7i9tiXkKCUU6MjkjqM9DZhBTmQCB7AeumJTkQ_ir28fLl_IAEwAQ; _ga_WC57KJ50ZZ=GS2.1.s1779295495$o13$g1$t1779295551$j4$l0$h0; _ga_BF8Q35BMLM=GS2.1.s1779295496$o12$g1$t1779295551$j5$l0$h0; SIDCC=AKEyXzUqbN-HmtbWSBpVDFuuqCtawc2mBTRVEGnQ0kL5wng24Tx8hfYIdPqi3No9r5AFPCUM5iY; __Secure-1PSIDCC=AKEyXzU94JeOWIHIqD4SZ2Rm1Rlx5jdsXd2UZCLMfJXVkyzP1CpqZkAAJvLg4NXWSq6w1ZFwjw; __Secure-3PSIDCC=AKEyXzUoJK9JmrBIrFiWIC9fftuYntl5b-NSaleZD97qTlP02FNt8KlngkwS4ccsai8h3A2ZzFM";
const HARDCODED_GEMINI_AT_TOKEN = "AOOh0PHP3CU8mB1OoyL3s0R2D1Gv:1779295492292";
const HARDCODED_GEMINI_F_SID = "-7679763018272589583";
const HARDCODED_GEMINI_BL_VERSION = "boq_assistant-bard-web-server_20260511.16_p18";
const HARDCODED_GEMINI_X_GOOG_EXT = '["072222DD-E169-4C83-B05F-A8089E13CDF9",1]';

const MODEL = process.env.FIREWORKS_MODEL || "accounts/fireworks/models/kimi-k2p6";
const FIREWORKS_CHAT_API = "https://api.fireworks.ai/inference/v1/chat/completions";
const BRAVE_SEARCH_API = "https://api.search.brave.com/res/v1/web/search";
const GDELT_DOC_API = "https://api.gdeltproject.org/api/v2/doc/doc";
const DUCKDUCKGO_API = "https://api.duckduckgo.com/";
const GOOGLE_NEWS_RSS = "https://news.google.com/rss/search";
const MAX_FETCH_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 12000;
const GOOGLE_AI_OVERVIEW_TIMEOUT_MS = 15000;
const USER_AGENT = "Mozilla/5.0 (compatible; VerityLab/1.0; +https://example.local)";
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const VERIFICATION_SYSTEM_PROMPT = `You are a rigorous, neutral fact-verification engine.
Your sole purpose is to assess the credibility of a submitted claim or article by reasoning over provided evidence and producing a structured, auditable verdict.
Do not editorialize, speculate beyond the evidence, take political positions, or fabricate evidence.
Use a private verification checklist: claim extraction, evidence alignment, source quality, social/context signals when provided, and final synthesis.
Do not reveal hidden chain-of-thought. Return only the requested JSON object.
If a claim cannot be verified from the provided evidence, mark it as unverified through the verdict, summary, red_flags, and source support values.
Never assign CREDIBLE to a claim with zero direct corroborating evidence.`;
const DEATH_VERIFICATION_SYSTEM_PROMPT = `${VERIFICATION_SYSTEM_PROMPT}

For death-news claims, operate with heightened care. A false positive confirming a living person as dead causes severe harm, and a false negative dismissing a genuine death also causes harm.
Default to SUSPICIOUS when in doubt. Do not speculate, infer death from condolence headlines, or use general knowledge to fill evidence gaps.
Privately apply this death-news checklist: identify the named subject, extract date/cause/location/source claims, rank evidence by source hierarchy, check hoax patterns, count corroboration, then synthesize.
Treat official government records, family or representative statements through verified channels, hospitals, and major news organizations as high-trust confirmation. Treat unverified social posts, blogs, anonymous posts, satire, and low-reputation domains as insufficient on their own.
Never return CREDIBLE for a death claim unless at least one high-trust source directly reports that the named subject died.
Do not include cause or manner of death unless a high-trust source states it. Do not include private addresses, contact details, or unnecessary next-of-kin information.`;
const RUMOUR_VERIFICATION_SYSTEM_PROMPT = `${VERIFICATION_SYSTEM_PROMPT}

For circulating rumours, assess both the claim and its rumour anatomy. Rumours may contain a true kernel wrapped in false, exaggerated, or misleading elaboration.
Privately evaluate: the core kernel, added elaboration, narrative frame, entity clarity, variant or mutation signals when available, source stance, prior debunking patterns, lifecycle stage, and likely intent.
Do not assign malicious intent without explicit supporting signals. Do not infer coordination or bot activity from virality alone.
Use PARTIALLY_TRUE-style reasoning internally when the kernel is supported but the elaboration is not. In this app's schema, return SUSPICIOUS for mixed or partially true rumours unless the core claim is directly and reliably supported.
Use LIKELY FAKE when reliable evidence debunks the rumour, when a recycled debunked pattern is evident, or when satire/low-trust origin signals dominate.
Never return CREDIBLE for a rumour without strong direct corroboration from reliable independent sources.`;

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

async function loadPlaywrightChromium() {
  const dynamicImport = new Function("specifier", "return import(specifier)") as (
    specifier: string
  ) => Promise<{ chromium?: unknown }>;
  const mod = await dynamicImport("playwright");
  return mod.chromium as
    | {
        launch: (options: { headless: boolean; timeout: number }) => Promise<{
          newPage: () => Promise<{
            goto: (url: string, options: { waitUntil: "domcontentloaded"; timeout: number }) => Promise<unknown>;
            waitForTimeout: (timeout: number) => Promise<void>;
            waitForSelector: (selector: string, options: { timeout: number }) => Promise<unknown>;
            evaluate: <T>(pageFunction: () => T) => Promise<T>;
          }>;
          close: () => Promise<void>;
        }>;
      }
    | undefined;
}

function cleanOverviewText(value: string) {
  return value
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((line, index, lines) => lines.indexOf(line) === index)
    .join("\n")
    .replace(/\bShow more\b[\s\S]*$/i, "")
    .trim()
    .slice(0, 2500);
}

async function scrapeGoogleAiOverview(query: string): Promise<GoogleAiOverview | null> {
  if (process.env.GOOGLE_AI_OVERVIEW_SCRAPE !== "1") return null;

  const chromium = await loadPlaywrightChromium();
  if (!chromium) throw new Error("Playwright chromium is unavailable.");

  const params = new URLSearchParams({ q: query, hl: "en", gl: "US" });
  const url = `https://www.google.com/search?${params}`;
  const browser = await chromium.launch({
    headless: true,
    timeout: GOOGLE_AI_OVERVIEW_TIMEOUT_MS
  });

  try {
    const page = await browser.newPage();
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: GOOGLE_AI_OVERVIEW_TIMEOUT_MS
    });
    await page.waitForTimeout(3500);
    await page.waitForSelector("body", { timeout: 5000 });

    const rawText = await page.evaluate(() => {
      function isVisible(element: Element) {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      }

      const elements = Array.from(document.querySelectorAll("div, section, article")).filter(isVisible);
      const overviewLabel = elements.find((element) => /\bAI Overview\b/i.test(element.textContent || ""));
      if (!overviewLabel) return "";

      let bestText = "";
      let current: Element | null = overviewLabel;
      for (let depth = 0; current && depth < 8; depth += 1) {
        const text = (current.textContent || "").replace(/\s+/g, " ").trim();
        const hasOverview = /\bAI Overview\b/i.test(text);
        const hasUsefulLength = text.length > 80 && text.length < 5000;
        const excludesWholePage =
          !/\bPeople also ask\b/i.test(text) ||
          text.indexOf("People also ask") > Math.max(text.indexOf("AI Overview"), 0) + 1000;

        if (hasOverview && hasUsefulLength && excludesWholePage) {
          bestText = text;
        }
        current = current.parentElement;
      }

      return bestText;
    });

    const text = cleanOverviewText(rawText);
    if (!text || !/\bAI Overview\b/i.test(text)) return null;

    return {
      query,
      url,
      text
    };
  } finally {
    await browser.close();
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
  if (
    /nytimes|washingtonpost|theguardian|cnn|cnbc|npr|aljazeera|thehindu|indianexpress|hindustantimes|ndtv|timesofindia|economictimes|the economic times|the times of india/.test(
      haystack
    )
  ) {
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
  return `You are not browsing live. The server already searched and fetched web pages for you.

Analyze the claim using ONLY the evidence below. If evidence is weak or contradictory, say so.
Today's date is ${currentDateLabel()}. Dates before today are in the past. Dates after today are in the future. Do not reject 2026 evidence as future-dated unless it is after today's date.
When reliable sources report a death or other dated event before today's date, treat it as current historical evidence, not as a hoax solely because older fact-checks debunked earlier rumors.
If a submitted URL fetch is blocked with HTTP 403 or another access error, do not treat that as evidence against the claim. Use search results and other fetched sources for corroboration.
For death claims, be strict about who died. Headlines such as "X mourns Y's death", "X condoles Y's death", or "X pays tribute after Y died" are evidence about Y, not evidence that X died.

Apply this verification rubric privately before producing JSON:
1. Extract each distinct factual claim. Ignore opinions.
2. Classify evidence for each factual claim as SUPPORTS, CONTRADICTS, TANGENTIAL, or ABSENT.
3. Weigh source quality, recency, corroboration, and red flags. Prefer 3 or more independent reliable sources for high confidence.
4. Treat high virality, poor domain reputation, or known disinformation context as reasons for extra scrutiny when such signals are present. Do not treat virality alone as truth or falsity.
5. Synthesize which claims are supported, contradicted, or unverifiable. If evidence is partial, ambiguous, or only tangential, reduce confidence.

Verdict mapping:
- Use CREDIBLE only when the core claim is directly supported by reliable evidence.
- Use SUSPICIOUS when evidence is incomplete, mixed, low quality, or unverifiable.
- Use LIKELY FAKE when reliable evidence contradicts the claim or the available evidence fails to support a high-impact claim that should have clear corroboration.

Edge-case rules:
- If the claim is under 20 characters or has no verifiable factual claim, return SUSPICIOUS with confidence no higher than 20.
- If search results and fetched pages contain no usable evidence, return SUSPICIOUS with confidence no higher than 40.
- If you mention a source in "sources", set supports=true only when that source directly supports the submitted claim. Tangential sources must use supports=false.
- Keep the summary neutral, plain-language, and 2-3 sentences at most.

Death-news rules:
- Treat death claims as high-risk. Default to SUSPICIOUS unless the named subject's death is directly corroborated.
- Do not infer that X died from headlines saying X mourns, condoles, comments on, pays tribute to, or attends events about someone else's death.
- A CREDIBLE death verdict requires at least one high-trust source directly reporting that the named subject died. Major news, official records, hospitals, or verified family/representative statements count as high-trust.
- Unverified social posts, blogs, anonymous posts, satire, and low-reputation domains do not confirm a death on their own.
- Do not mention cause or manner of death unless a high-trust source states it. Avoid unnecessary private family details.

Rumour-verification rules:
- Rumours can be partly true. Separate the smallest verifiable kernel from exaggerated or unsupported elaboration.
- If the kernel is supported but the elaboration is not, return SUSPICIOUS and explain the mixed evidence in neutral language.
- If a reliable fact-check, official source, or major source directly refutes the rumour, return LIKELY FAKE.
- If a rumour appears recycled from an earlier debunked claim, satire-originated, or based only on anonymous/social/blog sources, do not return CREDIBLE.
- Do not infer intent such as coordinated campaign or political operation unless there are explicit propagation or source signals in the evidence.
- Do not repeat unsupported sensational details in the summary unless needed to identify what is being assessed.

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

function parseGeminiWebStream(responseStr: string): string {
  let clean = responseStr.trim();
  if (clean.startsWith(")]}'")) {
    clean = clean.slice(4).trim();
  }

  let fullResponseText = "";
  const lines = clean.split("\n");
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (/^\d+$/.test(line)) {
      continue;
    }

    try {
      const parsedChunk = JSON.parse(line);
      if (Array.isArray(parsedChunk)) {
        for (const item of parsedChunk) {
          if (Array.isArray(item) && item[0] === "wrb.fr") {
            const innerStr = item[2];
            if (innerStr) {
              const innerJson = JSON.parse(innerStr);
              let text = "";
              
              if (
                innerJson &&
                Array.isArray(innerJson[4]) &&
                innerJson[4][0] &&
                Array.isArray(innerJson[4][0][1]) &&
                typeof innerJson[4][0][1][0] === "string"
              ) {
                text = innerJson[4][0][1][0];
              } else {
                // Fallback recursive search
                let longest = "";
                const search = (val: any) => {
                  if (typeof val === "string") {
                    if (
                      val.length > longest.length &&
                      !val.startsWith("c_") &&
                      !val.startsWith("r_") &&
                      !val.startsWith("//www.google") &&
                      !val.startsWith("https://")
                    ) {
                      longest = val;
                    }
                  } else if (Array.isArray(val)) {
                    for (const v of val) search(v);
                  } else if (val && typeof val === "object") {
                    for (const k in val) search(val[k]);
                  }
                };
                search(innerJson);
                text = longest;
              }

              if (text.length > fullResponseText.length) {
                fullResponseText = text;
              }
            }
          }
        }
      }
    } catch {
      // Ignore parser errors for incomplete stream lines
    }
  }

  return fullResponseText;
}

async function askGeminiWebRaw(prompt: string, systemPrompt = VERIFICATION_SYSTEM_PROMPT): Promise<string> {
  const cookies = process.env.GEMINI_COOKIES || HARDCODED_GEMINI_COOKIES;
  const atToken = process.env.GEMINI_AT_TOKEN || HARDCODED_GEMINI_AT_TOKEN;
  const fSid = process.env.GEMINI_F_SID || HARDCODED_GEMINI_F_SID;
  const blVersion = process.env.GEMINI_BL_VERSION || HARDCODED_GEMINI_BL_VERSION;

  if (!cookies || !atToken) {
    throw new Error("GEMINI_COOKIES or GEMINI_AT_TOKEN is not configured.");
  }

  const reqId = process.env.GEMINI_REQID || String(Math.floor(1000000 + Math.random() * 9000000));
  const url = `https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?bl=${blVersion}&f.sid=${fSid}&hl=en-IN&_reqid=${reqId}&rt=c`;

  const combinedPrompt = `${systemPrompt}\n\n${prompt}`;
  const extUuid = process.env.GEMINI_X_GOOG_EXT
    ? JSON.parse(process.env.GEMINI_X_GOOG_EXT)[0]
    : JSON.parse(HARDCODED_GEMINI_X_GOOG_EXT)[0];

  const baseInnerReq = [
    [combinedPrompt, 0, null, null, null, null, 0],
    ["en-IN"],
    ["", "", "", null, null, null, null, null, null, ""],
    "!srGlsdXNAAawTOh1kExC14BodVE_8AA7AEABEArZ1EWyUNawL5JaT6oQS_qSIL_U6hhkF52tK-WiCdZ3gzu6ezpCPB2xeOxCjdk8QPOtnmYlnoQqszMcfHLtAgAAAV5SAAAAC2gBB34ARKXkiRJzZrGVUYIv8QDnJ15ynz9XDcb3W3Pr_dPmlFwoIBjhh8DGSQ6Vc49SrOUOdwTZVZVb7MBFIYW-EptanzWdNBaCmQb3wAcJU-AikFf5jXae56kX8gYQjNbhPWKEf3I7Vm5a-bmYbC-SRbLd4hF3lN9tmP5rF5tonklPreH-D1nuaaz_87TlPbsrOyrADDXgTorPdKd6s7a7qejk9032QGhwblKIrYrfuM7pSXoluqsTD5rZKRuMaKNevkwM3nOx0YJHaJgbs51mPCLmJ9ifxYls08zoQcY9o22-l6pFJFc0JNIFfpXa8k83dxa0LeqiQW65lJI-J0O4cnYBmPXssGD3XZzcEqj69kNTMPEnP6jtcZ9qvPAZfBjEBEd8XcVzmQy64Qa_3EoYdTy1oWNfc-aK-6yEyqwxVjAi_N03fMCWmQhz8N_t21UvIQK1zi59xR0A-l6Khvq8GTRN7v9zh2Etsri-UMhW3GpluMOpOFdDcU9hmgL8uv5EnTWOQtvT8EeY1Y97LYfXKQ2oVuPQrcpcTOAbWbhrNXjG28zf6cqaMviDbbHttx8PGOuPpM1lAQFceEFJx6THZBYIIzmR907riOQfPCG1_xWDYLlgUqwoAafc-rBDS6Mdk7RHEErqnvTlZ7roaXnbjAuTu-DmDzjtP426B2QFj_kQKPsFZX-D-hoOYaMtDyXsz-CEGkaWH-9kkTUw-6E2MPTIv3aXMOvbTQolIf4xa46nkYEFJt9kwyqShXMlM0tkTtLV0Re1PS8FliWq0f1T3hs6b94WnP10vvJM8lpC2I7gWN-zb-BDhM-z71IphwYpKeVwIco6rK86NS-6TrAAWYIxdOxsVAnackHQ1ZKGyqtJUhpr2SqcrJGhQ5pLd0XqF1O81g4YMK9tTcYX-MesAv8pwIlZ_ony04SzeQbTHk6YjpzjfuC3wdiiJUwj0XpbpSXHpKi9D7j1z5NV4K1FxggHOQli8MQAb2QVBKxXn2Tk4ml4ftwuKc26TSX-iDIHhxamSOZS8EnEzujfrIqg98Aw2TGDKhY-ffDG3ribvoZtIKnEbyFm7HpFAHOJQ7byQ3upbl8mPlhZb61eMd_qqBB7kklqwQPvfNJPzr5D0t_ti-w9XbwHxqwcnY7nv25LaJBgpuVlvJFI2WLgbGjyEaY0msMdSw0LLpansOm4UE-XdshcCJQBsjJREH6eCHotSTf4lHHn6xN1jC7Z8mcZ8LLWCUWQw4u9ATOh-rEWKJNI1ptYt4dodJhwiGXhrBNv2saZyAHb_VlUmkOTX4LSYyShupHzDZQzq_uCSTgdnV7BALQuZuRkJqXoH-uUw5tQFKwZxvJvZq1LLIZ54FXD63ez4SgB-Z-xbV9BdFRoLSMf3MizfLTxx0RIn7bkaYwdW7UUx1VH8jjfTPA1o-5Y-A9sdW7lF4oHtQ2N9QHbx8YWwa993XXuO5nr0SnTNyoHYPNusY07MAhYfGFFINzav7yBt5QxnwInd_fF5l3KF5mmk1bfuvx746-EjbUg7eSCg2aaR_nMJXx8UVr7jFmG-oUFQL0R9ycuWRXZYKc11Bf0KDXPXVLYeIwCl9owvl9NYRiKWJsFX_clxkF2j4__wgusiJMLxQ_zWD2d5JAavayXlSrzbs57BNntsehnJxJZcaVwA_tS9fJkVJfWQ4lvakC6Uy0dZL318lUlWZHoj-EQEXgXE3_Gp3w8LOcXikU54o-IZsU0MNgBRzM4qWv3fQ05C_o0NUKl-6Q6h_5jaOA-4YhPh1OI3gOl9m-Z1Vy0qQHN2rTjxy6yrvNxkjpx41tRnZO2j9FPa2GYfpwX6DoztSkmUj7rjiwGLshlxL0pB_i87dpbHVC7S262oW_gXsEH8b6q-aOJJs_prqVl0Xe7Q95xtLjEUPg2IWcUVrr-lFgw-GQUWlWtLpiTzNZBP-NL6gSryI2mfa-7JE6isc3uWHAwlfXnmC6kb1YbW9NKcd3nWwLzi8bNCda1YrQaPzco8Kh6xx8I-6FZ7yZPqRUHX51f-_TwQ5HtRL2Dkyd5oHiYqKAZoE941uhpuAe1OH3taYj0kuj8UmQ5x_VBjFgFp40PIDACIUJICAX_ETLLgNMIF_c0CNrLK3jU3Y10eeep05O82VVoAg1vMp5VTOvIYqOFHJRz-KVTKI0GIDky2k60xNJKCHMTgEZ-_1PMcxpFYrXLKxNI99wKNbomHe2bNb9bMhNycbXu3jKPlWQ8F4mvD1sAG8K4tgwW0Ph6OCQb4E36-Lk3Z19_n4a6eEDrrwCSeKupQATB2uk7JECcfd4aO8HICU7YS3NQduifk8ympuWOnPfvd5RpeoVRqrXVvFeIsTaXfZK93Cu06kM3Y860cuHZ02nVYTXqNZba_UmsCKAoT1MGzcfirG8Izc_5bPnYhB_jx3J_fx3XPXU2jrwZ80DB0_JazNlk7d6M6ZBdB0PhlQSSXwBbc6C3SU6uA",
    "d4262f4a2c6eb6b2aea915ace8ef9974",
    null,
    [1],
    1,
    null,
    null,
    1,
    0,
    null,
    null,
    null,
    null,
    null,
    [[0]],
    0,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    1,
    null,
    null,
    [4],
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    [1],
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    0,
    null,
    null,
    null,
    null,
    null,
    extUuid,
    null,
    [],
    null,
    null,
    null,
    null,
    null,
    0,
    2,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    1,
    1
  ];

  const fReq = JSON.stringify([null, JSON.stringify(baseInnerReq)]);

  const bodyParams = new URLSearchParams();
  bodyParams.append("f.req", fReq);
  bodyParams.append("at", atToken);

  const extJspbHeader = process.env.GEMINI_X_GOOG_EXT || HARDCODED_GEMINI_X_GOOG_EXT;

  const headers: Record<string, string> = {
    'accept': '*/*',
    'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8,hi;q=0.7',
    'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
    'cookie': cookies,
    'origin': 'https://gemini.google.com',
    'priority': 'u=1, i',
    'referer': 'https://gemini.google.com/',
    'sec-ch-ua': '"Chromium";v="148", "Google Chrome";v="148", "Not/A)Brand";v="99"',
    'sec-ch-ua-arch': '"x86"',
    'sec-ch-ua-bitness': '"64"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-model': '""',
    'sec-ch-ua-platform': '"Windows"',
    'sec-ch-ua-platform-version': '"19.0.0"',
    'sec-ch-ua-wow64': '?0',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
    'x-browser-channel': 'stable',
    'x-browser-copyright': 'Copyright 2026 Google LLC. All Rights Reserved.',
    'x-browser-validation': 'puPtlXuojC+VILE1bgaJ40YGt+E=',
    'x-browser-year': '2026',
    'x-client-data': 'CKmdygEIk6HLAQiFoM0BCMW/zwEIy8eUMAjlx5QwCLrJlDAI68mUMAiqypQwCP7KlDAI8MuUMA==',
    'x-goog-ext-525001261-jspb': '[1,null,null,null,"56fdd199312815e2",null,null,0,[4,5,6,8],null,null,2,null,null,1,1,"70A5EBE0-9CE1-44EB-AC82-9965B303C17A"]',
    'x-goog-ext-525005358-jspb': extJspbHeader,
    'x-goog-ext-73010989-jspb': '[0]',
    'x-goog-ext-73010990-jspb': '[0,0,0]',
    'x-same-domain': '1'
  };

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: bodyParams.toString()
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Gemini StreamGenerate failed with status ${response.status}.`);
  }

  const responseText = await response.text();
  const parsed = parseGeminiWebStream(responseText);
  
  if (!parsed) {
    throw new Error("Failed to extract text from Gemini Web response stream. The stream may be empty or authorization expired.");
  }
  
  return parsed;
}

async function askKimiRaw(apiKey: string, prompt: string, systemPrompt = VERIFICATION_SYSTEM_PROMPT) {
  const provider = process.env.LLM_PROVIDER || HARDCODED_LLM_PROVIDER;
  if (provider === "gemini_web") {
    return askGeminiWebRaw(prompt, systemPrompt);
  }

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
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Fireworks failed with status ${response.status}.`);
  }

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content || "";
}

async function askKimiForVerdict(
  apiKey: string,
  prompt: string,
  repairPrompt: (rawText: string) => string,
  systemPrompt = VERIFICATION_SYSTEM_PROMPT
) {
  const text = await askKimiRaw(apiKey, prompt, systemPrompt);

  try {
    return JSON.parse(extractJson(text));
  } catch {
    const repaired = await askKimiRaw(apiKey, repairPrompt(text), systemPrompt);
    return JSON.parse(extractJson(repaired));
  }
}

function normalizeVerdict(value: unknown, evidence: SearchEvidence[], claim: string): VerdictResult {
  const input = (value || {}) as Partial<VerdictResult>;
  const allowedVerdicts = ["CREDIBLE", "SUSPICIOUS", "LIKELY FAKE"] as const;
  const rawVerdict = String(input.verdict || "").toUpperCase();
  const mappedVerdict =
    rawVerdict === "CONFIRMED" || rawVerdict === "LIKELY_TRUE"
      ? "CREDIBLE"
      : rawVerdict === "UNVERIFIED" || rawVerdict === "PARTIALLY_TRUE"
        ? "SUSPICIOUS"
        : rawVerdict === "LIKELY_FALSE" ||
            rawVerdict === "DEBUNKED" ||
            rawVerdict === "RECYCLED_DISINFO" ||
            rawVerdict === "SATIRE_ESCAPED" ||
            rawVerdict === "HOAX_PATTERN_DETECTED"
          ? "LIKELY FAKE"
          : rawVerdict;
  let verdict = allowedVerdicts.includes(mappedVerdict as VerdictResult["verdict"])
    ? (mappedVerdict as VerdictResult["verdict"])
    : "SUSPICIOUS";

  const fallbackSources = evidence
    .flatMap((item) => item.results)
    .slice(0, 6)
    .map((source) => ({ title: source.title, url: source.url, supports: false }));
  const modelSources =
    Array.isArray(input.sources) && input.sources.length
      ? input.sources.filter((source) => source?.title && source?.url)
      : [];
  const sources = modelSources.length ? modelSources : fallbackSources;
  const hasSearchEvidence = evidence.some((item) => item.results.length > 0);
  const hasDirectSupport = sources.some((source) => source.supports === true);
  const deathSubject = extractDeathSubject(claim);
  const deathEvidenceSources = deathSubject
    ? [
        ...evidence.flatMap((item) => item.results),
        ...sources.map((source) => ({ title: source.title, url: source.url, snippet: "" }))
      ].filter((source) => supportsDeathClaim(source, deathSubject))
    : [];
  const hasHighTrustDeathSupport = deathEvidenceSources.some((source) => sourceScore(source) >= 70);

  let confidence = Number.isFinite(Number(input.confidence))
    ? Math.max(0, Math.min(100, Number(input.confidence)))
    : 50;

  if (verdict === "CREDIBLE" && !hasDirectSupport) {
    verdict = "SUSPICIOUS";
    confidence = Math.min(confidence, 55);
  }

  if (deathSubject && verdict === "CREDIBLE" && !hasHighTrustDeathSupport) {
    verdict = "SUSPICIOUS";
    confidence = Math.min(confidence, 60);
  }

  if (!hasSearchEvidence) {
    verdict = verdict === "LIKELY FAKE" ? "LIKELY FAKE" : "SUSPICIOUS";
    confidence = Math.min(confidence, 40);
  }

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
    confidence,
    summary:
      input.summary ||
      "The app searched and fetched sources, but the model returned an incomplete verdict. Review the listed sources directly.",
    sources,
    signals,
    red_flags:
      (verdict === "CREDIBLE" || hasDirectSupport) && (!deathSubject || hasHighTrustDeathSupport)
        ? Array.isArray(input.red_flags)
          ? input.red_flags
          : ["Incomplete model verdict."]
        : [
            ...(Array.isArray(input.red_flags) ? input.red_flags : ["Incomplete model verdict."]),
            deathSubject && !hasHighTrustDeathSupport
              ? "No high-trust source directly confirmed the death claim."
              : "No direct supporting source was provided for the core claim."
          ],
    positive_indicators: Array.isArray(input.positive_indicators) ? input.positive_indicators : []
  };
}

function buildCredibilityOverview(result: VerdictResult, claim: string): CredibilityOverview {
  const deathSubject = extractDeathSubject(claim);
  const marriageClaim = extractMarriageClaim(claim);
  const supportingSources = result.sources.filter((source) => source.supports);
  const nonSupportingSources = result.sources.filter((source) => !source.supports);
  const firstRedFlag = result.red_flags[0];
  const firstPositive = result.positive_indicators[0];

  if (deathSubject && result.verdict !== "CREDIBLE") {
    return {
      headline: result.verdict === "LIKELY FAKE" ? "Death claim likely false" : "Death claim unverified",
      short_answer:
        result.verdict === "LIKELY FAKE"
          ? `No reliable source directly reports that ${deathSubject} died.`
          : `The available sources do not confirm that ${deathSubject} died.`,
      confidence_reason:
        "Death reports require direct confirmation from a high-trust source, not tangential mentions or condolence headlines.",
      key_points: [
        supportingSources.length
          ? `${supportingSources.length} source${supportingSources.length === 1 ? "" : "s"} marked as directly supportive.`
          : "No high-trust source directly confirms the death claim.",
        firstRedFlag || "Tangential death-related results are not treated as confirmation.",
        "Manual review is recommended before treating death news as confirmed."
      ],
      caveat: "This overview is based on the sources fetched during this audit."
    };
  }

  if (marriageClaim) {
    const answer =
      result.verdict === "CREDIBLE"
        ? `Yes, available sources support that ${marriageClaim.personA} is married to ${marriageClaim.personB}.`
        : result.verdict === "LIKELY FAKE"
          ? `No, available sources do not show that ${marriageClaim.personA} is married to ${marriageClaim.personB}.`
          : `The claim that ${marriageClaim.personA} is married to ${marriageClaim.personB} is not fully verified.`;

    return {
      headline:
        result.verdict === "CREDIBLE"
          ? "Marriage claim appears credible"
          : result.verdict === "LIKELY FAKE"
            ? "Marriage claim likely false"
            : "Marriage claim unverified",
      short_answer: answer,
      confidence_reason:
        result.verdict === "CREDIBLE"
          ? firstPositive || "The cited evidence directly supports the relationship claim."
          : firstRedFlag || "The audit did not find direct reliable evidence for the marriage claim.",
      key_points: [
        supportingSources.length
          ? `${supportingSources.length} source${supportingSources.length === 1 ? "" : "s"} marked as directly supportive.`
          : "No direct supporting source was accepted for the marriage claim.",
        nonSupportingSources.length
          ? `${nonSupportingSources.length} source${nonSupportingSources.length === 1 ? "" : "s"} did not support the claim.`
          : "Search evidence was not strong enough to verify the relationship.",
        "Check the listed sources for relationship status and date context."
      ],
      caveat: "This overview reflects the sources fetched during this audit."
    };
  }

  if (result.verdict === "CREDIBLE") {
    return {
      headline: "Claim appears credible",
      short_answer: "Yes, the available sources directly support the main claim.",
      confidence_reason:
        supportingSources.length > 1
          ? "Multiple cited sources are marked as supporting the claim."
          : "At least one cited source is marked as supporting the claim.",
      key_points: [
        firstPositive || "The core claim is supported by the cited evidence.",
        `${supportingSources.length || 1} supporting source${supportingSources.length === 1 ? "" : "s"} found.`,
        "Review the source links for the full context."
      ],
      caveat: "Credibility can change if newer or stronger sources appear."
    };
  }

  if (result.verdict === "LIKELY FAKE") {
    return {
      headline: "Claim likely false",
      short_answer: "No, the available evidence does not support the claim.",
      confidence_reason:
        firstRedFlag || "The audit found missing, tangential, or contradictory support for the main claim.",
      key_points: [
        supportingSources.length
          ? "Some evidence was marked supportive, but stronger checks lowered the verdict."
          : "No direct supporting source was accepted for the core claim.",
        nonSupportingSources.length
          ? `${nonSupportingSources.length} source${nonSupportingSources.length === 1 ? "" : "s"} did not support the claim.`
          : "Search evidence was not strong enough to verify the claim.",
        "Treat viral or sensational wording with caution unless reliable sources confirm it."
      ],
      caveat: "This is not a permanent judgment; it reflects the sources available during this run."
    };
  }

  return {
    headline: "Claim needs caution",
    short_answer: "This claim is not fully verified by the available evidence.",
    confidence_reason:
      firstRedFlag || "The audit did not find enough direct corroboration for a confident true or false verdict.",
    key_points: [
      supportingSources.length
        ? `${supportingSources.length} source${supportingSources.length === 1 ? "" : "s"} may support part of the claim.`
        : "No clear direct support was found for the core claim.",
      firstPositive || "Some search results may be useful for manual review.",
      "Hold the claim as unverified until stronger evidence is available."
    ],
    caveat: "This overview summarizes automated search and source analysis."
  };
}

function withCredibilityOverview(result: VerdictResult, claim: string): VerdictResult {
  return {
    ...result,
    overview: result.overview || buildCredibilityOverview(result, claim)
  };
}

function applyGoogleOverviewSignal(result: VerdictResult, overview: GoogleAiOverview | null): VerdictResult {
  if (!overview?.text) return result;

  const text = overview.text.replace(/\bAI Overview\b/i, "").trim();
  const firstPassage = text.slice(0, 700);
  const saysNo = /\bno,\s+.{0,180}\b(?:not|is not|are not|was not|were not|has not|have not|did not|does not|no evidence|false)\b/i.test(
    firstPassage
  );
  const saysYes = /\byes,\s+.{0,180}\b(?:is|are|was|were|has|have|did|does|confirmed|true)\b/i.test(firstPassage);
  const overviewSource = {
    title: "Google AI Overview",
    url: overview.url,
    supports: saysYes
  };

  if (saysNo) {
    return {
      ...result,
      verdict: "LIKELY FAKE",
      confidence: Math.max(result.confidence, 82),
      summary: `No, Google's AI Overview contradicts the claim. ${result.summary}`,
      sources: [overviewSource, ...result.sources.filter((source) => source.url !== overview.url)],
      red_flags: ["Google AI Overview gives a direct negative answer for this claim.", ...result.red_flags],
      positive_indicators: result.positive_indicators
    };
  }

  if (saysYes && result.verdict !== "LIKELY FAKE") {
    return {
      ...result,
      verdict: "CREDIBLE",
      confidence: Math.max(result.confidence, 76),
      summary: `Yes, Google's AI Overview supports the claim. ${result.summary}`,
      sources: [overviewSource, ...result.sources.filter((source) => source.url !== overview.url)],
      red_flags: result.red_flags,
      positive_indicators: ["Google AI Overview gives a direct positive answer for this claim.", ...result.positive_indicators]
    };
  }

  return {
    ...result,
    sources: [overviewSource, ...result.sources.filter((source) => source.url !== overview.url)]
  };
}

function extractDeathSubject(claim: string) {
  return claim
    .trim()
    .match(/^(.+?)\s+(?:has\s+)?(?:died|dead|passed away|is dead)\b/i)?.[1]
    ?.trim();
}

function cleanClaimEntity(value: string) {
  return value
    .replace(/^["'\s]+|["'.?!\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function extractMarriageClaim(claim: string) {
  const compact = claim.replace(/\s+/g, " ").trim();
  const patterns = [
    /^(.+?)\s+(?:is|was|has been)\s+married\s+to\s+(.+?)\.?$/i,
    /^(.+?)\s+(?:got\s+married|married|wed|wedded)\s+(.+?)\.?$/i,
    /^(.+?)\s+and\s+(.+?)\s+(?:are|were|got)\s+married\.?$/i
  ];

  for (const pattern of patterns) {
    const match = compact.match(pattern);
    if (!match) continue;
    const personA = cleanClaimEntity(match[1]);
    const personB = cleanClaimEntity(match[2]);
    if (!personA || !personB || personA.length > 80 || personB.length > 80) continue;
    return { personA, personB };
  }

  return null;
}

function normalizeForClaimMatch(value: string) {
  return value
    .toLowerCase()
    .replace(/(?:'|\u2019)s\b/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function deathSubjectAliases(subject: string) {
  const normalized = normalizeForClaimMatch(subject);
  const words = normalized.split(" ").filter((word) => word.length > 2);
  const aliases = new Set<string>();

  if (normalized) aliases.add(normalized);
  if (words.length >= 2) aliases.add(words[words.length - 1]);

  if (/\bnarendra\s+modi\b/.test(normalized)) {
    aliases.add("pm modi");
    aliases.add("prime minister modi");
    aliases.add("modi");
  }

  return [...aliases].filter(Boolean);
}

function isThirdPartyDeathContext(text: string, aliases: string[]) {
  const thirdPartyPatterns = [
    /\b(condoles?|mourns?|mourned|grieves?|grieved|pays? tribute|paid tribute|express(?:es|ed) (?:grief|condolences|sorrow)|saddened by)\b/,
    /\bon .* death anniversary\b/
  ];

  return aliases.some((alias) => {
    const escaped = escapeRegex(alias);
    return thirdPartyPatterns.some((pattern) => new RegExp(`\\b${escaped}\\b.{0,80}${pattern.source}|${pattern.source}.{0,80}\\b${escaped}\\b`, "i").test(text));
  });
}

function supportsDeathClaim(source: SearchResult, subject: string) {
  const title = normalizeForClaimMatch(source.title);
  const snippet = normalizeForClaimMatch(source.snippet || "");
  const haystack = `${title} ${snippet}`.trim();
  const aliases = deathSubjectAliases(subject);

  if (!haystack || isThirdPartyDeathContext(haystack, aliases)) return false;

  return aliases.some((alias) => {
    const escaped = escapeRegex(alias);
    const subjectThenDeath = new RegExp(`\\b${escaped}\\b.{0,60}\\b(?:dies|died|dead|has died|passes away|passed away)\\b`, "i");
    const deathThenSubject = new RegExp(`\\b(?:death|obituary)\\b.{0,60}\\b${escaped}\\b`, "i");
    return subjectThenDeath.test(haystack) || deathThenSubject.test(haystack);
  });
}

function fallbackVerdictFromEvidence(evidence: SearchEvidence[], claim: string): VerdictResult {
  const sources = evidence
    .flatMap((item) => item.results)
    .slice(0, 6)
    .map((source) => ({ title: source.title, url: source.url, supports: false }));

  const deathSubject = extractDeathSubject(claim);
  if (deathSubject) {
    const directDeathSources = evidence
      .flatMap((item) => item.results)
      .filter((source) => supportsDeathClaim(source, deathSubject))
      .slice(0, 6);
    const highTrustSupportingSources = directDeathSources.filter((source) => sourceScore(source) >= 70);
    const supportingSources = highTrustSupportingSources.map((source) => ({
      title: source.title,
      url: source.url,
      supports: true
    }));

    if (supportingSources.length >= 1) {
      return {
        verdict: "CREDIBLE",
        confidence: Math.min(90, 78 + supportingSources.length * 4),
        summary: `Yes, a high-trust source directly reports that ${deathSubject} died. The claim should still be reviewed against the cited source because automated JSON synthesis failed.`,
        sources: supportingSources,
        signals: [
          { name: "Emotional Language", score: 3, note: "The claim is brief and factual." },
          { name: "Source Quality", score: 8, note: "At least one high-trust source directly reports the death." },
          { name: "Logical Consistency", score: 8, note: "The source title directly matches the submitted death claim." },
          { name: "Factual Accuracy", score: 8, note: "The fallback evidence supports the core death claim." },
          { name: "Bias Indicators", score: 3, note: "No clear bias indicators in the short claim." },
          { name: "Headline Accuracy", score: 8, note: "The claim matches the reported headlines." }
        ],
        red_flags: ["The model verdict JSON still failed, so this result was inferred from search evidence."],
        positive_indicators: ["A high-trust source directly reports the death."]
      };
    }

    if (directDeathSources.length) {
      return {
        verdict: "SUSPICIOUS",
        confidence: 55,
        summary: `The claim that ${deathSubject} died is not confirmed by a high-trust source in the available results. Low-trust or unclear sources are not enough to confirm death news.`,
        sources: directDeathSources.map((source) => ({ title: source.title, url: source.url, supports: false })),
        signals: [
          { name: "Emotional Language", score: 4, note: "The claim is short, but death claims require heightened care." },
          { name: "Source Quality", score: 4, note: "Direct death mentions were found, but not from high-trust sources." },
          { name: "Logical Consistency", score: 6, note: "Some results match the claim, but source quality is insufficient." },
          { name: "Factual Accuracy", score: 5, note: "The fallback evidence is not strong enough to confirm the claim." },
          { name: "Bias Indicators", score: 5, note: "Manual review is needed." },
          { name: "Headline Accuracy", score: 5, note: "Direct mentions require verification from stronger sources." }
        ],
        red_flags: [
          "No high-trust source directly confirmed the death claim.",
          "Death news should be held for verification when only low-trust sources report it."
        ],
        positive_indicators: ["Some results directly mention the death claim."]
      };
    }

    if (sources.length) {
      return {
        verdict: "LIKELY FAKE",
        confidence: 72,
        summary: `No, the available search results do not directly support the claim that ${deathSubject} died. The death-related results found are not direct reports of ${deathSubject}'s death, so the claim should be treated as likely false unless a reliable source explicitly reports it.`,
        sources,
        signals: [
          { name: "Emotional Language", score: 4, note: "The claim is short, but death claims are high-impact and need direct corroboration." },
          { name: "Source Quality", score: 4, note: "Search results were found, but none directly report the subject's death." },
          { name: "Logical Consistency", score: 7, note: "The available result titles do not match the submitted death claim." },
          { name: "Factual Accuracy", score: 3, note: "The fallback evidence does not support the core claim." },
          { name: "Bias Indicators", score: 4, note: "No clear bias signal, but the claim lacks direct sourcing." },
          { name: "Headline Accuracy", score: 3, note: "Death-related headlines appear to be about other people or events, not the subject dying." }
        ],
        red_flags: [
          "No reliable search result directly reports the subject's death.",
          "Death-related results can mention the subject mourning or commenting on someone else's death."
        ],
        positive_indicators: ["The app found search results that can be inspected manually."]
      };
    }
  }

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
  const provider = process.env.LLM_PROVIDER || HARDCODED_LLM_PROVIDER;
  const apiKey = process.env.FIREWORKS_API_KEY;
  if (provider === "fireworks" && !apiKey) {
    send(controller, {
      type: "error",
      message: "Missing FIREWORKS_API_KEY. Add it to environment variables and restart."
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
  let googleOverview: GoogleAiOverview | null = null;
  const scrapeOverview = process.env.GOOGLE_AI_OVERVIEW_SCRAPE || HARDCODED_GOOGLE_AI_OVERVIEW_SCRAPE;
  if (scrapeOverview === "1") {
    send(controller, { type: "status", label: "Checking Google AI Overview...", query: searchSeed || claim });
    try {
      googleOverview = await scrapeGoogleAiOverview(searchSeed || claim);
      if (googleOverview) {
        const result = {
          title: "Google AI Overview",
          url: googleOverview.url,
          snippet: googleOverview.text
        };
        searchEvidence.push({
          query: `Google AI Overview: ${googleOverview.query}`,
          results: [result]
        });
        send(controller, {
          type: "search_results",
          query: `Google AI Overview: ${googleOverview.query}`,
          results: [result]
        });
      }
    } catch (error) {
      console.warn(error instanceof Error ? error.message : "Google AI Overview scrape failed.");
    }
  }

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
    const systemPrompt = extractDeathSubject(claim)
      ? DEATH_VERIFICATION_SYSTEM_PROMPT
      : RUMOUR_VERIFICATION_SYSTEM_PROMPT;
    const rawVerdict = await askKimiForVerdict(
      apiKey || "",
      buildVerdictPrompt(claim, searchEvidence, fetchedSources),
      (rawText) => buildRepairPrompt(claim, searchEvidence, rawText),
      systemPrompt
    );
    result = normalizeVerdict(rawVerdict, searchEvidence, claim);
  } catch (error) {
    console.warn(error instanceof Error ? error.message : "Verdict synthesis failed.");
    result = fallbackVerdictFromEvidence(searchEvidence, claim);
  }
  result = applyGoogleOverviewSignal(result, googleOverview);
  result = withCredibilityOverview(result, claim);

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
