# Translation API

This server-side proxy follows the same configuration pattern as SciCover_Summary:

- provider keys are environment secrets;
- model IDs are overridable with *_MODEL;
- providers are tried in priority order;
- invalid JSON, unavailable models, quota failures, and rate limits trigger validation/fallback;
- the browser never receives a provider API key.

## Local development

Run:

    npx wrangler dev --config api/wrangler.toml

Create a local .dev.vars file (never commit it):

    GROQ_API_KEY=replace-me
    GROQ_MODEL=openai/gpt-oss-120b
    EXTENSION_TOKEN=replace-with-a-local-token
    ALLOWED_ORIGIN=*

The extension default endpoint is http://localhost:8787/translate. Open the
extension Options page and configure the same endpoint and token.

## Cloudflare deployment

Set only the provider secrets you want to enable:

    npx wrangler secret put GROQ_API_KEY --config api/wrangler.toml
    npx wrangler secret put GEMINI_API_KEY --config api/wrangler.toml
    npx wrangler secret put OPENROUTER_FREE_API_KEY --config api/wrangler.toml
    npx wrangler secret put DEEPSEEK_API_KEY --config api/wrangler.toml
    npx wrangler secret put EXTENSION_TOKEN --config api/wrangler.toml

Model IDs can be changed without editing the worker by setting the matching
*_MODEL variable. See worker.js for the complete backend registry.

For a public release, replace the shared token with per-user authentication,
add rate limiting, and configure a narrow ALLOWED_ORIGIN.
