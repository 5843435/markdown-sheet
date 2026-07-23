import { type FC, useState } from "react";
import type { AiSettings } from "../types";
import { useT, useI18n, SUPPORTED_LOCALES, LOCALE_NATIVE_NAMES, type Locale, type TranslationKey } from "../i18n";
import "./Settings.css";

// `label` is the brand name (never translated). `noteKey` is an optional localized
// hint shown in parentheses; `labelKey` fully replaces the label with a localized one.
const PROVIDERS: {
  id: string;
  label: string;
  format: "openai" | "anthropic" | "azure";
  baseUrl: string;
  model: string;
  noteKey?: TranslationKey;
  labelKey?: TranslationKey;
}[] = [
  { id: "deepseek",  label: "DeepSeek",         noteKey: "settings.providerFreeTier", format: "openai",    baseUrl: "https://api.deepseek.com/v1",                              model: "deepseek-chat"            },
  { id: "groq",      label: "Groq",             noteKey: "settings.providerFreeFast", format: "openai",    baseUrl: "https://api.groq.com/openai/v1",                           model: "llama-3.3-70b-versatile"  },
  { id: "grok",      label: "Grok / xAI",       noteKey: "settings.providerFreeTier", format: "openai",    baseUrl: "https://api.x.ai/v1",                                      model: "grok-2-latest"            },
  { id: "gemini",    label: "Gemini / Google",  noteKey: "settings.providerFreeTier", format: "openai",    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/", model: "gemini-2.0-flash"         },
  { id: "openai",    label: "OpenAI (ChatGPT)",                                       format: "openai",    baseUrl: "https://api.openai.com/v1",                                model: "gpt-4o"                   },
  { id: "azure",     label: "Azure OpenAI",                                           format: "azure",     baseUrl: "https://{resource}.openai.azure.com/openai/deployments/{deployment}", model: "gpt-5.1" },
  { id: "anthropic", label: "Claude / Anthropic",                                     format: "anthropic", baseUrl: "https://api.anthropic.com/v1",                             model: "claude-haiku-4-5-20251001"},
  { id: "custom",    label: "Custom", labelKey: "settings.providerCustom",            format: "openai",    baseUrl: "",                                                         model: ""                         },
];

interface Props {
  settings: AiSettings;
  onSave: (settings: AiSettings) => void;
  onClose: () => void;
}

const Settings: FC<Props> = ({ settings, onSave, onClose }) => {
  const t = useT();
  const { locale, setLocale } = useI18n();
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
      setTestMsg({ text: t("settings.enterApiKey"), ok: false });
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
          setTestMsg({ text: t("settings.connectOk"), ok: true });
        } else {
          const err = await resp.json().catch(() => ({}));
          setTestMsg({ text: t("settings.errorPrefix", { msg: err?.error?.message || resp.statusText }), ok: false });
        }
      } else if (local.apiFormat === "azure") {
        const url = local.baseUrl.replace(/\/$/, "") + "/chat/completions?api-version=2024-12-01-preview";
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": local.apiKey,
          },
          body: JSON.stringify({
            messages: [{ role: "user", content: "hi" }],
            max_completion_tokens: 5,
          }),
        });
        if (resp.ok) {
          setTestMsg({ text: t("settings.connectOk"), ok: true });
        } else {
          const err = await resp.json().catch(() => ({}));
          setTestMsg({ text: t("settings.errorPrefix", { msg: err?.error?.message || resp.statusText }), ok: false });
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
          setTestMsg({ text: t("settings.connectOk"), ok: true });
        } else {
          const err = await resp.json().catch(() => ({}));
          setTestMsg({ text: t("settings.errorPrefix", { msg: err?.error?.message || resp.statusText }), ok: false });
        }
      }
    } catch (e) {
      setTestMsg({ text: t("settings.connectFailed", { msg: String(e) }), ok: false });
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
          <h2 className="settings-title">{t("settings.title")}</h2>
          <button className="settings-close" onClick={onClose} title={t("settings.close")}>✕</button>
        </div>

        {/* Language selector */}
        <div className="settings-section">
          <label className="settings-label">{t("settings.language")}</label>
          <select
            className="settings-input settings-select"
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
          >
            {SUPPORTED_LOCALES.map((l) => (
              <option key={l} value={l}>{LOCALE_NATIVE_NAMES[l]}</option>
            ))}
          </select>
        </div>

        <div className="settings-section">
          <div className="settings-section-title">{t("settings.sectionAiApi")}</div>

          {/* Provider select */}
          <label className="settings-label">{t("settings.provider")}</label>
          <select
            className="settings-input settings-select"
            value={local.provider}
            onChange={(e) => selectProvider(e.target.value)}
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.labelKey ? t(p.labelKey) : p.noteKey ? `${p.label} (${t(p.noteKey)})` : p.label}
              </option>
            ))}
          </select>

          <div className="settings-format-badge">
            {t("settings.formatLabel")} <strong>{local.apiFormat === "anthropic" ? "Anthropic Messages API" : local.apiFormat === "azure" ? "Azure OpenAI" : t("settings.formatOpenaiCompat")}</strong>
          </div>

          {/* API key */}
          <label className="settings-label">{t("settings.apiKey")}</label>
          <input
            type="password"
            className="settings-input"
            value={local.apiKey}
            onChange={(e) => { setLocal((s) => ({ ...s, apiKey: e.target.value })); setTestMsg(null); }}
            placeholder={local.apiFormat === "anthropic" ? "sk-ant-..." : local.apiFormat === "azure" ? t("settings.apiKeyPlaceholderAzure") : "sk-..."}
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

          {/* Model */}
          <label className="settings-label">{t("settings.model")}</label>
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
              {testing ? t("settings.testing") : t("settings.testConnection")}
            </button>
            {testMsg && (
              <span className={`settings-detect-msg ${testMsg.ok ? "ok" : "err"}`}>
                {testMsg.text}
              </span>
            )}
          </div>
        </div>

        <div className="settings-footer">
          <button className="settings-close-btn" onClick={onClose}>{t("settings.cancel")}</button>
          <button className="settings-save-btn" onClick={handleSave}>{t("settings.save")}</button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
