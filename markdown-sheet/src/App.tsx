import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile, writeFile } from "@tauri-apps/plugin-fs";
import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import FileTree from "./components/FileTree";
import MarkdownPreview from "./components/MarkdownPreview";
import Settings from "./components/Settings";
import OutlinePanel from "./components/OutlinePanel";
import SearchReplace from "./components/SearchReplace";
import StatusBar from "./components/StatusBar";
import TabBar from "./components/TabBar";
import Toolbar from "./components/Toolbar";
import { callAI } from "./lib/callAI";
import { makeHeadingId } from "./lib/headingId";
import type { AiSettings, FileEntry, ParsedDocument, RecentFile, Tab } from "./types";
import { useI18n, LOCALE_ENGLISH_NAMES, type TranslationKey } from "./i18n";

// ========== AI & Template Constants ==========

const MERMAID_GENERATE_PROMPT =
  "You are a Mermaid diagram generator. " +
  "Based on the user's description, generate appropriate Mermaid diagram source code. " +
  "Output ONLY the raw Mermaid source. Do NOT include code fences, explanation, or any other text.";

const TRANSFORM_OPTIONS = [
  { id: "translate", labelKey: "ai.transform.translate" },
  { id: "summarize", labelKey: "ai.transform.summarize" },
  { id: "proofread", labelKey: "ai.transform.proofread" },
  { id: "bullets", labelKey: "ai.transform.bullets" },
] as const satisfies { id: string; labelKey: TranslationKey }[];

// Build the AI system prompt for a transform. `uiLang` is the English name of the
// active UI language, so "translate" toggles between English and that language and
// summaries come back in the input's own language regardless of the UI locale.
function buildTransformPrompt(id: string, uiLang: string): string {
  switch (id) {
    case "translate":
      return (
        `Translate the following text. If it is not written in English, translate it to English. ` +
        `If it is already in English, translate it to ${uiLang}. ` +
        `Return ONLY the translated text, with no explanations.`
      );
    case "summarize":
      return (
        "Summarize the following text concisely, writing the summary in the same language as the input text. " +
        "Return ONLY the summary, with no additional commentary."
      );
    case "proofread":
      return (
        "Proofread and correct any grammatical or spelling errors in the following text. " +
        "Preserve the original language and tone. Return ONLY the corrected text."
      );
    case "bullets":
      return (
        "Convert the following text into a Markdown bullet list using '- ' prefix. " +
        "Return ONLY the bullet list, one item per line."
      );
    default:
      return "";
  }
}

// Diagram samples are keyed by label (localized via i18n). The Japanese build keeps
// the original Japanese node text; every other locale uses the English sample, which
// is a neutral, universally readable default and avoids RTL/rendering surprises.
const MERMAID_TEMPLATES: { id: string; labelKey: TranslationKey; codeJa: string; codeEn: string }[] = [
  {
    id: "flowchart",
    labelKey: "template.flowchart",
    codeJa: `flowchart LR
  開始([開始]) --> 受注[受注処理]
  受注 --> 確認{在庫確認}
  確認 -->|あり| 出荷[出荷手配]
  確認 -->|なし| 発注[仕入発注]
  発注 --> 入荷[入荷処理]
  入荷 --> 出荷
  出荷 --> 請求[請求処理]
  請求 --> 終了([終了])`,
    codeEn: `flowchart LR
  Start([Start]) --> Order[Order intake]
  Order --> Check{Stock check}
  Check -->|In stock| Ship[Arrange shipping]
  Check -->|Out of stock| Purchase[Purchase order]
  Purchase --> Receive[Receiving]
  Receive --> Ship
  Ship --> Invoice[Billing]
  Invoice --> End([End])`,
  },
  {
    id: "sequence",
    labelKey: "template.sequence",
    codeJa: `sequenceDiagram
  actor ユーザー
  participant フロント as フロントエンド
  participant API as バックエンドAPI
  participant DB as データベース
  ユーザー->>フロント: ログイン要求
  フロント->>API: 認証リクエスト
  API->>DB: ユーザー照合
  DB-->>API: ユーザー情報
  API-->>フロント: JWTトークン
  フロント-->>ユーザー: ログイン成功`,
    codeEn: `sequenceDiagram
  actor User
  participant Front as Frontend
  participant API as Backend API
  participant DB as Database
  User->>Front: Login request
  Front->>API: Auth request
  API->>DB: Verify user
  DB-->>API: User info
  API-->>Front: JWT token
  Front-->>User: Login success`,
  },
  {
    id: "er",
    labelKey: "template.er",
    codeJa: `erDiagram
  顧客 ||--o{ 注文 : "する"
  注文 ||--|{ 注文明細 : "含む"
  商品 ||--o{ 注文明細 : "含まれる"
  顧客 {
    int 顧客ID PK
    string 氏名
    string 電話番号
  }
  注文 {
    int 注文ID PK
    int 顧客ID FK
    date 注文日
  }
  商品 {
    int 商品ID PK
    string 商品名
    int 価格
  }`,
    codeEn: `erDiagram
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ ORDER_ITEM : contains
  PRODUCT ||--o{ ORDER_ITEM : "included in"
  CUSTOMER {
    int customer_id PK
    string name
    string phone
  }
  ORDER {
    int order_id PK
    int customer_id FK
    date order_date
  }
  PRODUCT {
    int product_id PK
    string product_name
    int price
  }`,
  },
  {
    id: "gantt",
    labelKey: "template.gantt",
    codeJa: `gantt
  title プロジェクト計画
  dateFormat YYYY-MM-DD
  section 企画フェーズ
    要件定義      :a1, 2025-04-01, 14d
    設計書作成    :a2, after a1, 7d
  section 開発フェーズ
    フロント開発  :b1, after a2, 21d
    バックエンド  :b2, after a2, 21d
    テスト        :b3, after b1, 14d
  section リリース
    UAT           :c1, after b3, 7d
    本番リリース  :c2, after c1, 1d`,
    codeEn: `gantt
  title Project plan
  dateFormat YYYY-MM-DD
  section Planning
    Requirements   :a1, 2025-04-01, 14d
    Design doc     :a2, after a1, 7d
  section Development
    Frontend       :b1, after a2, 21d
    Backend        :b2, after a2, 21d
    Testing        :b3, after b1, 14d
  section Release
    UAT            :c1, after b3, 7d
    Go-live        :c2, after c1, 1d`,
  },
  {
    id: "class",
    labelKey: "template.class",
    codeJa: `classDiagram
  class ユーザー {
    +int id
    +string 名前
    +string メール
    +ログイン() bool
    +ログアウト() void
  }
  class 管理者 {
    +string 権限レベル
    +ユーザー削除(id) void
  }
  class 一般ユーザー {
    +int ポイント
    +ポイント使用(amount) void
  }
  ユーザー <|-- 管理者
  ユーザー <|-- 一般ユーザー`,
    codeEn: `classDiagram
  class User {
    +int id
    +string name
    +string email
    +login() bool
    +logout() void
  }
  class Admin {
    +string permissionLevel
    +deleteUser(id) void
  }
  class Member {
    +int points
    +usePoints(amount) void
  }
  User <|-- Admin
  User <|-- Member`,
  },
  {
    id: "mindmap",
    labelKey: "template.mindmap",
    codeJa: `mindmap
  root((プロジェクト))
    目標
      売上向上
      コスト削減
    課題
      リソース不足
      スケジュール遅延
    解決策
      人員補充
      外部委託
      工程見直し`,
    codeEn: `mindmap
  root((Project))
    Goals
      Increase sales
      Reduce cost
    Challenges
      Lack of resources
      Schedule delays
    Solutions
      Add staff
      Outsource
      Revise process`,
  },
  {
    id: "org",
    labelKey: "template.org",
    codeJa: `graph TD
  CEO[代表取締役]
  CEO --> COO[最高執行責任者]
  CEO --> CFO[最高財務責任者]
  COO --> 営業部[営業部長]
  COO --> 開発部[開発部長]
  営業部 --> 営業1[営業チーム1]
  営業部 --> 営業2[営業チーム2]
  開発部 --> FE[フロントエンドチーム]
  開発部 --> BE[バックエンドチーム]`,
    codeEn: `graph TD
  CEO[CEO]
  CEO --> COO[COO]
  CEO --> CFO[CFO]
  COO --> Sales[Head of Sales]
  COO --> Dev[Head of Development]
  Sales --> Sales1[Sales Team 1]
  Sales --> Sales2[Sales Team 2]
  Dev --> FE[Frontend Team]
  Dev --> BE[Backend Team]`,
  },
  {
    id: "state",
    labelKey: "template.state",
    codeJa: `stateDiagram-v2
  [*] --> 待機中
  待機中 --> 処理中 : 開始
  処理中 --> 完了 : 成功
  処理中 --> エラー : 失敗
  エラー --> 待機中 : リトライ
  完了 --> [*]
  エラー --> [*] : キャンセル`,
    codeEn: `stateDiagram-v2
  [*] --> Idle
  Idle --> Processing : start
  Processing --> Done : success
  Processing --> Error : failure
  Error --> Idle : retry
  Done --> [*]
  Error --> [*] : cancel`,
  },
  {
    id: "pie",
    labelKey: "template.pie",
    codeJa: `pie title 売上構成比
  "製品A" : 42.5
  "製品B" : 27.3
  "製品C" : 18.2
  "その他" : 12.0`,
    codeEn: `pie title Sales breakdown
  "Product A" : 42.5
  "Product B" : 27.3
  "Product C" : 18.2
  "Other" : 12.0`,
  },
];

// @ts-ignore
import html2pdf from "html2pdf.js";

type Theme = "light" | "dark";

function makeInitialTab(): Tab {
  return {
    id: crypto.randomUUID(),
    filePath: null,
    content: "",
    dirty: false,
    contentUndoStack: [],
    contentRedoStack: [],
  };
}

function App() {
  // --- i18n ---
  // `t` is used directly in render; `tRef` keeps the latest translator for use inside
  // useCallback bodies without threading `t` through every dependency array.
  const { t, locale } = useI18n();
  const tRef = useRef(t);
  tRef.current = t;

  // --- AI Settings ---
  const [aiSettings, setAiSettings] = useState<AiSettings>(() => {
    const defaults: AiSettings = {
      provider: "deepseek",
      apiKey: "",
      model: "deepseek-chat",
      baseUrl: "https://api.deepseek.com/v1",
      apiFormat: "openai",
    };
    try {
      const saved = JSON.parse(localStorage.getItem("md-ai-settings") || "null");
      return saved ? { ...defaults, ...saved } : defaults;
    } catch {
      return defaults;
    }
  });
  const [showSettings, setShowSettings] = useState(false);

  // --- Feature 1: AI Mermaid generation ---
  const [showAiGenerate, setShowAiGenerate] = useState(false);
  const [aiGenerateDesc, setAiGenerateDesc] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiGenerateError, setAiGenerateError] = useState("");

  // --- Feature 2: AI text transform ---
  const [aiTransformOpen, setAiTransformOpen] = useState(false);
  const [aiTransformPos, setAiTransformPos] = useState<{ x: number; y: number } | null>(null);
  const [aiTransforming, setAiTransforming] = useState(false);
  const savedSelectionRef = useRef<{ start: number; end: number } | null>(null);
  const aiTransformBtnRef = useRef<HTMLButtonElement>(null);

  // --- Feature 3: Mermaid templates ---
  const [templatePos, setTemplatePos] = useState<{ x: number; y: number } | null>(null);
  const templateBtnRef = useRef<HTMLButtonElement>(null);

  const handleSaveAiSettings = useCallback((s: AiSettings) => {
    setAiSettings(s);
    localStorage.setItem("md-ai-settings", JSON.stringify(s));
  }, []);

  // --- Theme ---
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem("md-theme") as Theme) || "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("md-theme", theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === "light" ? "dark" : "light"));
  }, []);

  // --- Tabs ---
  const initialTab = makeInitialTab();
  const [tabs, setTabs] = useState<Tab[]>([initialTab]);
  const [activeTabId, setActiveTabId] = useState<string>(initialTab.id);

  // --- File state (working copy of active tab) ---
  const [fileTree, setFileTree] = useState<FileEntry[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [content, setContent] = useState(""); // raw markdown
  const [dirty, setDirty] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [editorVisible, setEditorVisible] = useState(true);
  const [leftPanelVisible, setLeftPanelVisible] = useState(true);

  // プレビュー専用モード切替時に直前の表示状態を覚えておくための保存箱
  const preFullPreviewRef = useRef<{ editor: boolean; panel: boolean } | null>(null);
  const isPreviewOnly = !editorVisible && !leftPanelVisible;
  const togglePreviewOnly = useCallback(() => {
    if (!editorVisible && !leftPanelVisible) {
      // 既にプレビュー専用モード → 直前の状態に戻す
      const prev = preFullPreviewRef.current ?? { editor: true, panel: true };
      setEditorVisible(prev.editor);
      setLeftPanelVisible(prev.panel);
      preFullPreviewRef.current = null;
    } else {
      // プレビュー専用モードに入る → 現状を保存して両方非表示
      preFullPreviewRef.current = { editor: editorVisible, panel: leftPanelVisible };
      setEditorVisible(false);
      setLeftPanelVisible(false);
    }
  }, [editorVisible, leftPanelVisible]);
  const [leftPanel, setLeftPanel] = useState<"folder" | "outline">("folder");

  // --- Auto-save ---
  const [autoSave, setAutoSave] = useState(
    () => localStorage.getItem("md-auto-save") !== "false"
  );
  useEffect(() => {
    localStorage.setItem("md-auto-save", String(autoSave));
  }, [autoSave]);

  // --- Recent files ---
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("md-recent-files") || "[]");
    } catch { return []; }
  });

  const addRecentFile = useCallback((filePath: string) => {
    const name = filePath.split(/[\\/]/).pop() ?? filePath;
    setRecentFiles((prev) => {
      const filtered = prev.filter((f) => f.path !== filePath);
      const next = [{ path: filePath, name, ts: Date.now() }, ...filtered].slice(0, 10);
      localStorage.setItem("md-recent-files", JSON.stringify(next));
      return next;
    });
  }, []);

  // --- Toast ---
  const [toast, setToast] = useState<{
    message: string;
    isError: boolean;
  } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (message: string, isError = false) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, isError });
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  };

  // --- Editor pane ---
  const [editorRatio, setEditorRatio] = useState(40);
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // --- Editor undo/redo stack ---
  const undoStackRef = useRef<string[]>([]);
  const redoStackRef = useRef<string[]>([]);
  const contentRef = useRef("");
  contentRef.current = content;

  // ツールバー用: content undo/redo の可否をリアクティブに追跡
  const [contentUndoAvailable, setContentUndoAvailable] = useState(false);
  const [contentRedoAvailable, setContentRedoAvailable] = useState(false);

  // --- Refs for tab switching (always latest values) ---
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;
  const tabsRef = useRef<Tab[]>(tabs);
  tabsRef.current = tabs;

  // --- Scroll sync ---
  const [syncScroll, setSyncScroll] = useState(
    () => localStorage.getItem("md-sync-scroll") !== "false"
  );
  const isSyncingRef = useRef(false);

  useEffect(() => {
    localStorage.setItem("md-sync-scroll", String(syncScroll));
  }, [syncScroll]);

  useEffect(() => {
    if (!syncScroll || !editorVisible) return;
    const editor = editorRef.current;
    const preview = previewRef.current;
    if (!editor || !preview) return;

    const syncFromEditor = () => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;
      const ratio = editor.scrollTop / Math.max(editor.scrollHeight - editor.clientHeight, 1);
      preview.scrollTop = ratio * (preview.scrollHeight - preview.clientHeight);
      requestAnimationFrame(() => { isSyncingRef.current = false; });
    };

    const syncFromPreview = () => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;
      const ratio = preview.scrollTop / Math.max(preview.scrollHeight - preview.clientHeight, 1);
      editor.scrollTop = ratio * (editor.scrollHeight - editor.clientHeight);
      requestAnimationFrame(() => { isSyncingRef.current = false; });
    };

    editor.addEventListener("scroll", syncFromEditor, { passive: true });
    preview.addEventListener("scroll", syncFromPreview, { passive: true });
    return () => {
      editor.removeEventListener("scroll", syncFromEditor);
      preview.removeEventListener("scroll", syncFromPreview);
    };
  }, [syncScroll, editorVisible]);

  // ====== Tab Management ======

  /** 現在の作業状態を現タブスロットに保存（refから読み取り → staleクロージャ回避） */
  const saveCurrentToTab = useCallback(() => {
    const id = activeTabIdRef.current;
    const editorScrollTop = editorRef.current?.scrollTop;
    const previewScrollTop = previewRef.current?.scrollTop;
    setTabs((prev) =>
      prev.map((t) =>
        t.id !== id
          ? t
          : {
              ...t,
              content: contentRef.current,
              dirty: dirtyRef.current,
              contentUndoStack: [...undoStackRef.current],
              contentRedoStack: [...redoStackRef.current],
              editorScrollTop: editorScrollTop ?? t.editorScrollTop,
              previewScrollTop: previewScrollTop ?? t.previewScrollTop,
            }
      )
    );
  }, []);

  /** textarea / preview の DOM 要素は使い回されるので、タブ切替時にスクロール位置を明示的に適用する。
   *  content 更新後の scrollHeight 反映を待つため rAF 2回。 */
  const applyTabScroll = useCallback((editorTop: number, previewTop: number) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (editorRef.current) editorRef.current.scrollTop = editorTop;
        if (previewRef.current) previewRef.current.scrollTop = previewTop;
      });
    });
  }, []);

  /** タブを切り替える */
  const switchToTab = useCallback(
    (tabId: string) => {
      if (tabId === activeTabIdRef.current) return;
      saveCurrentToTab();
      const newTab = tabsRef.current.find((t) => t.id === tabId);
      if (!newTab) return;
      setActiveTabId(tabId);
      setContent(newTab.content);
      setDirty(newTab.dirty);
      setActiveFile(newTab.filePath);
      undoStackRef.current = [...newTab.contentUndoStack];
      redoStackRef.current = [...newTab.contentRedoStack];
      setContentUndoAvailable(newTab.contentUndoStack.length > 0);
      setContentRedoAvailable(newTab.contentRedoStack.length > 0);
      applyTabScroll(newTab.editorScrollTop ?? 0, newTab.previewScrollTop ?? 0);
    },
    [saveCurrentToTab, applyTabScroll]
  );

  /** 新しい空タブを開く */
  const openNewTab = useCallback(() => {
    saveCurrentToTab();
    const newTab = makeInitialTab();
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setContent("");
    setDirty(false);
    setActiveFile(null);
    undoStackRef.current = [];
    redoStackRef.current = [];
    setContentUndoAvailable(false);
    setContentRedoAvailable(false);
    applyTabScroll(0, 0);
  }, [saveCurrentToTab, applyTabScroll]);

  /** タブを閉じる */
  const closeTab = useCallback(
    (tabId: string) => {
      const currentTabs = tabsRef.current;
      const isActive = tabId === activeTabIdRef.current;

      // 閉じる前に現タブの状態を保存（他タブのデータが最新になるよう）
      if (isActive) {
        saveCurrentToTab();
      }

      // saveCurrentToTab が setTabs を呼ぶため、最新の tabs を再取得
      const latestTabs = tabsRef.current;
      let remaining = latestTabs.filter((t) => t.id !== tabId);

      // 最後のタブを閉じる場合は新しい空タブに入れ替え
      if (remaining.length === 0) {
        remaining = [makeInitialTab()];
      }

      if (isActive) {
        const idx = latestTabs.findIndex((t) => t.id === tabId);
        const newActive = remaining[Math.min(idx, remaining.length - 1)];
        setContent(newActive.content);
        setDirty(newActive.dirty);
        setActiveFile(newActive.filePath);
        undoStackRef.current = [...newActive.contentUndoStack];
        redoStackRef.current = [...newActive.contentRedoStack];
        setContentUndoAvailable(newActive.contentUndoStack.length > 0);
        setContentRedoAvailable(newActive.contentRedoStack.length > 0);
        setActiveTabId(newActive.id);
        applyTabScroll(newActive.editorScrollTop ?? 0, newActive.previewScrollTop ?? 0);
      }

      setTabs(remaining);
    },
    [saveCurrentToTab, applyTabScroll]
  );

  // ====== File Loading ======

  const loadFile = useCallback(
    async (filePath: string) => {
      // すでに開いているタブがあればそこに切り替える
      const existing = tabsRef.current.find((t) => t.filePath === filePath);
      if (existing) {
        switchToTab(existing.id);
        return;
      }

      try {
        let text: string;
        try {
          const doc: ParsedDocument = await invoke("read_markdown_file", { filePath });
          text = doc.lines.join("\n");
        } catch {
          text = await readTextFile(filePath);
        }

        // 現タブが空（未編集・ファイル未割当）なら上書き、そうでなければ新タブで開く。
        // タブスロットの content/dirty はまだ saveCurrentToTab されていない可能性があるので、
        // 編集中の最新状態は contentRef / dirtyRef を見る。
        const currentTab = tabsRef.current.find((t) => t.id === activeTabIdRef.current);
        const isCurrentEmpty =
          currentTab &&
          !currentTab.filePath &&
          !dirtyRef.current &&
          !contentRef.current;

        if (isCurrentEmpty) {
          // 空タブに上書き
          const currentId = activeTabIdRef.current;
          setActiveFile(filePath);
          setContent(text);
          setDirty(false);
          undoStackRef.current = [];
          redoStackRef.current = [];
          setContentUndoAvailable(false);
          setContentRedoAvailable(false);

          setTabs((prev) =>
            prev.map((t) =>
              t.id === currentId
                ? {
                    ...t,
                    filePath,
                    content: text,
                    dirty: false,
                    contentUndoStack: [],
                    contentRedoStack: [],
                    editorScrollTop: 0,
                    previewScrollTop: 0,
                  }
                : t
            )
          );
          applyTabScroll(0, 0);
        } else {
          // 新タブで開く
          saveCurrentToTab();
          const newTab: Tab = {
            id: crypto.randomUUID(),
            filePath,
            content: text,
            dirty: false,
            contentUndoStack: [],
            contentRedoStack: [],
          };
          setTabs((prev) => [...prev, newTab]);
          setActiveTabId(newTab.id);
          setContent(text);
          setDirty(false);
          setActiveFile(filePath);
          undoStackRef.current = [];
          redoStackRef.current = [];
          applyTabScroll(0, 0);
          setContentUndoAvailable(false);
          setContentRedoAvailable(false);
        }

        addRecentFile(filePath);
      } catch (e) {
        console.error("ファイル読み込みエラー:", e);
        showToast(tRef.current("toast.loadFailed"), true);
      }
    },
    [switchToTab, addRecentFile, saveCurrentToTab, applyTabScroll]
  );

  // --- Auto-save interval ---
  useEffect(() => {
    if (!autoSave) return;
    const iv = setInterval(async () => {
      if (dirtyRef.current && activeFile) {
        try {
          await writeTextFile(activeFile, contentRef.current);
          setDirty(false);
          const currentId = activeTabIdRef.current;
          setTabs((prev) =>
            prev.map((t) => (t.id === currentId ? { ...t, dirty: false } : t))
          );
          showToast(tRef.current("toast.autoSaved"));
        } catch { /* silent */ }
      }
    }, 30_000);
    return () => clearInterval(iv);
  }, [autoSave, activeFile]);

  // --- Folder open ---
  const handleOpenFolder = useCallback(async () => {
    let selected: string | null = null;
    try {
      selected = await open({ directory: true });
    } catch (e) {
      console.error("ダイアログエラー:", e);
      showToast(tRef.current("toast.folderDialogFailed"), true);
      return;
    }
    if (!selected) return;
    try {
      const entries: FileEntry[] = await invoke("get_file_tree", {
        dirPath: selected,
      });
      setFileTree(entries);
    } catch (e) {
      console.error("フォルダ読み込みエラー:", e);
    }
  }, []);

  // --- File open ---
  const handleOpenFile = useCallback(async () => {
    let selected: string | null = null;
    try {
      selected = await open({
        filters: [
          { name: "Markdown", extensions: ["md", "markdown", "txt"] },
          { name: "All", extensions: ["*"] },
        ],
      });
    } catch (e) {
      console.error("ダイアログエラー:", e);
      showToast(tRef.current("toast.fileDialogFailed"), true);
      return;
    }
    if (!selected) return;
    await loadFile(selected);
  }, [loadFile]);

  // --- Save ---
  const handleSave = useCallback(async () => {
    if (!activeFile) return;
    try {
      await writeTextFile(activeFile, content);
      setDirty(false);
      const currentId = activeTabIdRef.current;
      setTabs((prev) =>
        prev.map((t) => (t.id === currentId ? { ...t, dirty: false } : t))
      );
      showToast(tRef.current("toast.saved"));
    } catch (e) {
      console.error("保存エラー:", e);
      showToast(tRef.current("toast.saveFailed"), true);
    }
  }, [activeFile, content]);

  // --- Save As ---
  const handleSaveAs = useCallback(async () => {
    let selected: string | null = null;
    try {
      selected = await save({
        filters: [{ name: "Markdown", extensions: ["md"] }],
      });
    } catch (e) {
      console.error("ダイアログエラー:", e);
      showToast(tRef.current("toast.saveDialogFailed"), true);
      return;
    }
    if (!selected) return;
    try {
      await writeTextFile(selected, content);
      setActiveFile(selected);
      setDirty(false);
      const currentId = activeTabIdRef.current;
      setTabs((prev) =>
        prev.map((t) =>
          t.id === currentId ? { ...t, filePath: selected, dirty: false } : t
        )
      );
      addRecentFile(selected!);
      showToast(tRef.current("toast.saved"));
    } catch (e) {
      console.error("保存エラー:", e);
      showToast(tRef.current("toast.saveFailed"), true);
    }
  }, [content, addRecentFile]);

  // --- Apply content (undo/redo スタックを経由しない低レベル更新) ---
  const applyContent = useCallback(
    (newContent: string) => {
      setContent(newContent);
      setDirty(true);
    },
    []
  );

  // --- Editor content change (undo スタックに積む) ---
  const handleContentChange = useCallback(
    (newContent: string) => {
      undoStackRef.current.push(contentRef.current);
      if (undoStackRef.current.length > 200) undoStackRef.current.shift();
      redoStackRef.current = [];
      setContentUndoAvailable(true);
      setContentRedoAvailable(false);
      applyContent(newContent);
    },
    [applyContent]
  );

  // --- Undo/Redo ---
  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length > 0) {
      const prev = undoStackRef.current.pop()!;
      redoStackRef.current.push(contentRef.current);
      setContentUndoAvailable(undoStackRef.current.length > 0);
      setContentRedoAvailable(true);
      applyContent(prev);
    }
  }, [applyContent]);

  const handleRedo = useCallback(() => {
    if (redoStackRef.current.length > 0) {
      const next = redoStackRef.current.pop()!;
      undoStackRef.current.push(contentRef.current);
      setContentUndoAvailable(true);
      setContentRedoAvailable(redoStackRef.current.length > 0);
      applyContent(next);
    }
  }, [applyContent]);

  // --- Export PDF ---
  const handleExportPdf = useCallback(async () => {
    const el = previewRef.current;
    if (!el) return;
    try {
      const baseName = activeFile
        ? activeFile.split(/[\\/]/).pop()?.replace(/\.md$/i, "") || ""
        : "";
      const now = new Date();
      const ts = now.getFullYear().toString() + String(now.getMonth() + 1).padStart(2, "0") + String(now.getDate()).padStart(2, "0") + String(now.getHours()).padStart(2, "0") + String(now.getMinutes()).padStart(2, "0");
      const fileName = baseName || ts;

      // Tauri の save ダイアログでファイルパスを取得
      const savePath = await save({
        defaultPath: `${fileName}.pdf`,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (!savePath) return;

      showToast(tRef.current("toast.pdfExporting"));

      // スクロール位置を保存してリセット（html2pdf の deepCloneBasic が
      // overflow:hidden + transform で上部コンテンツを切り落とすのを防ぐ）
      const savedScrollTop = el.scrollTop;
      el.scrollTop = 0;

      // DOM をクローンして Mermaid UI コントロールを除去
      const clone = el.cloneNode(true) as HTMLElement;
      clone.querySelectorAll(".mermaid-actions, .mermaid-ai-panel").forEach((n) => n.remove());

      // スクロール位置を即座に復元
      el.scrollTop = savedScrollTop;

      const opt = {
        margin: 10,
        image: { type: "jpeg" as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm" as const, format: "a4" as const, orientation: "portrait" as const },
      };

      // html2pdf.js で ArrayBuffer を取得し、Tauri の writeFile で保存
      const arrayBuffer: ArrayBuffer = await html2pdf().set(opt).from(clone).outputPdf("arraybuffer");
      await writeFile(savePath, new Uint8Array(arrayBuffer));
      showToast(tRef.current("toast.pdfSaved"));
    } catch (error) {
      console.error("PDF export error:", error);
      showToast(tRef.current("toast.pdfFailed"), true);
    }
  }, [activeFile]);

  // --- Export HTML ---
  const handleExportHtml = useCallback(async () => {
    const el = previewRef.current;
    if (!el) return;
    try {
      // Clone DOM and strip Mermaid UI controls
      const clone = el.cloneNode(true) as HTMLElement;
      clone.querySelectorAll(".mermaid-actions, .mermaid-ai-panel").forEach((n) => n.remove());

      // 画像を data URI に変換（blob: や相対パスをHTMLに埋め込む）
      const imgs = clone.querySelectorAll<HTMLImageElement>("img");
      for (const img of Array.from(imgs)) {
        try {
          // 元のDOM側の img から blob URL を取得（clone側は src が同じ）
          const origImg = el.querySelector<HTMLImageElement>(`img[src="${img.getAttribute("src")}"]`) || img;
          const src = origImg.src;
          if (!src || src.startsWith("data:")) continue;
          const resp = await fetch(src);
          const blob = await resp.blob();
          const reader = new FileReader();
          const dataUri = await new Promise<string>((resolve) => {
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
          img.src = dataUri;
        } catch { /* skip */ }
      }

      // Mermaid SVG を inline PNG に変換
      const mermaidContainers = clone.querySelectorAll(".mermaid-rendered");
      for (const container of Array.from(mermaidContainers)) {
        const svg = container.querySelector("svg");
        if (!svg) continue;
        try {
          const origSvg = el.querySelector(`.mermaid-rendered svg`);
          const w = origSvg?.getBoundingClientRect().width || 800;
          const h = origSvg?.getBoundingClientRect().height || 400;
          const svgStr = new XMLSerializer().serializeToString(svg);
          const svgBlob = new Blob([svgStr], { type: "image/svg+xml" });
          const url = URL.createObjectURL(svgBlob);
          const image = new Image();
          await new Promise<void>((res, rej) => { image.onload = () => res(); image.onerror = rej; image.src = url; });
          const canvas = document.createElement("canvas");
          canvas.width = w * 2; canvas.height = h * 2;
          const ctx = canvas.getContext("2d")!;
          ctx.scale(2, 2);
          ctx.drawImage(image, 0, 0, w, h);
          URL.revokeObjectURL(url);
          const pngDataUri = canvas.toDataURL("image/png");
          container.innerHTML = `<img src="${pngDataUri}" style="max-width:100%;" />`;
        } catch { /* skip */ }
      }

      const htmlContent = clone.innerHTML;

      // プレビューのフォント設定を継承
      const fontKey = localStorage.getItem("md-preview-font") || "meiryo";
      const fontSize = localStorage.getItem("md-preview-size") || "14";
      const lineH = localStorage.getItem("md-preview-lh") || "1.8";
      const fontMap: Record<string, string> = {
        system: '"Segoe UI", "Meiryo", sans-serif',
        meiryo: '"Meiryo", "メイリオ", sans-serif',
        pgothic: '"MS PGothic", "ＭＳ Ｐゴシック", sans-serif',
        yugothic: '"Yu Gothic", "游ゴシック", sans-serif',
        yumin: '"Yu Mincho", "游明朝", serif',
        msmin: '"MS PMincho", "ＭＳ Ｐ明朝", serif',
        serif: '"Georgia", serif',
        mono: '"Consolas", monospace',
      };
      const fontFamily = fontMap[fontKey] || fontMap.meiryo;

      const nowH = new Date();
      const tsH = nowH.getFullYear().toString() + String(nowH.getMonth() + 1).padStart(2, "0") + String(nowH.getDate()).padStart(2, "0") + String(nowH.getHours()).padStart(2, "0") + String(nowH.getMinutes()).padStart(2, "0");
      const title = activeFile
        ? activeFile.split(/[\\/]/).pop() || tsH
        : tsH;
      const safeTitle = title.replace(/[&<>"]/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] ?? c)
      );
      const exportContent = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${safeTitle}</title>
    <style>
      body { font-family: ${fontFamily}; font-size: ${fontSize}px; line-height: ${lineH}; color: #333; max-width: 1100px; margin: 0 auto; padding: 1rem 2rem; }
      pre { background-color: #f6f8fa; padding: 16px; border-radius: 6px; overflow-x: auto; }
      code { font-family: "Consolas", monospace; font-size: 85%; background-color: rgba(175,184,193,0.2); padding: 0.2em 0.4em; border-radius: 6px; }
      pre code { background: none; padding: 0; }
      blockquote { border-left: 4px solid #dfe2e5; color: #6a737d; padding-left: 1em; margin-left: 0; }
      table { border-collapse: collapse; width: 100%; margin-bottom: 1rem; }
      th, td { border: 1px solid #dfe2e5; padding: 6px 13px; }
      th { background-color: #f6f8fa; }
      img { max-width: 100%; }
      h1 { border-bottom: 2px solid #e9d5ff; padding-bottom: 0.3em; color: #9333ea; }
      h2 { border-bottom: 1px solid #e9d5ff; padding-bottom: 0.3em; color: #a855f7; }
    </style>
</head>
<body>${htmlContent}</body>
</html>`;

      const path = await save({
        filters: [{ name: "HTML", extensions: ["html", "htm"] }],
        defaultPath: `${title.replace(/\.md$/i, "")}.html`,
      });
      if (path) {
        await writeTextFile(path, exportContent);
        showToast(tRef.current("toast.htmlExported"));
      }
    } catch (error) {
      console.error("HTML export error:", error);
      showToast(tRef.current("toast.htmlFailed"), true);
    }
  }, [activeFile]);

  // --- Export Word ---
  const handleExportWord = useCallback(async () => {
    const el = previewRef.current;
    if (!el) return;
    try {
      const { htmlToDocx } = await import("./lib/htmlToDocx");
      const { Packer } = await import("docx");

      const doc = await htmlToDocx(el);
      const blob = await Packer.toBlob(doc);
      const arrayBuffer = await blob.arrayBuffer();

      const nowW = new Date();
      const tsW = nowW.getFullYear().toString() + String(nowW.getMonth() + 1).padStart(2, "0") + String(nowW.getDate()).padStart(2, "0") + String(nowW.getHours()).padStart(2, "0") + String(nowW.getMinutes()).padStart(2, "0");
      const baseName = activeFile
        ? activeFile.split(/[\\/]/).pop()?.replace(/\.md$/i, "") || ""
        : "";
      const fileName = baseName || tsW;

      const path = await save({
        filters: [{ name: "Word", extensions: ["docx"] }],
        defaultPath: `${fileName}.docx`,
      });
      if (path) {
        await writeFile(path, new Uint8Array(arrayBuffer));
        showToast(tRef.current("toast.wordExported"));
      }
    } catch (error) {
      console.error("Word export error:", error);
      showToast(tRef.current("toast.wordFailed"), true);
    }
  }, [activeFile]);

  // --- CSV Import ---
  const handleImportCsv = useCallback(async () => {
    try {
      const selected = await open({
        filters: [{ name: "CSV", extensions: ["csv"] }],
      });
      if (!selected) return;

      const text = await readTextFile(selected as string);
      const clean = text.startsWith("\uFEFF") ? text.slice(1) : text;
      const lines = clean.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length === 0) return;

      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let current = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          if (line[i] === '"') {
            if (inQuotes && line[i + 1] === '"') {
              current += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (line[i] === "," && !inQuotes) {
            result.push(current);
            current = "";
          } else {
            current += line[i];
          }
        }
        result.push(current);
        return result;
      };

      const headers = parseCSVLine(lines[0]);
      const dataRows = lines.slice(1).map(parseCSVLine);

      const tableMarkdown = [
        "| " + headers.join(" | ") + " |",
        "| " + headers.map(() => "---").join(" | ") + " |",
        ...dataRows.map((row) => "| " + row.join(" | ") + " |"),
      ].join("\n");

      const newContent = content + "\n\n" + tableMarkdown + "\n";
      handleContentChange(newContent);
      showToast(tRef.current("toast.csvImported"));
    } catch (e) {
      showToast(tRef.current("toast.csvFailed"), true);
    }
  }, [content, handleContentChange]);

  // --- Insert Formatting ---
  const handleInsertFormatting = useCallback(
    (format: string) => {
      const textarea = editorRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selected = content.substring(start, end);
      const before = content.substring(0, start);
      const after = content.substring(end);

      let newContent = content;
      let newSelStart = start;
      let newSelEnd = end;

      const wrapInline = (marker: string) => {
        const text = selected || tRef.current("editor.defaultText");
        newContent = `${before}${marker}${text}${marker}${after}`;
        newSelStart = start + marker.length;
        newSelEnd = newSelStart + text.length;
      };

      const prefixLines = (prefix: string) => {
        if (selected) {
          const lines = selected
            .split("\n")
            .map((l) => `${prefix}${l}`)
            .join("\n");
          newContent = `${before}${lines}${after}`;
          newSelStart = start;
          newSelEnd = start + lines.length;
        } else {
          const lineStart = before.lastIndexOf("\n") + 1;
          newContent =
            content.substring(0, lineStart) +
            prefix +
            content.substring(lineStart);
          newSelStart = start + prefix.length;
          newSelEnd = newSelStart;
        }
      };

      switch (format) {
        case "bold":   wrapInline("**"); break;
        case "italic": wrapInline("*");  break;
        case "strike": wrapInline("~~"); break;
        case "code": {
          if (selected.includes("\n")) {
            newContent = `${before}\`\`\`\n${selected}\n\`\`\`${after}`;
            newSelStart = start + 4;
            newSelEnd = newSelStart + selected.length;
          } else {
            wrapInline("`");
          }
          break;
        }
        case "h1":    prefixLines("# ");   break;
        case "h2":    prefixLines("## ");  break;
        case "h3":    prefixLines("### "); break;
        case "ul":    prefixLines("- ");   break;
        case "ol":    prefixLines("1. ");  break;
        case "quote": prefixLines("> ");   break;
        case "link": {
          const text = selected || tRef.current("editor.linkText");
          newContent = `${before}[${text}](url)${after}`;
          newSelStart = start + 1;
          newSelEnd = newSelStart + text.length;
          break;
        }
        case "hr": {
          const nl = before.endsWith("\n") || before === "" ? "" : "\n";
          newContent = `${before}${nl}---\n${after}`;
          newSelStart = start + nl.length + 4;
          newSelEnd = newSelStart;
          break;
        }
        default: return;
      }

      handleContentChange(newContent);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(newSelStart, newSelEnd);
      }, 0);
    },
    [content, handleContentChange]
  );

  // --- Mermaid ブロックを AI で置換 ---
  const handleUpdateMermaidBlock = useCallback(
    (blockIndex: number, newSource: string) => {
      const regex = /```mermaid\r?\n([\s\S]*?)```/g;
      let idx = 0;
      const newContent = contentRef.current.replace(regex, (match) => {
        if (idx++ === blockIndex) {
          const nl = match.includes("\r\n") ? "\r\n" : "\n";
          return "```mermaid" + nl + newSource.trim() + nl + "```";
        }
        return match;
      });
      handleContentChange(newContent);
    },
    [handleContentChange]
  );

  // --- Inline edit (preview side) ---
  const handleInlineEdit = useCallback(
    (startLine: number, endLine: number, newMarkdown: string) => {
      const lines = contentRef.current.split("\n");
      const before = lines.slice(0, startLine);
      const after = lines.slice(endLine + 1);
      const newContent = [...before, ...newMarkdown.split("\n"), ...after].join("\n");
      handleContentChange(newContent);
    },
    [handleContentChange]
  );

  // --- Feature 3: Mermaid template insert ---
  const handleInsertTemplate = useCallback(
    (code: string) => {
      setTemplatePos(null);
      const textarea = editorRef.current;
      const pos = textarea ? textarea.selectionStart : contentRef.current.length;
      const block = "\n\n```mermaid\n" + code + "\n```\n";
      const newContent =
        contentRef.current.substring(0, pos) + block + contentRef.current.substring(pos);
      handleContentChange(newContent);
      setTimeout(() => {
        textarea?.focus();
        textarea?.setSelectionRange(pos + block.length, pos + block.length);
      }, 0);
    },
    [handleContentChange]
  );

  // --- Feature 2: AI text transform ---
  const handleAiTransform = useCallback(
    async (id: string) => {
      setAiTransformOpen(false);
      setAiTransformPos(null);
      const sel = savedSelectionRef.current;
      if (!sel || sel.start === sel.end) return;
      if (!aiSettings.apiKey) {
        showToast(tRef.current("toast.apiKeyMissing"), true);
        return;
      }
      const prompt = buildTransformPrompt(id, LOCALE_ENGLISH_NAMES[locale]);
      const selectedText = contentRef.current.substring(sel.start, sel.end);
      setAiTransforming(true);
      try {
        const result = await callAI(aiSettings, prompt, selectedText);
        const newContent =
          contentRef.current.substring(0, sel.start) +
          result +
          contentRef.current.substring(sel.end);
        handleContentChange(newContent);
        showToast(tRef.current("toast.aiTransformed"));
      } catch (err) {
        showToast(
          tRef.current("toast.aiTransformFailed", {
            error: err instanceof Error ? err.message : String(err),
          }),
          true
        );
      } finally {
        setAiTransforming(false);
      }
    },
    [aiSettings, handleContentChange, locale]
  );

  // --- Feature 1: AI Mermaid generation ---
  const handleAiGenerateMermaid = useCallback(async () => {
    if (!aiSettings.apiKey) {
      setAiGenerateError(tRef.current("toast.apiKeyMissing"));
      return;
    }
    if (!aiGenerateDesc.trim()) return;
    setAiGenerating(true);
    setAiGenerateError("");
    try {
      let result = await callAI(aiSettings, MERMAID_GENERATE_PROMPT, aiGenerateDesc);
      result = result.replace(/^```(?:mermaid)?\r?\n?/, "").replace(/\r?\n?```$/, "").trim();
      const textarea = editorRef.current;
      const pos = textarea ? textarea.selectionStart : contentRef.current.length;
      const block = "\n\n```mermaid\n" + result + "\n```\n";
      const newContent =
        contentRef.current.substring(0, pos) + block + contentRef.current.substring(pos);
      handleContentChange(newContent);
      setShowAiGenerate(false);
      setAiGenerateDesc("");
    } catch (err) {
      setAiGenerateError(err instanceof Error ? err.message : String(err));
    } finally {
      setAiGenerating(false);
    }
  }, [aiSettings, aiGenerateDesc, handleContentChange]);

  // --- TOC 自動挿入 ---
  const handleInsertToc = useCallback(() => {
    const regex = /^(#{1,6})\s+(.+)/gm;
    const headings: Array<{ depth: number; text: string }> = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
      headings.push({ depth: match[1].length, text: match[2].trim() });
    }
    if (headings.length === 0) {
      showToast(tRef.current("toast.noHeadings"));
      return;
    }

    const minDepth = Math.min(...headings.map((h) => h.depth));
    const toc = headings
      .map((h) => {
        const indent = "  ".repeat(h.depth - minDepth);
        const id = makeHeadingId(h.text);
        return `${indent}- [${h.text}](#${id})`;
      })
      .join("\n");

    const tocBlock = `## ${tRef.current("format.tocLabel")}\n\n${toc}\n\n`;

    const textarea = editorRef.current;
    let insertPosition = textarea ? textarea.selectionStart : 0;

    // フロントマターの後に挿入
    if (content.startsWith("---\n") || content.startsWith("---\r\n")) {
      const end = content.indexOf("\n---", 4);
      if (end !== -1) insertPosition = Math.max(insertPosition, end + 5);
    }

    const newContent =
      content.substring(0, insertPosition) +
      tocBlock +
      content.substring(insertPosition);
    handleContentChange(newContent);
  }, [content, handleContentChange]);

  // --- Paste from clipboard ---
  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        showToast(tRef.current("toast.clipboardEmpty"), true);
        return;
      }
      setFileTree([]);
      setActiveFile(null);
      undoStackRef.current = [];
      redoStackRef.current = [];
      setContentUndoAvailable(false);
      setContentRedoAvailable(false);
      setContent(text);
      setDirty(false);

      // 現タブのfilePath もリセット
      const currentId = activeTabIdRef.current;
      setTabs((prev) =>
        prev.map((t) =>
          t.id === currentId
            ? { ...t, filePath: null, content: text, dirty: false }
            : t
        )
      );
      showToast(tRef.current("toast.pastedFromClipboard"));
    } catch (error) {
      console.error("Clipboard read error:", error);
      showToast(tRef.current("toast.clipboardReadFailed"), true);
    }
  }, []);

  // --- Paste image from clipboard ---
  const handlePasteImage = useCallback(
    async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData?.items;
      if (!items) {
        console.warn("[paste] no clipboardData.items");
        return;
      }

      // クリップボードに画像があるか確認
      let imageItem: DataTransferItem | null = null;
      for (const item of Array.from(items)) {
        console.debug("[paste] item:", item.kind, item.type);
        if (item.kind === "file" && item.type.startsWith("image/")) {
          imageItem = item;
          break;
        }
      }
      if (!imageItem) {
        console.debug("[paste] no image found, passing to default handler");
        return; // テキストペーストは通常処理に任せる
      }

      e.preventDefault();

      const blob = imageItem.getAsFile();
      if (!blob) {
        console.warn("[paste] getAsFile() returned null");
        return;
      }
      console.debug("[paste] image blob:", blob.type, blob.size, "bytes");

      try {
        const { mkdir, exists } = await import("@tauri-apps/plugin-fs");

        // タイムスタンプベースのファイル名
        const now = new Date();
        const ts = now.getFullYear().toString() +
          String(now.getMonth() + 1).padStart(2, "0") +
          String(now.getDate()).padStart(2, "0") +
          String(now.getHours()).padStart(2, "0") +
          String(now.getMinutes()).padStart(2, "0") +
          String(now.getSeconds()).padStart(2, "0");
        const ext = blob.type === "image/jpeg" ? "jpg" : blob.type === "image/gif" ? "gif" : "png";
        const fileName = `${ts}.${ext}`;

        let imgDir: string;
        let insertText: string;

        if (activeFile) {
          // ファイル保存済み → 相対パス (images/xxx.png)
          const dir = activeFile.replace(/[\\/][^\\/]+$/, "");
          imgDir = `${dir}/images`;
          insertText = `![](images/${fileName})`;
        } else {
          // 無題ファイル → tempフォルダに保存、絶対パスで挿入
          const { tempDir } = await import("@tauri-apps/api/path");
          const tmp = await tempDir();
          imgDir = `${tmp}markdown-studio-images`;
          insertText = `![](${imgDir.replace(/\\/g, "/")}/${fileName})`;
        }

        if (!(await exists(imgDir))) {
          await mkdir(imgDir, { recursive: true });
        }

        const filePath = `${imgDir}/${fileName}`;

        // 画像を保存
        const arrayBuffer = await blob.arrayBuffer();
        await writeFile(filePath, new Uint8Array(arrayBuffer));

        // エディタにマークダウン画像構文を挿入
        const textarea = editorRef.current;
        if (!textarea) return;
        const pos = textarea.selectionStart;
        const newContent =
          contentRef.current.substring(0, pos) +
          insertText +
          contentRef.current.substring(pos);
        handleContentChange(newContent);

        // カーソルを挿入テキストの後ろに移動
        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = pos + insertText.length;
        });

        showToast(tRef.current("toast.imageSaved", { name: fileName }));
      } catch (error) {
        console.error("Image paste error:", error);
        showToast(tRef.current("toast.imagePasteFailed"), true);
      }
    },
    [activeFile, handleContentChange]
  );

  // --- Copy rich text ---
  const handleCopyRichText = useCallback(async () => {
    const el = previewRef.current;
    if (!el) return;
    try {
      const styledHtml = `<div style="font-family: 'Segoe UI', 'Meiryo', sans-serif; font-size: 14px; line-height: 1.8;">${el.innerHTML}</div>`;
      const htmlBlob = new Blob([styledHtml], { type: "text/html" });
      const textBlob = new Blob([el.innerText], { type: "text/plain" });
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": htmlBlob,
          "text/plain": textBlob,
        }),
      ]);
      showToast(tRef.current("toast.richCopied"));
    } catch (error) {
      console.error("Rich text copy error:", error);
      showToast(tRef.current("toast.richCopyFailed"), true);
    }
  }, []);

  // --- Outline heading click ---
  const handleOutlineClick = useCallback((headingId: string) => {
    const preview = previewRef.current;
    if (!preview) return;
    const el = preview.querySelector(`#${headingId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // --- File drag & drop (Tauri ネイティブ API) ---
  // Tauri の WebView では OS からのファイルドロップはブラウザの onDrop に到達しない。
  // getCurrentWebview().onDragDropEvent() を使用する。
  const loadFileRef = useRef(loadFile);
  loadFileRef.current = loadFile;
  const handleContentChangeRef = useRef(handleContentChange);
  handleContentChangeRef.current = handleContentChange;

  // 起動時にコマンドライン引数で渡されたファイルを開く（.md ファイル関連付け用）
  // + 2回目以降の起動は single-instance プラグインが open-file イベントを送る
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let disposed = false;

    (async () => {
      try {
        const initialFile: string | null = await invoke("get_initial_file");
        if (initialFile) {
          loadFileRef.current(initialFile);
        }
      } catch { /* no initial file */ }

      // 既存インスタンスにファイルが渡された場合のリスナー
      try {
        const { listen } = await import("@tauri-apps/api/event");
        const u = await listen<string>("open-file", (event) => {
          if (event.payload) {
            loadFileRef.current(event.payload);
          }
        });
        if (disposed) {
          u();
        } else {
          unlisten = u;
        }
      } catch { /* ignore */ }
    })();

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    // StrictMode の double-mount 対策: async が解決する前に cleanup が走ると
    // unlisten が undefined のまま2個目のリスナが登録されて重複発火する。
    // disposed フラグで「もう破棄済みなら解除する」を保証する。
    let unlisten: (() => void) | undefined;
    let disposed = false;

    (async () => {
      try {
        const { getCurrentWebview } = await import("@tauri-apps/api/webview");
        const u = await getCurrentWebview().onDragDropEvent(async (event) => {
          if (event.payload.type !== "drop") return;
          const paths = event.payload.paths;
          if (!paths || paths.length === 0) return;

          const mdExtensions = [".md", ".markdown", ".txt"];
          const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".svg", ".webp"];

          for (const filePath of paths) {
            const ext = filePath.toLowerCase().replace(/^.*(\.[^.]+)$/, "$1");

            if (mdExtensions.includes(ext)) {
              // Markdown ファイルは新タブで開く
              await loadFileRef.current(filePath);
            } else if (imageExtensions.includes(ext)) {
              // 画像ファイルはエディタにマークダウン画像構文を挿入
              const textarea = editorRef.current;
              if (!textarea) continue;
              try {
                const { convertFileSrc } = await import("@tauri-apps/api/core");
                const assetUrl = convertFileSrc(filePath);
                const altText = filePath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "") || "image";
                const insertText = `![${altText}](${assetUrl})`;
                const pos = textarea.selectionStart;
                const newContent =
                  contentRef.current.substring(0, pos) +
                  insertText +
                  contentRef.current.substring(pos);
                handleContentChangeRef.current(newContent);
              } catch {
                // fallback
              }
            }
          }
        });
        if (disposed) {
          u();
        } else {
          unlisten = u;
        }
      } catch (e) {
        console.error("Failed to register drag-drop handler:", e);
      }
    })();

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  // --- Keyboard shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.ctrlKey && e.key === "s") {
        e.preventDefault();
        handleSave();
      } else if (e.ctrlKey && e.key === "z") {
        e.preventDefault();
        handleUndo();
      } else if (e.ctrlKey && e.key === "y") {
        e.preventDefault();
        handleRedo();
      } else if (e.ctrlKey && (e.key === "f" || e.key === "h")) {
        e.preventDefault();
        setShowSearch((s) => !s);
      } else if (e.ctrlKey && e.shiftKey && e.key === "C") {
        e.preventDefault();
        handleCopyRichText();
      } else if (e.ctrlKey && e.key === "b") {
        e.preventDefault();
        handleInsertFormatting("bold");
      } else if (e.ctrlKey && e.key === "i") {
        e.preventDefault();
        handleInsertFormatting("italic");
      } else if (e.ctrlKey && e.key === "\\") {
        e.preventDefault();
        setEditorVisible((v) => !v);
      } else if (e.ctrlKey && e.key === "t") {
        e.preventDefault();
        openNewTab();
      } else if (e.ctrlKey && e.key === "w") {
        e.preventDefault();
        // 閉じる前にdirtyチェック
        const tab = tabsRef.current.find((t) => t.id === activeTabIdRef.current);
        if (tab?.dirty) {
          const name = tab.filePath ? tab.filePath.split(/[\\/]/).pop() ?? tRef.current("tab.thisFile") : tRef.current("tab.untitled");
          if (!window.confirm(tRef.current("confirm.unsavedClose", { name }))) return;
        }
        closeTab(activeTabIdRef.current);
      } else if (e.key === "F11" || (e.key === "Escape" && isPreviewOnly)) {
        e.preventDefault();
        togglePreviewOnly();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    handleSave,
    handleUndo,
    handleRedo,
    handleCopyRichText,
    handleInsertFormatting,
    openNewTab,
    closeTab,
    togglePreviewOnly,
    isPreviewOnly,
  ]);

  // --- Close dropdowns on outside click ---
  useEffect(() => {
    if (!aiTransformOpen && !templatePos) return;
    const handleClick = () => {
      setAiTransformOpen(false);
      setAiTransformPos(null);
      setTemplatePos(null);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [aiTransformOpen, templatePos]);

  // --- Divider drag ---
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;
      const startX = e.clientX;
      const containerRect = container.getBoundingClientRect();
      const startRatio = editorRatio;

      const handleMouseMove = (e: MouseEvent) => {
        const deltaX = e.clientX - startX;
        const newRatio = startRatio + (deltaX / containerRect.width) * 100;
        setEditorRatio(Math.max(15, Math.min(75, newRatio)));
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [editorRatio]
  );

  const toolbarCanUndo = contentUndoAvailable;
  const toolbarCanRedo = contentRedoAvailable;

  return (
    <div className="app">
      {!isPreviewOnly && (
        <Toolbar
          dirty={dirty}
          canUndo={toolbarCanUndo}
          canRedo={toolbarCanRedo}
          theme={theme}
          editorVisible={editorVisible}
          leftPanelVisible={leftPanelVisible}
          recentFiles={recentFiles}
          onOpenFolder={handleOpenFolder}
          onOpenFile={handleOpenFile}
          onOpenRecent={loadFile}
          onSave={handleSave}
          onSaveAs={handleSaveAs}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onToggleSearch={() => setShowSearch((s) => !s)}
          onToggleTheme={toggleTheme}
          onExportPdf={handleExportPdf}
          onExportHtml={handleExportHtml}
          onExportWord={handleExportWord}
          onCopyRichText={handleCopyRichText}
          onPasteFromClipboard={handlePasteFromClipboard}
          onToggleEditor={() => setEditorVisible((v) => !v)}
          onToggleLeftPanel={() => setLeftPanelVisible((v) => !v)}
          isPreviewOnly={isPreviewOnly}
          onTogglePreviewOnly={togglePreviewOnly}
          onOpenSettings={() => setShowSettings(true)}
        />
      )}

      {!isPreviewOnly && (
        <TabBar
          tabs={tabs}
          activeTabId={activeTabId}
          onSelectTab={switchToTab}
          onCloseTab={closeTab}
          onNewTab={openNewTab}
        />
      )}

      {showSearch && (
        <SearchReplace
          textContent={content}
          onTextReplace={handleContentChange}
          onClose={() => setShowSearch(false)}
        />
      )}

      <div className="app-body">
        {/* 左パネル（フォルダ / アウトライン） */}
        {leftPanelVisible && (
          <div className="left-panel">
            <div className="left-panel-tabs">
              <button
                className={`left-tab ${leftPanel === "folder" ? "active" : ""}`}
                onClick={() => setLeftPanel("folder")}
              >
                {t("panel.folder")}
              </button>
              <button
                className={`left-tab ${leftPanel === "outline" ? "active" : ""}`}
                onClick={() => setLeftPanel("outline")}
              >
                {t("panel.outline")}
              </button>
              <button
                className="left-tab left-panel-close"
                onClick={() => setLeftPanelVisible(false)}
                title={t("panel.hide")}
              >
                ✕
              </button>
            </div>
            {leftPanel === "folder" ? (
              <FileTree
                entries={fileTree}
                activeFile={activeFile}
                onSelectFile={loadFile}
              />
            ) : (
              <OutlinePanel content={content} onHeadingClick={handleOutlineClick} />
            )}
          </div>
        )}

        <div
          className="content-area"
          style={{ display: "flex", flexDirection: "row" }}
          ref={containerRef}
        >
          {editorVisible && (
            <>
              <div
                className="editor-panel"
                style={{ flex: `0 0 ${editorRatio}%` }}
              >
                <div className="editor-panel-header">
                  <span>{t("editor.sourceLabel")}</span>
                  <button
                    className={`sync-scroll-btn ${syncScroll ? "active" : ""}`}
                    onClick={() => setSyncScroll((v) => !v)}
                    title={syncScroll ? t("editor.syncOn") : t("editor.syncOff")}
                  >
                    {t("editor.syncBtn")}
                  </button>
                </div>
                <div className="format-bar">
                  <button className="format-btn" onMouseDown={(e) => { e.preventDefault(); handleInsertFormatting("bold"); }} title={t("format.bold")}><b>B</b></button>
                  <button className="format-btn" onMouseDown={(e) => { e.preventDefault(); handleInsertFormatting("italic"); }} title={t("format.italic")}><i>I</i></button>
                  <button className="format-btn" onMouseDown={(e) => { e.preventDefault(); handleInsertFormatting("strike"); }} title={t("format.strike")}><s>S</s></button>
                  <span className="format-separator" />
                  <button className="format-btn" onMouseDown={(e) => { e.preventDefault(); handleInsertFormatting("h1"); }} title={t("format.h1")}>H1</button>
                  <button className="format-btn" onMouseDown={(e) => { e.preventDefault(); handleInsertFormatting("h2"); }} title={t("format.h2")}>H2</button>
                  <button className="format-btn" onMouseDown={(e) => { e.preventDefault(); handleInsertFormatting("h3"); }} title={t("format.h3")}>H3</button>
                  <span className="format-separator" />
                  <button className="format-btn" onMouseDown={(e) => { e.preventDefault(); handleInsertFormatting("ul"); }} title={t("format.ul")}>{t("format.ulLabel")}</button>
                  <button className="format-btn" onMouseDown={(e) => { e.preventDefault(); handleInsertFormatting("ol"); }} title={t("format.ol")}>{t("format.olLabel")}</button>
                  <button className="format-btn" onMouseDown={(e) => { e.preventDefault(); handleInsertFormatting("quote"); }} title={t("format.quote")}>{t("format.quoteLabel")}</button>
                  <span className="format-separator" />
                  <button className="format-btn format-btn-mono" onMouseDown={(e) => { e.preventDefault(); handleInsertFormatting("code"); }} title={t("format.code")}>`code`</button>
                  <button className="format-btn" onMouseDown={(e) => { e.preventDefault(); handleInsertFormatting("link"); }} title={t("format.link")}>{t("format.linkLabel")}</button>
                  <button className="format-btn" onMouseDown={(e) => { e.preventDefault(); handleInsertFormatting("hr"); }} title={t("format.hr")}>{t("format.hrLabel")}</button>
                  <span className="format-separator" />
                  <button className="format-btn" onMouseDown={(e) => { e.preventDefault(); handleInsertToc(); }} title={t("format.toc")}>{t("format.tocLabel")}</button>
                  <button className="format-btn" onMouseDown={(e) => { e.preventDefault(); handleImportCsv(); }} title={t("format.csv")}>CSV</button>
                </div>
                {/* ===== AI ツールバー (常に全表示) ===== */}
                {(() => {
                  const aiEnabled = !!aiSettings.apiKey;
                  return (
                    <div className={`ai-bar ${aiEnabled ? "ai-bar--on" : "ai-bar--off"}`}>
                      {/* 状態チップ */}
                      <span
                        className="ai-bar__chip"
                        title={aiEnabled
                          ? t("aibar.enabledChip", { provider: aiSettings.provider, model: aiSettings.model })
                          : t("aibar.disabledChip")}
                      >
                        {aiEnabled ? "✦ AI" : "⚙ AI"}
                      </span>
                      <span className="ai-bar__sep" />
                      {/* Feature 3: Mermaid テンプレート (APIキー不要) */}
                      <button
                        ref={templateBtnRef}
                        className="ai-bar__btn"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (templatePos) {
                            setTemplatePos(null);
                          } else {
                            const rect = templateBtnRef.current?.getBoundingClientRect();
                            if (rect) setTemplatePos({ x: rect.left, y: rect.bottom + 2 });
                          }
                        }}
                        title={t("aibar.templateTitle")}
                      >
                        {t("aibar.templateBtn")}
                      </button>
                      <span className="ai-bar__sep" />
                      {/* Feature 2: AI テキスト変換 */}
                      <button
                        ref={aiTransformBtnRef}
                        className={`ai-bar__btn${!aiEnabled ? " ai-bar__btn--inactive" : ""}${aiTransforming ? " ai-bar__btn--busy" : ""}`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!aiEnabled) {
                            showToast(t("toast.apiKeyNotSetOpening"));
                            setShowSettings(true);
                            return;
                          }
                          const textarea = editorRef.current;
                          if (!textarea) return;
                          if (textarea.selectionStart === textarea.selectionEnd) {
                            showToast(t("toast.selectTextFirst"));
                            return;
                          }
                          savedSelectionRef.current = {
                            start: textarea.selectionStart,
                            end: textarea.selectionEnd,
                          };
                          if (aiTransformOpen) {
                            setAiTransformOpen(false);
                            setAiTransformPos(null);
                          } else {
                            const rect = aiTransformBtnRef.current?.getBoundingClientRect();
                            if (rect) setAiTransformPos({ x: rect.left, y: rect.bottom + 2 });
                            setAiTransformOpen(true);
                          }
                        }}
                        title={aiEnabled ? t("aibar.transformTitleOn") : t("aibar.apiKeyOffTitle")}
                        disabled={aiTransforming}
                      >
                        {aiTransforming ? t("aibar.transformBusy") : t("aibar.transformBtn")}
                      </button>
                      {/* Feature 1: AI Mermaid 生成 */}
                      <button
                        className={`ai-bar__btn${!aiEnabled ? " ai-bar__btn--inactive" : ""}`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          if (!aiEnabled) {
                            showToast(t("toast.apiKeyNotSetOpening"));
                            setShowSettings(true);
                            return;
                          }
                          setAiGenerateError("");
                          setShowAiGenerate(true);
                        }}
                        title={aiEnabled ? t("aibar.generateTitleOn") : t("aibar.apiKeyOffTitle")}
                      >
                        {t("aibar.generateBtn")}
                      </button>
                      {/* API未設定時: 設定を促すリンク */}
                      {!aiEnabled && (
                        <button
                          className="ai-bar__setup-hint"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setShowSettings(true);
                          }}
                          title={t("aibar.setupHintTitle")}
                        >
                          {t("aibar.setupHint")}
                        </button>
                      )}
                    </div>
                  );
                })()}
                <textarea
                  ref={editorRef}
                  className="editor-textarea"
                  value={content}
                  onChange={(e) => handleContentChange(e.target.value)}
                  onPaste={handlePasteImage}
                  placeholder={t("editor.placeholder")}
                />
              </div>
              <div className="divider" onMouseDown={handleMouseDown} />
            </>
          )}
          <MarkdownPreview
            content={content}
            filePath={activeFile}
            previewRef={previewRef}
            aiSettings={aiSettings}
            onUpdateMermaidBlock={handleUpdateMermaidBlock}
            onInlineEdit={handleInlineEdit}
            isPreviewOnly={isPreviewOnly}
            onExitPreviewOnly={togglePreviewOnly}
          />
        </div>
      </div>

      <StatusBar
        content={content}
        autoSave={autoSave}
        onToggleAutoSave={() => setAutoSave((v) => !v)}
      />

      {/* Settings modal */}
      {showSettings && (
        <Settings
          settings={aiSettings}
          onSave={handleSaveAiSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Feature 3: Mermaid Template dropdown */}
      {templatePos && (
        <div
          className="ai-floating-dropdown"
          style={{ left: templatePos.x, top: templatePos.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {MERMAID_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              className="ai-dropdown-item"
              onMouseDown={(e) => {
                e.preventDefault();
                handleInsertTemplate(locale === "ja" ? tpl.codeJa : tpl.codeEn);
              }}
            >
              {t(tpl.labelKey)}
            </button>
          ))}
        </div>
      )}

      {/* Feature 2: AI Transform dropdown */}
      {aiTransformOpen && aiTransformPos && (
        <div
          className="ai-floating-dropdown"
          style={{ left: aiTransformPos.x, top: aiTransformPos.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {TRANSFORM_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              className="ai-dropdown-item"
              onMouseDown={(e) => {
                e.preventDefault();
                handleAiTransform(opt.id);
              }}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
      )}

      {/* Feature 1: AI Mermaid Generate modal */}
      {showAiGenerate && (
        <div className="ai-gen-overlay" onClick={() => { setShowAiGenerate(false); setAiGenerateDesc(""); setAiGenerateError(""); }}>
          <div className="ai-gen-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ai-gen-header">
              <span className="ai-gen-title">{t("aigen.title")}</span>
              <button className="settings-close" onClick={() => { setShowAiGenerate(false); setAiGenerateDesc(""); setAiGenerateError(""); }}>✕</button>
            </div>
            <p className="ai-gen-hint">{t("aigen.hint")}</p>
            <textarea
              className="ai-gen-textarea"
              value={aiGenerateDesc}
              onChange={(e) => setAiGenerateDesc(e.target.value)}
              placeholder={t("aigen.placeholder")}
              rows={4}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handleAiGenerateMermaid();
                }
              }}
            />
            {aiGenerateError && (
              <p className="ai-gen-error">{aiGenerateError}</p>
            )}
            <div className="ai-gen-footer">
              <button
                className="settings-close-btn"
                onClick={() => { setShowAiGenerate(false); setAiGenerateDesc(""); setAiGenerateError(""); }}
              >
                {t("aigen.cancel")}
              </button>
              <button
                className="settings-save-btn"
                onClick={handleAiGenerateMermaid}
                disabled={aiGenerating || !aiGenerateDesc.trim()}
              >
                {aiGenerating ? t("aigen.generating") : t("aigen.generate")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`toast ${toast.isError ? "toast-error" : "toast-success"}`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default App;
