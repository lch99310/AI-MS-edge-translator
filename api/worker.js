const MAX_SEGMENTS = 40;
const MAX_TEXT_CHARS = 3500;
const MAX_REQUEST_CHARS = 60000;
const MAX_RETRIES = 2;

const BACKEND_CONFIGS = [
  {
    name: "Agnes AI",
    keyEnv: "AGNES_AI_API_KEY",
    modelEnv: "AGNES_MODEL",
    defaultModel: "agnes-2.0-flash",
    baseUrl: "https://apihub.agnes-ai.com/v1"
  },
  {
    name: "Google Gemini",
    keyEnv: "GEMINI_API_KEY",
    modelEnv: "GEMINI_MODEL",
    defaultModel: "gemini-2.0-flash",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/"
  },
  {
    name: "Groq",
    keyEnv: "GROQ_API_KEY",
    modelEnv: "GROQ_MODEL",
    defaultModel: "openai/gpt-oss-120b",
    baseUrl: "https://api.groq.com/openai/v1"
  },
  {
    name: "OpenRouter GLAI",
    keyEnv: "OPENROUTER_KEY_GLAI",
    modelEnv: "OPENROUTER_MODEL_GLAI",
    defaultModel: "",
    baseUrl: "https://openrouter.ai/api/v1"
  },
  {
    name: "OpenRouter NVIDIA",
    keyEnv: "OPENROUTER_KEY_NVIDIA",
    modelEnv: "OPENROUTER_MODEL_NVIDIA",
    defaultModel: "nvidia/nemotron-3-nano-30b-a3b:free",
    baseUrl: "https://openrouter.ai/api/v1"
  },
  {
    name: "OpenRouter Qwen3",
    keyEnv: "OPENROUTER_KEY_QWEN3",
    modelEnv: "OPENROUTER_MODEL_QWEN3",
    defaultModel: "",
    baseUrl: "https://openrouter.ai/api/v1"
  },
  {
    name: "OpenRouter Minimax",
    keyEnv: "OPENROUTER_KEY_MINIMAX",
    modelEnv: "OPENROUTER_MODEL_MINIMAX",
    defaultModel: "",
    baseUrl: "https://openrouter.ai/api/v1"
  },
  {
    name: "OpenRouter auto",
    keyEnv: "OPENROUTER_FREE_API_KEY",
    modelEnv: "OPENROUTER_MODEL_FREE",
    defaultModel: "openrouter/auto",
    baseUrl: "https://openrouter.ai/api/v1"
  },
  {
    name: "DeepSeek",
    keyEnv: "DEEPSEEK_API_KEY",
    modelEnv: "DEEPSEEK_MODEL",
    defaultModel: "deepseek-v4-flash",
    baseUrl: "https://api.deepseek.com"
  }
];

export default {
  async fetch(request, env) {
    const corsHeaders = getCorsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/translate") {
      return json({ error: "Not found." }, 404, corsHeaders);
    }

    if (env.EXTENSION_TOKEN) {
      const suppliedToken = request.headers.get("X-Extension-Token") || "";
      if (suppliedToken !== env.EXTENSION_TOKEN) {
        return json({ error: "Unauthorized." }, 401, corsHeaders);
      }
    }

    try {
      const input = await request.json();
      const segments = validateRequest(input);
      const result = await translateWithFallback(input, segments, env);
      return json(result, 200, corsHeaders);
    } catch (error) {
      console.error("Translation request failed:", error);
      return json(
        { error: error instanceof Error ? error.message : "Translation failed." },
        400,
        corsHeaders
      );
    }
  }
};

function getCorsHeaders(request, env) {
  const requestedOrigin = request.headers.get("Origin") || "";
  const allowedOrigin = env.ALLOWED_ORIGIN || "*";
  const origin = allowedOrigin === "*" ? "*" : (
    requestedOrigin === allowedOrigin ? requestedOrigin : allowedOrigin
  );

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Content-Type, X-Extension-Token",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Vary": "Origin"
  };
}

function json(value, status, headers) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...headers, "Content-Type": "application/json" }
  });
}

function validateRequest(input) {
  if (!input || !Array.isArray(input.segments)) {
    throw new Error("segments must be an array.");
  }
  if (input.segments.length > MAX_SEGMENTS) {
    throw new Error("At most " + MAX_SEGMENTS + " segments are allowed per request.");
  }

  const segments = input.segments.map((segment, index) => {
    const id = String(segment?.id || index);
    const text = String(segment?.text || "").trim();
    const context = String(segment?.context || "").trim();

    if (!text || text.length > MAX_TEXT_CHARS) {
      throw new Error("Segment " + id + " is empty or too large.");
    }
    return { id, text, context };
  });

  if (JSON.stringify(segments).length > MAX_REQUEST_CHARS) {
    throw new Error("Translation request is too large.");
  }
  return segments;
}

function resolveBackends(env) {
  return BACKEND_CONFIGS
    .map((config) => ({
      ...config,
      apiKey: String(env[config.keyEnv] || "").trim(),
      model: String(env[config.modelEnv] || config.defaultModel).trim()
    }))
    .filter((config) => config.apiKey && config.model);
}

async function translateWithFallback(input, segments, env) {
  const sessionBlacklist = new Set();
  const backends = resolveBackends(env);

  if (backends.length === 0) {
    throw new Error("No AI backend is configured.");
  }

  for (const backend of backends) {
    const blacklistKey = backend.name + ":" + backend.model;
    if (sessionBlacklist.has(blacklistKey)) {
      continue;
    }

    try {
      const translations = await callBackend(backend, input, segments);
      return {
        translations,
        provider: backend.name,
        model: backend.model
      };
    } catch (error) {
      const classification = classifyError(error);
      console.error(
        "[" + backend.name + "/" + backend.model + "] " + classification.label,
        error
      );
      if (classification.blacklist) {
        sessionBlacklist.add(blacklistKey);
      }
    }
  }

  throw new Error("All configured AI backends failed.");
}

async function callBackend(backend, input, segments) {
  const systemPrompt =
    "You are a professional webpage translator. " +
    "Translate every segment into Taiwan Traditional Chinese (zh-TW), not Simplified Chinese. " +
    "Preserve meaning, tone, numbers, names, URLs, product names, code, and placeholders. " +
    "Use natural Taiwan wording for jobs, technology, business, and everyday web content. " +
    "Do not add explanations, comments, Markdown fences, or new content. " +
    "Return exactly one JSON object with a translations array. " +
    "Return exactly one translation for every input segment, with the same IDs and original order.";

  const userPrompt = JSON.stringify({
    sourceLocale: input.sourceLocale || "auto",
    targetLocale: "zh-TW",
    page: input.page || {},
    segments
  });

  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt += 1) {
    try {
      const endpoint = backend.baseUrl.replace(/\/$/, "") + "/chat/completions";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + backend.apiKey,
          "Content-Type": "application/json",
          ...(backend.baseUrl.includes("openrouter.ai")
            ? {
                "HTTP-Referer": "https://github.com/lch99310/AI-MS-edge-translator",
                "X-Title": "AI MS Edge Translator"
              }
            : {})
        },
        body: JSON.stringify({
          model: backend.model,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ]
        })
      });

      const responseText = await response.text();
      if (!response.ok) {
        throw new BackendError(response.status, responseText);
      }

      const payload = JSON.parse(responseText);
      return parseTranslations(payload?.choices?.[0]?.message?.content, segments);
    } catch (error) {
      lastError = error;
      const classification = classifyError(error);
      if (!classification.retryable || attempt > MAX_RETRIES) {
        break;
      }
      await wait(classification.waitMs);
    }
  }

  throw lastError || new Error("Backend request failed.");
}

function parseTranslations(rawContent, segments) {
  if (typeof rawContent !== "string") {
    throw new Error("Backend returned no text content.");
  }

  const cleaned = rawContent
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^\s*\`\`\`(?:json)?\s*/i, "")
    .replace(/\s*\`\`\`\s*$/i, "")
    .trim();

  let data;
  try {
    data = JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) {
      throw new Error("Backend returned invalid JSON.");
    }
    data = JSON.parse(cleaned.slice(start, end + 1));
  }

  if (!data || !Array.isArray(data.translations)) {
    throw new Error("Backend JSON does not contain translations.");
  }

  const expectedIds = segments.map((segment) => segment.id);
  const actualIds = data.translations.map((item) => String(item?.id || ""));
  if (
    actualIds.length !== expectedIds.length ||
    actualIds.some((id, index) => id !== expectedIds[index]) ||
    data.translations.some((item) => typeof item?.text !== "string")
  ) {
    throw new Error("Backend returned incomplete or misordered translations.");
  }

  return data.translations.map((item) => ({
    id: String(item.id),
    text: item.text
  }));
}

function classifyError(error) {
  const status = error instanceof BackendError ? error.status : 0;
  if (status === 401 || status === 403 || status === 402 || status === 404) {
    return { label: "HTTP " + status, blacklist: true, retryable: false, waitMs: 0 };
  }
  if (status === 413) {
    return { label: "payload too large", blacklist: false, retryable: false, waitMs: 0 };
  }
  if (status === 429) {
    return { label: "rate limited", blacklist: true, retryable: true, waitMs: 1500 };
  }
  if (status >= 500 || status === 0) {
    return { label: "temporary failure", blacklist: false, retryable: true, waitMs: 1000 };
  }
  return { label: "invalid response", blacklist: true, retryable: false, waitMs: 0 };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class BackendError extends Error {
  constructor(status, body) {
    super("Backend returned HTTP " + status + ": " + body.slice(0, 500));
    this.status = status;
  }
}
