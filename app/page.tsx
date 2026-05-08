"use client";

import { FormEvent, ReactNode, useMemo, useState } from "react";

type Source = {
  title: string;
  url: string;
  supports: boolean;
};

type Verdict = {
  verdict: "CREDIBLE" | "SUSPICIOUS" | "LIKELY FAKE";
  confidence: number;
  summary: string;
  sources: Source[];
  red_flags: string[];
  positive_indicators: string[];
};

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};

type SearchGroup = {
  query: string;
  results: SearchResult[];
};

type FetchedSource = {
  title: string;
  url: string;
  domain: string;
  ok: boolean;
  status?: number;
  error?: string;
};

const examples = [
  "Scientists confirm drinking lemon water cures diabetes overnight.",
  "NASA announces July 2026 asteroid flyby will pass safely outside Earth's orbit.",
  "A viral post claims the U.S. government banned cash transactions starting next month.",
  "Local officials say a bridge closure follows routine safety inspections, not sabotage."
];

const verdictTone = {
  CREDIBLE: "border-emerald-700 bg-emerald-50 text-emerald-950",
  SUSPICIOUS: "border-amber-700 bg-amber-50 text-amber-950",
  "LIKELY FAKE": "border-red-800 bg-red-50 text-red-950"
};

export default function Home() {
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("Idle");
  const [events, setEvents] = useState<string[]>([]);
  const [searchGroups, setSearchGroups] = useState<SearchGroup[]>([]);
  const [fetchedSources, setFetchedSources] = useState<FetchedSource[]>([]);
  const [result, setResult] = useState<Verdict | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(
    () => Boolean(text.trim() || url.trim()) && !loading,
    [text, url, loading]
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setResult(null);
    setError("");
    setEvents([]);
    setSearchGroups([]);
    setFetchedSources([]);
    setStatus("Preparing dossier...");

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text,
          url
        })
      });

      if (!response.body) throw new Error("The server did not return a stream.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const message = JSON.parse(line);

          if (message.type === "status") {
            setStatus(message.label);
            if (message.query) setEvents((current) => [...current, message.query]);
          }

          if (message.type === "search_results") {
            setSearchGroups((current) => {
              if (current.some((group) => group.query === message.query)) return current;
              return [...current, { query: message.query, results: message.results || [] }];
            });
          }

          if (message.type === "fetched_source") {
            setFetchedSources((current) => {
              if (current.some((source) => source.url === message.source?.url)) return current;
              return [...current, message.source];
            });
          }

          if (message.type === "result") {
            setStatus("Verdict ready");
            setResult(message.result);
            if (message.searchQueries?.length) {
              setEvents((current) => [...current, ...message.searchQueries]);
            }
          }

          if (message.type === "error") {
            throw new Error(message.message);
          }
        }
      }
    } catch (caught) {
      setStatus("Analysis failed");
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grain min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <section className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1.02fr_0.98fr]">
        <div className="min-h-[calc(100vh-48px)] border border-[var(--ink)] bg-[#fffaf0]/88 shadow-audit backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-[var(--ink)] px-5 py-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.26em] text-[var(--oxide)]">
                Verity Lab
              </p>
              <h1 className="font-display text-4xl font-black leading-none sm:text-6xl">
                Fake News Detector
              </h1>
            </div>
            <div className="hidden h-16 w-16 place-items-center border border-[var(--ink)] bg-[var(--midnight)] text-2xl font-black text-[#fffaf0] sm:grid">
              ?
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-5 p-5">
            <label className="block">
              <span className="mb-2 block text-sm font-black uppercase tracking-[0.14em]">
                Article text or headline
              </span>
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="Paste a claim, headline, or full article text..."
                className="min-h-48 w-full resize-y border border-[var(--ink)] bg-[#fffdf7] p-4 text-base leading-7 outline-none transition focus:shadow-[6px_6px_0_#181612]"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-black uppercase tracking-[0.14em]">
                Article URL
              </span>
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://news-site.example/story"
                className="h-12 w-full border border-[var(--ink)] bg-[#fffdf7] px-4 outline-none transition focus:shadow-[5px_5px_0_#181612]"
              />
            </label>

            <div>
              <p className="mb-2 text-sm font-black uppercase tracking-[0.14em]">
                Example claims
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {examples.map((claim) => (
                  <button
                    key={claim}
                    type="button"
                    onClick={() => setText(claim)}
                    className="border border-[var(--ink)] bg-[#fffdf7] px-3 py-3 text-left text-sm transition hover:-translate-y-0.5 hover:bg-[#181612] hover:text-[#fffaf0]"
                  >
                    {claim}
                  </button>
                ))}
              </div>
            </div>

            <button
              disabled={!canSubmit}
              className="h-14 w-full border border-[var(--ink)] bg-[var(--oxide)] text-base font-black uppercase tracking-[0.18em] text-[#fffaf0] shadow-[6px_6px_0_#181612] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-[var(--rule)] disabled:text-[var(--muted)]"
            >
              {loading ? "Analyzing..." : "Run credibility audit"}
            </button>
          </form>
        </div>

        <aside className="min-h-[calc(100vh-48px)] border border-[var(--ink)] bg-[var(--midnight)] text-[#fffaf0] shadow-audit">
          <div className="border-b border-[#fffaf0]/35 px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-[0.26em] text-[#f0c76b]">
              Analysis Desk
            </p>
            <div className="mt-2 flex items-center justify-between gap-4">
              <h2 className="font-display text-3xl font-black">Live verdict</h2>
              <span className="border border-[#fffaf0]/50 px-3 py-1 text-xs font-black uppercase tracking-[0.16em]">
                {status}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-5 p-5">
            {error && (
              <div className="border border-red-300 bg-red-950/60 p-4 text-sm text-red-100">
                {error}
              </div>
            )}

            {!result && !error && (
              <div className="grid min-h-80 place-items-center border border-dashed border-[#fffaf0]/35 p-8 text-center">
                <div>
                  <div className="mx-auto mb-5 grid h-24 w-24 place-items-center rounded-full border border-[#fffaf0]/45 text-4xl">
                    {loading ? "..." : "!"}
                  </div>
                  <p className="mx-auto max-w-sm text-sm leading-6 text-[#ddd3bd]">
                    Submit a claim or article URL. The server keeps your Fireworks API key private and returns a structured JSON credibility report.
                  </p>
                </div>
              </div>
            )}

            {(events.length > 0 || searchGroups.length > 0 || result) && (
              <div className={result ? "order-2 space-y-3" : "space-y-3"}>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-[#aab3ad]">
                  {result ? "Search process" : "Checking current public sources"}
                </p>

                <div className="relative space-y-4 pl-8 before:absolute before:left-[10px] before:top-2 before:h-[calc(100%-16px)] before:w-px before:bg-[#fffaf0]/18">
                  <TimelineItem icon="◷" title="Let me search for current information about this." />

                  {fetchedSources.map((source) => (
                    <TimelineItem
                      key={source.url}
                      icon="◎"
                      title={`Fetched submitted source: ${source.title || source.domain}`}
                    >
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 block rounded-md border border-[#fffaf0]/18 bg-[#202323] px-3 py-3 text-sm transition hover:bg-white/5"
                      >
                        <span className="block truncate text-[#f5eee1]">{source.title || source.url}</span>
                        <span className="mt-1 block truncate text-xs text-[#aab3ad]">
                          {source.ok
                            ? `Fetched from ${source.domain}`
                            : `Blocked automated fetch: ${source.error || source.status || "unknown"}`}
                        </span>
                      </a>
                    </TimelineItem>
                  ))}

                  {searchGroups.map((group) => (
                    <TimelineItem key={group.query} icon="◎" title={group.query}>
                      <div className="mt-3 overflow-hidden rounded-md border border-[#fffaf0]/18 bg-[#202323]">
                        <div className="flex items-center justify-between border-b border-[#fffaf0]/10 px-3 py-2 text-xs text-[#aab3ad]">
                          <span>{group.results.length} results</span>
                          <span>{group.results[0] ? getDomain(group.results[0].url) : "web"}</span>
                        </div>
                        <div className="max-h-44 overflow-y-auto">
                          {group.results.slice(0, 6).map((item) => (
                            <a
                              key={`${group.query}-${item.url}`}
                              href={item.url}
                              target="_blank"
                              rel="noreferrer"
                              className="grid grid-cols-[1fr_140px] gap-3 px-3 py-2 text-sm transition hover:bg-white/5"
                            >
                              <span className="truncate text-[#f5eee1]">{item.title}</span>
                              <span className="truncate text-right text-[#aab3ad]">{getDomain(item.url)}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    </TimelineItem>
                  ))}

                  {result && (
                    <>
                      <TimelineItem icon="◷" title={directAnswer(result, text || url)} />
                      <TimelineItem icon="✓" title="Done" />
                    </>
                  )}
                </div>
              </div>
            )}

            {result && (
              <div className="order-1 space-y-5">
                <div className={`border p-5 ${verdictTone[result.verdict]}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.2em]">Detector verdict</p>
                      <p className="mt-1 font-display text-4xl font-black">{result.verdict}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black uppercase tracking-[0.2em]">Confidence</p>
                      <p className="mt-1 text-3xl font-black">{result.confidence}%</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 border border-[#fffaf0]/25 bg-white/5 p-4">
                  <p className="font-display text-2xl font-black leading-snug text-[#fffaf0]">
                    {directAnswer(result, text || url)}
                  </p>
                  <p className="text-base leading-7 text-[#f5eee1]">{result.summary}</p>
                </div>

                {result.sources?.length > 0 && (
                  <div className="border border-[#fffaf0]/25 bg-white/5 p-4">
                    <h3 className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-[#f0c76b]">
                      Sources
                    </h3>
                    <div className="space-y-3">
                      {result.sources.map((source) => (
                        <a
                          key={`${source.title}-${source.url}`}
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block border border-[#fffaf0]/20 p-3 text-sm transition hover:bg-white/10"
                        >
                          <span className="mb-1 inline-block text-xs font-black uppercase tracking-[0.14em] text-[#f0c76b]">
                            {source.supports ? "Supports" : "Contradicts"}
                          </span>
                          <span className="block font-bold">{source.title}</span>
                          <span className="block truncate text-xs text-[#ddd3bd]">{source.url}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}

function TimelineItem({
  icon,
  title,
  children
}: {
  icon: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="relative">
      <span className="absolute -left-8 top-0 grid h-5 w-5 place-items-center rounded-full border border-[#fffaf0]/35 bg-[var(--midnight)] text-xs text-[#aab3ad]">
        {icon}
      </span>
      <p className="text-base font-semibold leading-6 text-[#f5eee1]">{title}</p>
      {children}
    </div>
  );
}

function getDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function directAnswer(result: Verdict, claim: string) {
  const deathSubject = claim
    .trim()
    .match(/^(.+?)\s+(?:has\s+)?(?:died|dead|passed away|is dead)\b/i)?.[1]
    ?.trim();

  if (deathSubject) {
    if (result.verdict === "CREDIBLE") {
      return `Yes, available sources report that ${deathSubject} died.`;
    }
    if (result.verdict === "LIKELY FAKE") {
      return `No, the claim that ${deathSubject} died is not supported by the available sources.`;
    }
    return `The claim that ${deathSubject} died needs caution; the available sources are not fully consistent.`;
  }

  const combined = `${result.summary} ${result.red_flags?.join(" ")} ${result.positive_indicators?.join(" ")}`;
  if (/not died|has not died|alive|living|active/i.test(combined)) {
    return "No, the claim that this person died is not supported by the available sources.";
  }

  if (result.verdict === "CREDIBLE") return "This claim appears credible based on the available sources.";
  if (result.verdict === "LIKELY FAKE") return "No, this claim is likely false based on the available sources.";
  return "This claim needs caution; the available sources do not fully verify it.";
}
