/**
 * Google Apps Script (GAS) - OpenRouter AI 小客服後端
 * 
 * 【指令碼屬性 (Script Properties) 設定說明】
 * 1. 在 GAS 編輯器左側點選「專案設定」(⚙️ 齒輪圖示)
 * 2. 滑到最下方「指令碼屬性 (Script Properties)」-> 點選「新增指令碼屬性」
 * 3. 屬性 (Property) 填入：OPENROUTER_API_KEY
 * 4. 值 (Value) 填入您的 OpenRouter API 金鑰 (sk-or-v1-...)
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "anthropic/claude-haiku-5.5";

// 系統預設提示詞（可自由修改小客服人設）
const SYSTEM_PROMPT = "你是 Pei-Shan Huang (黃佩珊) 個人網站的專屬 AI 智慧小客服。Pei-Shan 是一位專注於 AI 應用整合、OpenRouter 多模型推理與全端網頁開發的工程師，作品包含 Tetris Neon 霓虹俄羅斯方塊、AI 多輪推理智慧客服系統與雲端自動化報表助手。請以親切、專業、簡潔的繁體中文（或根據使用者語言）回答訪客問題。";

/**
 * 處理瀏覽器直接開啟網址時的測試請求 (GET)
 */
function doGet(e) {
  const apiKey = getOpenRouterApiKey_();
  return createJsonResponse_({
    status: "ok",
    message: "Pei-Shan 個人網站 AI 小客服 GAS 後端運作中！",
    hasApiKeyConfigured: Boolean(apiKey),
    model: DEFAULT_MODEL
  });
}

/**
 * 處理前端網站發送過來的對話請求 (POST)
 * 支援保存與傳遞多輪對話的 reasoning_details
 */
function doPost(e) {
  try {
    const apiKey = getOpenRouterApiKey_();
    if (!apiKey) {
      return createJsonResponse_({
        error: "找不到 OPENROUTER_API_KEY！請至 GAS「專案設定 > 指令碼屬性」新增名為 OPENROUTER_API_KEY 的屬性。"
      });
    }

    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse_({ error: "未收到請求內容 (Empty payload)" });
    }

    const body = JSON.parse(e.postData.contents);
    const model = body.model || DEFAULT_MODEL;
    const clientMessages = Array.isArray(body.messages) ? body.messages : [];

    // 保留前端傳來的完整 messages（包含 assistant 的 content 與 reasoning_details 不做修改）
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...clientMessages.map(function (msg) {
        const item = {
          role: msg.role,
          content: msg.content
        };
        // 原封不動保留 reasoning_details 以利第二輪之後延續推理
        if (typeof msg.reasoning_details !== "undefined") {
          item.reasoning_details = msg.reasoning_details;
        }
        return item;
      })
    ];

    const openRouterPayload = {
      model: model,
      messages: messages,
      reasoning: body.reasoning || { enabled: true }
    };

    const options = {
      method: "post",
      contentType: "application/json",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "HTTP-Referer": "https://peishanhuang33.github.io/",
        "X-Title": "Pei-Shan Personal Website Chatbot"
      },
      payload: JSON.stringify(openRouterPayload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(OPENROUTER_URL, options);
    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();
    const result = JSON.parse(responseText);

    if (statusCode < 200 || statusCode >= 300 || result.error) {
      return createJsonResponse_({
        error: (result.error && result.error.message) ? result.error.message : ("OpenRouter API 錯誤 (HTTP " + statusCode + ")"),
        details: result
      });
    }

    // 取出 choices[0].message（內含 content 與 reasoning_details）回傳給前端保存
    const assistantMessage = (result.choices && result.choices[0] && result.choices[0].message)
      ? result.choices[0].message
      : { role: "assistant", content: "" };

    return createJsonResponse_({
      status: "success",
      message: {
        role: "assistant",
        content: assistantMessage.content,
        reasoning_details: assistantMessage.reasoning_details,
        reasoning: assistantMessage.reasoning
      },
      choices: result.choices
    });

  } catch (err) {
    return createJsonResponse_({
      error: "GAS 執行發生例外錯誤：" + (err && err.message ? err.message : String(err))
    });
  }
}

/**
 * 從「指令碼屬性 (Script Properties)」讀取 OpenRouter API Key
 */
function getOpenRouterApiKey_() {
  const props = PropertiesService.getScriptProperties();
  return (
    props.getProperty("OPENROUTER_API_KEY") ||
    props.getProperty("OPENROUTER_KEY") ||
    props.getProperty("API_KEY") ||
    ""
  ).trim();
}

/**
 * 統一回傳 JSON 格式
 */
function createJsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
