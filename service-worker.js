const DEFAULT_SETTINGS = {
  apiEndpoint: "http://localhost:8787/translate",
  apiToken: ""
};

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(DEFAULT_SETTINGS);
  await chrome.storage.local.set({
    apiEndpoint: current.apiEndpoint || DEFAULT_SETTINGS.apiEndpoint,
    apiToken: current.apiToken || DEFAULT_SETTINGS.apiToken
  });
});

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request?.type !== "TRANSLATE_SEGMENTS") {
    return undefined;
  }

  translateSegments(request)
    .then(sendResponse)
    .catch((error) => {
      console.error("Translation request failed:", error);
      sendResponse({ error: error.message || "Translation request failed." });
    });

  return true;
});

async function translateSegments(request) {
  const segments = Array.isArray(request.segments) ? request.segments : [];
  if (segments.length === 0) {
    return { translations: [] };
  }
  if (segments.length > 40) {
    throw new Error("Too many text segments in one request.");
  }

  const settings = await chrome.storage.local.get(DEFAULT_SETTINGS);
  const endpoint = String(settings.apiEndpoint || "").trim();
  if (!/^https?:\/\//i.test(endpoint)) {
    throw new Error("Please configure a valid HTTP(S) API endpoint in Settings.");
  }

  const body = {
    page: request.page || {},
    sourceLocale: "auto",
    targetLocale: "zh-TW",
    segments: segments.map((segment) => ({
      id: String(segment.id),
      text: String(segment.text),
      context: String(segment.context || "")
    }))
  };

  const headers = { "Content-Type": "application/json" };
  if (settings.apiToken) {
    headers["X-Extension-Token"] = String(settings.apiToken);
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  const responseText = await response.text();
  let payload;
  try {
    payload = responseText ? JSON.parse(responseText) : {};
  } catch {
    payload = {};
  }

  if (!response.ok) {
    throw new Error(payload.error || "Translation API returned HTTP " + response.status + ".");
  }
  if (!Array.isArray(payload.translations)) {
    throw new Error("Translation API returned an invalid response.");
  }

  return payload;
}
