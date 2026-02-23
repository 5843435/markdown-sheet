import type { AiSettings } from "../types";

/**
 * AI API を呼び出す汎用関数。
 * OpenAI 互換形式と Anthropic Messages API の両方に対応。
 */
export async function callAI(
  settings: AiSettings,
  systemPrompt: string,
  userContent: string,
): Promise<string> {
  const { baseUrl, apiKey, model, apiFormat } = settings;
  let resp: Response;

  if (apiFormat === "anthropic") {
    const url = baseUrl.replace(/\/$/, "") + "/messages";
    resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
      }),
    });
  } else {
    const url = baseUrl.replace(/\/$/, "") + "/chat/completions";
    resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        max_tokens: 2000,
      }),
    });
  }

  if (!resp.ok) {
    let msg = `HTTP ${resp.status}`;
    try {
      const err = await resp.json();
      msg = err?.error?.message || err?.error?.type || msg;
    } catch { /* ignore */ }
    throw new Error(msg);
  }

  const data = await resp.json();
  const result: string = (
    apiFormat === "anthropic"
      ? data.content?.[0]?.text
      : data.choices?.[0]?.message?.content
    ?? ""
  ).trim();

  return result;
}
