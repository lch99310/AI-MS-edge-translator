const EXCLUDED_TAGS = new Set([
  "SCRIPT", "STYLE", "NOSCRIPT", "IFRAME", "OBJECT", "EMBED",
  "CODE", "PRE", "TEXTAREA", "INPUT", "SELECT", "OPTION"
]);
const MAX_SEGMENT_CHARS = 3500;
const MAX_BATCH_SEGMENTS = 20;
const MAX_BATCH_CHARS = 12000;

let translationActive = false;
let translationInProgress = false;
let translationObserver = null;
let scanTimer = null;
const translationRecords = new Map();

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request?.type === "START_TRANSLATION") {
    startTranslation()
      .then(sendResponse)
      .catch((error) => {
        reportStatus("error", error.message || "Translation failed.");
        sendResponse({ error: error.message || "Translation failed." });
      });
    return true;
  }

  if (request?.type === "RESTORE_PAGE") {
    restorePage();
    sendResponse({ status: "restored" });
    return false;
  }

  if (request?.type === "GET_TRANSLATION_STATE") {
    sendResponse({
      active: translationActive,
      translatedCount: translationRecords.size
    });
    return false;
  }

  return undefined;
});

async function startTranslation() {
  if (!document.body) {
    throw new Error("The page body is not ready.");
  }

  translationActive = true;
  installObserver();
  reportStatus("working", "正在讀取頁面內容…");

  const segments = collectSegments();
  if (segments.length === 0) {
    reportStatus("complete", "沒有找到可翻譯的可見文字。");
    return { status: "complete", translatedCount: 0 };
  }

  translationInProgress = true;
  let completed = 0;
  try {
    for (const batch of buildBatches(segments)) {
      const response = await sendTranslationRequest(batch);
      applyTranslations(batch, response.translations || []);
      completed += batch.length;
      reportStatus("working", "已翻譯 " + completed + " 個文字區塊…");
    }
  } finally {
    translationInProgress = false;
  }

  reportStatus("complete", "翻譯完成。");
  return { status: "complete", translatedCount: translationRecords.size };
}

function collectSegments() {
  const segments = [];
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT
  );
  let node;
  let index = 0;

  while ((node = walker.nextNode())) {
    const text = node.textContent.trim();
    const element = node.parentElement;
    if (
      !element ||
      !text ||
      text.length > MAX_SEGMENT_CHARS ||
      translationRecords.has(node) ||
      shouldSkipElement(element) ||
      !isVisible(element) ||
      isLikelyUrlOrCode(text)
    ) {
      continue;
    }

    segments.push({
      id: "segment-" + index++,
      node,
      text: node.textContent,
      context: buildContext(element)
    });
  }

  return segments;
}

function shouldSkipElement(element) {
  for (let current = element; current && current !== document.body; current = current.parentElement) {
    if (
      EXCLUDED_TAGS.has(current.tagName) ||
      current.isContentEditable ||
      current.getAttribute("aria-hidden") === "true" ||
      current.closest("[data-ai-ms-translator-ignore]")
    ) {
      return true;
    }
  }
  return false;
}

function isVisible(element) {
  const style = window.getComputedStyle(element);
  return style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.opacity !== "0" &&
    element.getClientRects().length > 0;
}

function isLikelyUrlOrCode(text) {
  return /^(https?:\/\/|www\.|[A-Za-z]:\\|[{}()[\];]+$)/i.test(text);
}

function buildContext(element) {
  const pageTitle = document.title.trim().slice(0, 160);
  const language = document.documentElement.lang || "unknown";
  const contextParts = ["page title: " + pageTitle, "page language: " + language];

  let ancestor = element;
  for (let depth = 0; ancestor && depth < 4; depth += 1, ancestor = ancestor.parentElement) {
    const heading = ancestor.querySelector("h1, h2, h3, h4, h5, h6");
    if (heading && heading !== element) {
      const headingText = heading.textContent.trim();
      if (headingText) {
        contextParts.push("section heading: " + headingText.slice(0, 240));
        break;
      }
    }
  }

  const role = element.getAttribute("role");
  if (role) {
    contextParts.push("element role: " + role);
  }
  return contextParts.join(" | ").slice(0, 700);
}

function buildBatches(segments) {
  const batches = [];
  let current = [];
  let currentChars = 0;

  for (const segment of segments) {
    const nextChars = currentChars + segment.text.length;
    if (
      current.length > 0 &&
      (current.length >= MAX_BATCH_SEGMENTS || nextChars > MAX_BATCH_CHARS)
    ) {
      batches.push(current);
      current = [];
      currentChars = 0;
    }
    current.push(segment);
    currentChars += segment.text.length;
  }

  if (current.length > 0) {
    batches.push(current);
  }
  return batches;
}

function sendTranslationRequest(batch) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        type: "TRANSLATE_SEGMENTS",
        page: {
          url: location.href,
          title: document.title,
          language: document.documentElement.lang || "auto"
        },
        segments: batch.map((segment) => ({
          id: segment.id,
          text: segment.text,
          context: segment.context
        }))
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response || response.error) {
          reject(new Error(response?.error || "Translation API failed."));
          return;
        }
        resolve(response);
      }
    );
  });
}

function applyTranslations(batch, translations) {
  const byId = new Map(
    translations.map((item) => [String(item.id), String(item.text || "")])
  );

  for (const segment of batch) {
    const translated = byId.get(segment.id);
    if (!translated || translated === segment.text) {
      continue;
    }
    translationRecords.set(segment.node, {
      original: segment.node.textContent,
      translated
    });
    segment.node.textContent = translated;
  }
}

function installObserver() {
  if (translationObserver) {
    return;
  }
  translationObserver = new MutationObserver(() => {
    if (!translationActive || translationInProgress) {
      return;
    }
    window.clearTimeout(scanTimer);
    scanTimer = window.setTimeout(() => {
      startTranslation().catch((error) => reportStatus("error", error.message));
    }, 1000);
  });
  translationObserver.observe(document.body, { childList: true, subtree: true });
}

function restorePage() {
  for (const [node, record] of translationRecords.entries()) {
    if (node.isConnected) {
      node.textContent = record.original;
    }
  }
  translationRecords.clear();
  translationActive = false;
  translationInProgress = false;
  if (translationObserver) {
    translationObserver.disconnect();
    translationObserver = null;
  }
  reportStatus("restored", "已還原原文。");
}

function reportStatus(status, message) {
  chrome.runtime.sendMessage({
    type: "TRANSLATION_STATUS",
    status,
    message,
    translatedCount: translationRecords.size
  }).catch(() => {});
}
