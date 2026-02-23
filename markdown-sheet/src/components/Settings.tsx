import { type FC, useState } from "react";
import type { AiSettings } from "../types";
import "./Settings.css";

const PROVIDERS: {
  id: string;
  label: string;
  format: "openai" | "anthropic";
  baseUrl: string;
  model: string;
}[] = [
  { id: "deepseek",  label: "DeepSeek (無料枠あり)",    format: "openai",    baseUrl: "https://api.deepseek.com/v1",                              model: "deepseek-chat"            },
  { id: "groq",      label: "Groq (無料・高速)",         format: "openai",    baseUrl: "https://api.groq.com/openai/v1",                           model: "llama-3.3-70b-versatile"  },
  { id: "grok",      label: "Grok / xAI (無料枠あり)",   format: "openai",    baseUrl: "https://api.x.ai/v1",                                      model: "grok-2-latest"            },
  { id: "gemini",    label: "Gemini / Google (無料枠あり)", format: "openai", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/", model: "gemini-2.0-flash"         },
  { id: "openai",    label: "OpenAI (ChatGPT)",           format: "openai",    baseUrl: "https://api.openai.com/v1",                                model: "gpt-4o"                   },
  { id: "anthropic", label: "Claude / Anthropic",         format: "anthropic", baseUrl: "https://api.anthropic.com/v1",                             model: "claude-haiku-4-5-20251001"},
  { id: "custom",    label: "カスタム (さくらのAI など)", format: "openai",    baseUrl: "",                                                         model: ""                         },
];

interface Props {
  settings: AiSettings;
  onSave: (settings: AiSettings) => void;
  onClose: () => void;
}

const Settings: FC<Props> = ({ settings, onSave, onClose }) => {
  const [local, setLocal] = useState<AiSettings>({ ...settings });
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const selectProvider = (id: string) => {
    const preset = PROVIDERS.find((p) => p.id === id);
    if (!preset) return;
    setLocal((prev) => ({
      ...prev,
      provider: id,
      apiFormat: preset.format,
      baseUrl: preset.baseUrl,
      model: preset.model,
    }));
    setTestMsg(null);
  };

  const handleTest = async () => {
    if (!local.apiKey) {
      setTestMsg({ text: "APIキーを入力してください", ok: false });
      return;
    }
    setTesting(true);
    setTestMsg(null);
    try {
      if (local.apiFormat === "anthropic") {
        const url = local.baseUrl.replace(/\/$/, "") + "/messages";
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": local.apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: local.model,
            max_tokens: 5,
            messages: [{ role: "user", content: "hi" }],
          }),
        });
        if (resp.ok) {
          setTestMsg({ text: "接続成功！", ok: true });
        } else {
          const err = await resp.json().catch(() => ({}));
          setTestMsg({ text: `エラー: ${err?.error?.message || resp.statusText}`, ok: false });
        }
      } else {
        const url = local.baseUrl.replace(/\/$/, "") + "/chat/completions";
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${local.apiKey}`,
          },
          body: JSON.stringify({
            model: local.model,
            messages: [{ role: "user", content: "hi" }],
            max_tokens: 5,
          }),
        });
        if (resp.ok) {
          setTestMsg({ text: "接続成功！", ok: true });
        } else {
          const err = await resp.json().catch(() => ({}));
          setTestMsg({ text: `エラー: ${err?.error?.message || resp.statusText}`, ok: false });
        }
      }
    } catch (e) {
      setTestMsg({ text: `接続失敗: ${String(e)}`, ok: false });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    onSave(local);
    onClose();
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2 className="settings-title">設定</h2>
          <button className="settings-close" onClick={onClose} title="閉じる">✕</button>
        </div>

        <div className="settings-section">
          <div className="settings-section-title">AI API</div>

          {/* プロバイダー選択（プルダウン） */}
          <label className="settings-label">プロバイダー</label>
          <select
            className="settings-input settings-select"
            value={local.provider}
            onChange={(e) => selectProvider(e.target.value)}
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>

          <div className="settings-format-badge">
            形式: <strong>{local.apiFormat === "anthropic" ? "Anthropic Messages API" : "OpenAI 互換"}</strong>
          </div>

          {/* API キー */}
          <label className="settings-label">API キー</label>
          <input
            type="password"
            className="settings-input"
            value={local.apiKey}
            onChange={(e) => { setLocal((s) => ({ ...s, apiKey: e.target.value })); setTestMsg(null); }}
            placeholder={local.apiFormat === "anthropic" ? "sk-ant-..." : "sk-..."}
            spellCheck={false}
          />

          {/* Base URL */}
          <label className="settings-label">Base URL</label>
          <input
            type="text"
            className="settings-input"
            value={local.baseUrl}
            onChange={(e) => { setLocal((s) => ({ ...s, baseUrl: e.target.value })); setTestMsg(null); }}
            placeholder="https://api.example.com/v1"
            spellCheck={false}
          />

          {/* モデル */}
          <label className="settings-label">モデル</label>
          <input
            type="text"
            className="settings-input"
            value={local.model}
            onChange={(e) => { setLocal((s) => ({ ...s, model: e.target.value })); setTestMsg(null); }}
            placeholder="model-name"
            spellCheck={false}
          />

          {/* 接続テスト */}
          <div className="settings-test-row">
            <button
              className="settings-detect-btn"
              onClick={handleTest}
              disabled={testing || !local.baseUrl || !local.model}
            >
              {testing ? "テスト中..." : "接続テスト"}
            </button>
            {testMsg && (
              <span className={`settings-detect-msg ${testMsg.ok ? "ok" : "err"}`}>
                {testMsg.text}
              </span>
            )}
          </div>
        </div>

        <div className="settings-footer">
          <button className="settings-close-btn" onClick={onClose}>キャンセル</button>
          <button className="settings-save-btn" onClick={handleSave}>保存</button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
