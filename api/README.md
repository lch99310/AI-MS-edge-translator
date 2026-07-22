# Translation API

This server-side proxy follows the same provider configuration pattern as
[SciCover_Summary](https://github.com/lch99310/SciCover_Summary):

- provider keys are GitHub Actions repository secrets;
- provider priority and model defaults are defined in the backend registry;
- model IDs remain overridable with matching *_MODEL variables when needed;
- invalid JSON, unavailable models, quota failures, and rate limits trigger validation/fallback;
- the browser never receives a provider API key;
- Groq is not part of the active provider registry.

## Recommended setup: GitHub Secrets

You do not need to create a local .dev.vars file for the normal deployment flow.

In the repository, open:

    Settings -> Secrets and variables -> Actions -> New repository secret

Add the following secrets.

Required deployment secrets:

    CLOUDFLARE_API_TOKEN
    CLOUDFLARE_ACCOUNT_ID
    TRANSLATOR_EXTENSION_TOKEN

Add one or more AI provider keys, using the same names as SciCover_Summary:

    AGNES_AI_API_KEY
    GEMINI_API_KEY
    OPENROUTER_KEY_GLAI
    OPENROUTER_KEY_NVIDIA
    OPENROUTER_KEY_QWEN3
    OPENROUTER_KEY_MINIMAX
    OPENROUTER_FREE_API_KEY
    DEEPSEEK_API_KEY

Only provider keys that you actually configure will be enabled. The workflow
passes these secrets to Cloudflare Worker. It never writes the values into the
repository.

The workflow is:

    .github/workflows/deploy-translation-api.yml

After this PR is merged, run it manually once from:

    Actions -> Deploy translation API -> Run workflow

It also runs automatically when api/ or the workflow file changes on main.

## Worker endpoint

After deployment, Cloudflare prints the Worker URL in the workflow log. The
translation endpoint is:

    https://YOUR-WORKER-DOMAIN/translate

Put that URL in the Extension Options page. Put the same value used for
TRANSLATOR_EXTENSION_TOKEN into the Extension token field.

## Optional local development

For local-only development, you may still run:

    cd api
    npm test
    npx wrangler dev --config wrangler.toml

A local .dev.vars file is optional and must never be committed. It is not
required for the GitHub Secrets deployment flow.

## Public release warning

The shared extension token is suitable for personal MVP use only. A public
release should use per-user authentication, rate limiting, quotas and a narrow
ALLOWED_ORIGIN.
