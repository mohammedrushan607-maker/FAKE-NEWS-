# Fake News Detector

A production-oriented fake news credibility checker built with Next.js, Tailwind utility classes, and the Fireworks Anthropic-compatible Messages API.

## Stack

- Next.js App Router
- React
- Tailwind CSS for utility classes
- Fireworks API
- Default model: `accounts/fireworks/models/kimi-k2p6`

## Setup

Create `.env.local`:

```bash
FIREWORKS_API_KEY=fw-your-key-here
FIREWORKS_MODEL=accounts/fireworks/models/kimi-k2p6
BRAVE_SEARCH_API_KEY=optional-brave-search-key
```

Install and run:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Notes

Fireworks' Anthropic-compatible endpoint currently does not support Anthropic server tools such as `web_search_20250305`, so this app implements a server-side custom `web_search` tool. Kimi K2.6 can request searches, the API route executes them, then the search results are returned to the model as `tool_result` blocks before the final verdict JSON is parsed.

Search providers:

- If `BRAVE_SEARCH_API_KEY` is set, the app uses Brave Search API.
- Otherwise it falls back to DuckDuckGo HTML search, which works without a key but is less reliable for production.

URL analysis is handled by fetching readable article text server-side and passing it to Kimi K2.6.

Kimi K2.6 is listed by Fireworks as a vision-capable model, so screenshot/image uploads are sent as base64 image content for visible-text extraction and analysis.
