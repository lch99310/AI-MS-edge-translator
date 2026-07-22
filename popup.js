document.addEventListener("DOMContentLoaded", async () => {
  const translateButton = document.getElementById("translateButton");
  const restoreButton = document.getElementById("restoreButton");
  const settingsButton = document.getElementById("settingsButton");
  const status = document.getElementById("status");

  function setStatus(message, kind) {
    status.textContent = message;
    status.className = kind || "";
  }

  function sendToActiveTab(message) {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (!tab?.id) {
          reject(new Error("找不到目前分頁。"));
          return;
        }
        chrome.tabs.sendMessage(tab.id, message, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error("此頁面無法使用翻譯功能。"));
            return;
          }
          resolve(response || {});
        });
      });
    });
  }

  try {
    const state = await sendToActiveTab({ type: "GET_TRANSLATION_STATE" });
    if (state.active) {
      setStatus("目前頁面已啟用翻譯。", "success");
    }
  } catch {
    setStatus("請先確認目前頁面允許 Extension 存取。", "error");
  }

  translateButton.addEventListener("click", async () => {
    translateButton.disabled = true;
    setStatus("正在讀取頁面內容…", "working");
    try {
      await sendToActiveTab({ type: "START_TRANSLATION" });
      setStatus("翻譯工作已開始；動態載入內容會持續處理。", "success");
    } catch (error) {
      setStatus(error.message, "error");
    } finally {
      translateButton.disabled = false;
    }
  });

  restoreButton.addEventListener("click", async () => {
    try {
      await sendToActiveTab({ type: "RESTORE_PAGE" });
      setStatus("已還原原文。", "success");
    } catch (error) {
      setStatus(error.message, "error");
    }
  });

  settingsButton.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "TRANSLATION_STATUS") {
      setStatus(message.message, message.status);
    }
  });
});
