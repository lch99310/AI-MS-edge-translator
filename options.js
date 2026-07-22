const DEFAULT_SETTINGS = {
  apiEndpoint: "http://localhost:8787/translate",
  apiToken: ""
};

document.addEventListener("DOMContentLoaded", async () => {
  const endpoint = document.getElementById("apiEndpoint");
  const token = document.getElementById("apiToken");
  const status = document.getElementById("status");

  const settings = await chrome.storage.local.get(DEFAULT_SETTINGS);
  endpoint.value = settings.apiEndpoint || DEFAULT_SETTINGS.apiEndpoint;
  token.value = settings.apiToken || "";

  document.getElementById("saveButton").addEventListener("click", async () => {
    const apiEndpoint = endpoint.value.trim();
    if (!/^https?:\/\//i.test(apiEndpoint)) {
      status.textContent = "請輸入有效的 HTTP(S) API endpoint。";
      status.className = "error";
      return;
    }

    await chrome.storage.local.set({
      apiEndpoint,
      apiToken: token.value.trim()
    });
    status.textContent = "設定已儲存。";
    status.className = "success";
  });
});
