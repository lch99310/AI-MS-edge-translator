# AI MS Edge Translator

AI-powered Microsoft Edge extension for translating visible web content from any
detected source language into Taiwan Traditional Chinese (zh-TW).

## MVP scope

- Manifest V3 extension.
- Contextual translation of visible text segments instead of isolated word-node calls.
- MutationObserver support for SPA and dynamically loaded content, including LinkedIn-style pages.
- One-click translate and restore-original controls.
- Translation API proxy with the same multi-backend fallback pattern used by
  SciCover_Summary.
- Provider API keys stay on the server; the extension stores only an API
  endpoint and an optional extension token.

## Architecture

1. The content script discovers visible, translatable DOM text and attaches
   page/section context.
2. The service worker sends structured segment batches to the configured API.
3. The API tries configured AI providers in priority order and validates the
   JSON response before returning it.
4. The content script replaces only the matching text nodes and watches for new
   DOM content while translation is active.

The backend registry follows SciCover_Summary and supports Agnes AI, Google
Gemini, OpenRouter and DeepSeek. Groq is not part of the active registry. A
provider is enabled only when its key is configured. Model IDs use the same
override convention as SciCover_Summary, such as GEMINI_MODEL,
OPENROUTER_MODEL_FREE and DEEPSEEK_MODEL.

## Install the extension locally

1. Revoke and replace the old Groq key that was previously committed to this
   repository. It must be treated as compromised; removing the current file
   does not remove it from Git history.
2. Open edge://extensions and enable Developer mode.
3. Choose Load unpacked and select the repository root.
4. Open the extension Options page and set the translation API endpoint.
5. For local development, use http://localhost:8787/translate.

The extension cannot run on browser-internal pages such as edge:// pages, and
the user must allow the extension to access the target site.

## Run the API locally

See api/README.md. In short:

    cd api
    npm test
    npx wrangler dev --config wrangler.toml

Create api/.dev.vars locally with provider keys and an optional
EXTENSION_TOKEN. Do not commit .dev.vars.

## Deploy the API

The recommended setup is entirely through GitHub. Open:

    Settings -> Secrets and variables -> Actions -> New repository secret

Configure:

- CLOUDFLARE_API_TOKEN
- CLOUDFLARE_ACCOUNT_ID
- TRANSLATOR_EXTENSION_TOKEN
- AGNES_AI_API_KEY
- GEMINI_API_KEY
- OPENROUTER_KEY_GLAI
- OPENROUTER_KEY_NVIDIA
- OPENROUTER_KEY_QWEN3
- OPENROUTER_KEY_MINIMAX
- OPENROUTER_FREE_API_KEY
- DEEPSEEK_API_KEY

Add only the provider keys you want to use. There is no GROQ_API_KEY in the
active configuration.

The workflow .github/workflows/deploy-translation-api.yml injects these values
at deployment time, following the SciCover_Summary pattern. After merging to
main, run Actions -> Deploy translation API -> Run workflow.

## Privacy boundary

When translation is started, the extension sends visible text segments plus
page URL, title and language metadata to the configured translation API. The
MVP does not intentionally store page content, but the configured backend and
its AI providers may process request data according to their own terms. Do not
use the MVP on confidential pages until the provider, retention and logging
policies have been reviewed.

## Quality and current limitations

The MVP is designed to improve context and reliability, not to claim perfect
translation. It currently skips very long individual text nodes, code-like
content, form controls and hidden content. Images, video captions, cross-origin
iframes and browser-protected pages are outside the first MVP.

The next validation pass should compare LinkedIn job pages, news pages,
technical documentation and dynamically loaded pages. Evaluate meaning,
Taiwan terminology, coverage, alignment and layout preservation separately.

## License

The existing LICENSE.txt needs a deliberate license decision before public
distribution. Its text currently does not match the README's former MIT claim.
