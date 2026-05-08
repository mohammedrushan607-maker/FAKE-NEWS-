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

- If `BRAVE_SEARCH_API_KEY` is set, the app uses the Brave Search API.
- Otherwise it uses the no-key GDELT DOC API for hosted deployments.
- DuckDuckGo HTML search is kept only as a final local fallback when not running on Vercel. Hosted serverless environments commonly receive `403` responses from DuckDuckGo.

For Vercel, add these environment variables in Project Settings -> Environment Variables and redeploy:

```bash
FIREWORKS_API_KEY=fw-your-key-here
FIREWORKS_MODEL=accounts/fireworks/models/kimi-k2p6
```

`BRAVE_SEARCH_API_KEY` is optional. Without it, the hosted app uses GDELT search.

URL analysis is handled by fetching readable article text server-side and passing it to Kimi K2.6.

Kimi K2.6 is listed by Fireworks as a vision-capable model, so screenshot/image uploads are sent as base64 image content for visible-text extraction and analysis.
