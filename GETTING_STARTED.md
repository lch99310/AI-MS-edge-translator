# AI MS Edge Translator 使用與測試手冊

這份手冊帶你完成：

1. 取得 PR 分支
2. 在本機啟動翻譯 API
3. 將 Edge Extension 掛載成未封裝擴充功能
4. 設定 AI provider
5. 在一般網頁與 LinkedIn Job page 實際測試
6. 釐清翻譯品質與常見錯誤
7. 之後切換到 Cloudflare Worker

## 0. 先理解 MVP 的運作方式

瀏覽器端不放任何 AI provider 的 API key。Provider 設定採用
SciCover_Summary 的 GitHub Secrets 模式，不需要在 Terminal 設定 API key。

流程是：

    Edge content script
      -> 找出頁面上可見文字與段落脈絡
      -> service worker
      -> 你的翻譯 API
      -> AI provider
      -> 回傳帶有原始 ID 的 JSON 翻譯
      -> 只替換對應文字節點

因此：

- AI key 放在 API 伺服器的 secrets，不會放進 Extension。
- Extension 會送出可見文字、頁面 URL、標題與語言 metadata。
- MVP 不會刻意保存頁面內容，但 API provider 可能依其服務條款處理請求。
- 不要把公司機密、內部文件或敏感工作頁面送到尚未審查過的 provider。
- LinkedIn 這類 SPA / 動態頁面是目標情境，但仍可能遇到 shadow DOM、iframe 或網站結構變更。

## 1. 取得 PR 分支

PR：

https://github.com/lch99310/AI-MS-edge-translator/pull/1

在你的電腦執行：

    git clone https://github.com/lch99310/AI-MS-edge-translator.git
    cd AI-MS-edge-translator
    git fetch origin codex/mvp-manifest-v3-contextual
    git checkout codex/mvp-manifest-v3-contextual

如果你已經有本機 clone：

    git fetch origin
    git checkout codex/mvp-manifest-v3-contextual
    git pull origin codex/mvp-manifest-v3-contextual

如果你不想使用 Git，也可以在 PR 頁面選 Code -> Download ZIP，解壓縮後使用包含 manifest.json 的資料夾。

## 2. 準備 Edge 與 GitHub

需要：

- Microsoft Edge
- GitHub repository admin 權限
- Cloudflare 帳號與 API token
- 至少一個 AI provider API key

這版不需要你在 Terminal 建立 .dev.vars。正式測試會由 GitHub Actions
部署 Cloudflare Worker，API key 只放 GitHub Secrets。

## 3. 在 GitHub 手動設定 Secrets

進入 Repo：

    Settings -> Secrets and variables -> Actions

點「New repository secret」，依序建立以下必要 Secrets：

    CLOUDFLARE_API_TOKEN
    CLOUDFLARE_ACCOUNT_ID
    TRANSLATOR_EXTENSION_TOKEN

再加入你要使用的 provider key。名稱與 SciCover_Summary 完全一致：

    AGNES_AI_API_KEY
    GEMINI_API_KEY
    OPENROUTER_KEY_GLAI
    OPENROUTER_KEY_NVIDIA
    OPENROUTER_KEY_QWEN3
    OPENROUTER_KEY_MINIMAX
    OPENROUTER_FREE_API_KEY
    DEEPSEEK_API_KEY

只需要設定至少一個 provider key。沒有設定的 provider 會自動跳過。
不要設定 GROQ_API_KEY；Groq 已經從翻譯 API 的 active registry 移除。

## 4. 透過 GitHub Actions 部署 API

先合併這個 provider configuration PR。之後進入：

    Actions -> Deploy translation API -> Run workflow

等待 workflow 成功。從 workflow log 找到 Cloudflare Worker URL，然後把
/translate 加到 URL 尾端。

例如：

    https://你的-worker-domain/translate

這就是之後要填入 Extension Options 的 API endpoint。

如果 workflow 失敗，先檢查 CLOUDFLARE_API_TOKEN、CLOUDFLARE_ACCOUNT_ID
與至少一個 provider key 的名稱是否拼寫正確。

## 5. 將 Extension 掛到 Edge

先保留 API terminal 持續執行。

在 Edge 開啟：

    edge://extensions

然後：

1. 開啟右上角 Developer mode。
2. 點 Load unpacked。
3. 選取 Repo 根目錄，也就是「直接包含 manifest.json 的資料夾」。
4. 確認列表中出現 AI MS Edge Translator。
5. 建議點釘選，把圖示固定到工具列。

每次修改 Extension 程式碼後：

1. 回到 edge://extensions。
2. 點 AI MS Edge Translator 的 Reload。
3. 回到測試網頁重新整理。

Content script 已經注入的頁面通常必須重新整理，單純 Reload Extension 不一定會重新注入到現有分頁。

## 6. 設定 Extension 的 API endpoint

點工具列上的 Extension 圖示，開啟 AI MS Edge Translator，選：

    開啟設定

填入：

    Translation API endpoint:
    http://localhost:8787/translate

    Extension token:
    與 .dev.vars 裡的 EXTENSION_TOKEN 完全相同

點「儲存設定」。

如果你沒有設定 EXTENSION_TOKEN，Extension token 欄位可以留空；但個人測試仍建議設定，避免本機 API 被其他請求直接使用。

## 7. 先測試一般網頁

先不要直接用 LinkedIn，先用一個普通的英文新聞、技術文件或公開文章頁面。

1. 開啟一個 http:// 或 https:// 網頁。
2. 等頁面完成載入。
3. 點 Edge 工具列上的 AI MS Edge Translator。
4. 點「翻譯目前頁面」。
5. 等待翻譯完成。
6. 再開一次 popup，確認文字已變成台灣繁體中文。
7. 點「還原原文」，確認頁面可以恢復。

你可以先觀察三件事：

- 內容是否有漏翻。
- 標題、段落、列表是否仍維持原本結構。
- 翻譯是否自然，而不是逐字直譯。

## 8. 實測 LinkedIn Job page

先確認你已在 Edge 登入 LinkedIn。

建議先開短網址：

    https://www.linkedin.com/jobs/view/4427180878/

若你使用原本帶 tracking query 的完整網址也可以，但 query 參數通常不是必要條件。

第一次使用時，確認 Extension 有該網站權限：

1. 開啟 LinkedIn Job page。
2. 點工具列上的 Extensions 拼圖圖示。
3. 找到 AI MS Edge Translator。
4. 若 Edge 顯示網站存取權限，選擇允許在 linkedin.com 讀取與變更網站資料。
5. 重新整理 LinkedIn 頁面。
6. 點 AI MS Edge Translator -> 翻譯目前頁面。

測試時請依順序檢查：

- 職缺標題
- 地點與工作型態
- About the job / 職缺描述
- Responsibilities / Requirements / Skills
- Apply / Save 等按鈕文字
- LinkedIn 之後動態載入的段落

翻譯完成後可以：

- 捲動頁面，觀察新載入的內容是否在約一秒後被處理。
- 切換其他 LinkedIn 頁面，必要時再次點「翻譯目前頁面」。
- 點「還原原文」，確認所有被替換的文字節點復原。

這個 MVP 的優先順序是「保留上下文、覆蓋可見文字、避免破壞版面」。它不會翻譯圖片裡的文字、影片字幕、跨來源 iframe，也不會改寫輸入框內容。

## 9. 如何判斷翻譯準確度

請不要只用「看起來有翻成中文」判斷品質。建議建立一個小型測試表，每次換 provider 或 prompt 都記錄：

| 項目 | 檢查方式 |
| --- | --- |
| Coverage | 標題、段落、列表、按鈕是否漏翻 |
| Meaning | 是否改變原文條件、否定、職稱或責任範圍 |
| Taiwan wording | 是否使用台灣常用繁中，而非中國用語 |
| Terminology | AI、ML、data、stakeholder、compliance 等專有詞是否一致 |
| Context | 同一詞在頁面不同位置是否依上下文翻譯 |
| Layout | 長度變化是否造成卡片、列表或按鈕破版 |
| Reversibility | 還原原文是否完整 |

對 LinkedIn 職缺尤其要檢查：

- must / preferred / may 的語氣差異
- responsible for 與 accountable for 的責任強度
- location、hybrid、remote、on-site
- salary、benefit、visa、work rights
- seniority、years of experience、technical requirements

如果發現「文字通順但意思不準」，請保留原文與翻譯後的句子，這會直接成為下一版 glossary、prompt 或評測集的輸入。

## 10. 常見問題排查

### Popup 顯示目前頁面無法使用

通常是：

- 目前頁面是 edge://、瀏覽器商店或其他受保護頁面。
- Extension 沒有該網站權限。
- Extension 剛 Reload，但頁面還沒重新整理。
- 目前頁面沒有成功注入 content.js。

處理：

1. 確認網址是一般 http(s) 網頁。
2. 在 edge://extensions 點 Reload。
3. 回到網頁按重新整理。
4. 再開 popup。

### API 顯示 No AI backend configured

檢查：

- GitHub Secrets 是否至少設定一個 provider key。
- Secrets 名稱是否完全符合清單。
- Actions workflow 是否成功完成部署。
- 若修改 Secrets 後沒有重新部署，請到 Actions 手動 Run workflow。

### API 回傳 401 或 403

通常是：

- provider key 失效。
- provider key 沒有該 model 權限。
- Extension token 與 EXTENSION_TOKEN 不一致。

先看 API terminal 的錯誤，再逐一確認 token 與 model。

### API 回傳 404 / model not found

模型名稱可能隨 provider 改變。先查看 workflow log 與 provider 控制台。
SciCover_Summary 的預設 model 可透過對應的 *_MODEL 變數覆寫；如果要做
這件事，需在 workflow 中加入該 model variable 後重新部署。

### 有 API 回應，但頁面沒有變化

開啟該網頁的 DevTools：

1. 按 F12。
2. 開 Console。
3. 重新整理後再次翻譯。
4. 查看是否有 Translation request failed、No translatable text 或權限錯誤。

某些網站把內容放在 shadow DOM、跨來源 iframe 或 canvas；這些不在本 MVP 的 DOM 掃描範圍。

### LinkedIn 翻譯一半

LinkedIn 會持續更新 DOM。先等頁面穩定，再按一次翻譯；捲動後等待動態內容處理。如果仍漏翻，記錄漏掉的區塊與其 HTML 結構，下一版再針對該元件補 parser。

## 11. 之後部署成 Cloudflare Worker

本機驗證成功後，再考慮部署。

需要在 GitHub repository Settings -> Secrets and variables -> Actions 建立：

- CLOUDFLARE_API_TOKEN
- CLOUDFLARE_ACCOUNT_ID
- 你要啟用的 provider key，例如 GEMINI_API_KEY 或 OPENROUTER_FREE_API_KEY
- TRANSLATOR_EXTENSION_TOKEN

合併到 main 後，GitHub Actions 會在 api/ 變更時執行測試與部署。

部署完成後，將 Cloudflare Worker 的 endpoint：

    https://你的-worker-domain/translate

填入 Extension Options，並把相同的 token 填入 Extension token。

公共發布前不要使用單一共享 token。因為使用者可以從瀏覽器請求中看到它；正式版本應改成每個使用者自己的登入 / token、配額與 rate limiting。

## 12. 目前這個 PR 的驗證邊界

已完成：

- Extension JavaScript syntax check
- manifest JSON parsing
- Worker contract tests
- CORS、錯誤請求、token gate、沒有 provider 等基本路徑

尚未由開發環境完成：

- 真實 provider API call
- 你的 Edge 登入環境中的 LinkedIn end-to-end test
- 多種 provider 的翻譯品質比較

所以第一輪實測請先用個人、非機密頁面；確認 API 與 Extension 連通後，再用 LinkedIn Job page 做品質測試。
