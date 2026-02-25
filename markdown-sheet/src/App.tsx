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
import TableEditor from "./components/TableEditor";
import Toolbar from "./components/Toolbar";
import { useTableEditor } from "./hooks/useTableEditor";
import { callAI } from "./lib/callAI";
import { makeHeadingId } from "./lib/headingId";
import { parseMarkdown, rebuildDocument } from "./lib/markdownParser";
import type { AiSettings, FileEntry, MarkdownTable, ParsedDocument, RecentFile, Tab } from "./types";

// ========== AI & Template Constants ==========

const MERMAID_GENERATE_PROMPT =
  "You are a Mermaid diagram generator. " +
  "Based on the user's description, generate appropriate Mermaid diagram source code. " +
  "Output ONLY the raw Mermaid source. Do NOT include code fences, explanation, or any other text.";

const TRANSFORM_OPTIONS = [
  {
    id: "translate",
    label: "翻訳 (日⇔英)",
    prompt:
      "Translate the following text. If it is Japanese, translate to English. If it is English, translate to Japanese. " +
      "Return ONLY the translated text, no explanations.",
  },
  {
    id: "summarize",
    label: "要約",
    prompt:
      "Summarize the following text concisely in Japanese. Return ONLY the summary, no additional commentary.",
  },
  {
    id: "proofread",
    label: "校正",
    prompt:
      "Proofread and correct any grammatical or spelling errors in the following text. " +
      "Preserve the original language and tone. Return ONLY the corrected text.",
  },
  {
    id: "bullets",
    label: "箇条書き変換",
    prompt:
      "Convert the following text into a Markdown bullet list using '- ' prefix. " +
      "Return ONLY the bullet list, one item per line.",
  },
] as const;

const MERMAID_TEMPLATES: { label: string; code: string }[] = [
  {
    label: "業務フロー図",
    code: `flowchart LR
  開始([開始]) --> 受注[受注処理]
  受注 --> 確認{在庫確認}
  確認 -->|あり| 出荷[出荷手配]
  確認 -->|なし| 発注[仕入発注]
  発注 --> 入荷[入荷処理]
  入荷 --> 出荷
  出荷 --> 請求[請求処理]
  請求 --> 終了([終了])`,
  },
  {
    label: "シーケンス図",
    code: `sequenceDiagram
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
  },
  {
    label: "ER図",
    code: `erDiagram
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
  },
  {
    label: "ガントチャート",
    code: `gantt
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
  },
  {
    label: "クラス図",
    code: `classDiagram
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
  },
  {
    label: "マインドマップ",
    code: `mindmap
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
  },
  {
    label: "組織図",
    code: `graph TD
  CEO[代表取締役]
  CEO --> COO[最高執行責任者]
  CEO --> CFO[最高財務責任者]
  COO --> 営業部[営業部長]
  COO --> 開発部[開発部長]
  営業部 --> 営業1[営業チーム1]
  営業部 --> 営業2[営業チーム2]
  開発部 --> FE[フロントエンドチーム]
  開発部 --> BE[バックエンドチーム]`,
  },
  {
    label: "状態遷移図",
    code: `stateDiagram-v2
  [*] --> 待機中
  待機中 --> 処理中 : 開始
  処理中 --> 完了 : 成功
  処理中 --> エラー : 失敗
  エラー --> 待機中 : リトライ
  完了 --> [*]
  エラー --> [*] : キャンセル`,
  },
  {
    label: "円グラフ",
    code: `pie title 売上構成比
  "製品A" : 42.5
  "製品B" : 27.3
  "製品C" : 18.2
  "その他" : 12.0`,
  },
];

// @ts-ignore
import html2pdf from "html2pdf.js";

type ViewTab = "preview" | "table";
type Theme = "light" | "dark";

function makeInitialTab(): Tab {
  return {
    id: crypto.randomUUID(),
    filePath: null,
    content: "",
    originalLines: [],
    tables: [],
    dirty: false,
    contentUndoStack: [],
    contentRedoStack: [],
  };
}

function App() {
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
  const [originalLines, setOriginalLines] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [activeViewTab, setActiveViewTab] = useState<ViewTab>("preview");
  const [editorVisible, setEditorVisible] = useState(true);
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

  // --- Table editor ---
  const {
    tables,
    updateCell,
    addRow,
    deleteRow,
    addColumn,
    deleteColumn,
    undo,
    redo,
    reset,
    canUndo,
    canRedo,
  } = useTableEditor([]);

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
  const tablesRef = useRef<MarkdownTable[]>([]);
  tablesRef.current = tables;
  const originalLinesRef = useRef<string[]>([]);
  originalLinesRef.current = originalLines;
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
    if (!syncScroll || !editorVisible || activeViewTab !== "preview") return;
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
  }, [syncScroll, editorVisible, activeViewTab]);

  // ====== Tab Management ======

  /** 現在の作業状態を現タブスロットに保存（refから読み取り → staleクロージャ回避） */
  const saveCurrentToTab = useCallback(() => {
    const id = activeTabIdRef.current;
    setTabs((prev) =>
      prev.map((t) =>
        t.id !== id
          ? t
          : {
              ...t,
              content: contentRef.current,
              originalLines: originalLinesRef.current,
              tables: structuredClone(tablesRef.current),
              dirty: dirtyRef.current,
              contentUndoStack: [...undoStackRef.current],
              contentRedoStack: [...redoStackRef.current],
            }
      )
    );
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
      setOriginalLines(newTab.originalLines);
      setDirty(newTab.dirty);
      setActiveFile(newTab.filePath);
      undoStackRef.current = [...newTab.contentUndoStack];
      redoStackRef.current = [...newTab.contentRedoStack];
      setContentUndoAvailable(newTab.contentUndoStack.length > 0);
      setContentRedoAvailable(newTab.contentRedoStack.length > 0);
      reset(newTab.tables);
    },
    [saveCurrentToTab, reset]
  );

  /** 新しい空タブを開く */
  const openNewTab = useCallback(() => {
    saveCurrentToTab();
    const newTab = makeInitialTab();
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setContent("");
    setOriginalLines([]);
    setDirty(false);
    setActiveFile(null);
    undoStackRef.current = [];
    redoStackRef.current = [];
    setContentUndoAvailable(false);
    setContentRedoAvailable(false);
    reset([]);
  }, [saveCurrentToTab, reset]);

  /** タブを閉じる */
  const closeTab = useCallback(
    (tabId: string) => {
      const currentTabs = tabsRef.current;
      if (currentTabs.length <= 1) return; // 最後のタブは閉じない

      const isActive = tabId === activeTabIdRef.current;

      // 閉じる前に現タブの状態を保存（他タブのデータが最新になるよう）
      if (isActive) {
        saveCurrentToTab();
      }

      // saveCurrentToTab が setTabs を呼ぶため、最新の tabs を再取得
      const latestTabs = tabsRef.current;
      const remaining = latestTabs.filter((t) => t.id !== tabId);

      if (isActive && remaining.length > 0) {
        const idx = latestTabs.findIndex((t) => t.id === tabId);
        const newActive = remaining[Math.min(idx, remaining.length - 1)];
        setContent(newActive.content);
        setOriginalLines(newActive.originalLines);
        setDirty(newActive.dirty);
        setActiveFile(newActive.filePath);
        undoStackRef.current = [...newActive.contentUndoStack];
        redoStackRef.current = [...newActive.contentRedoStack];
        setContentUndoAvailable(newActive.contentUndoStack.length > 0);
        setContentRedoAvailable(newActive.contentRedoStack.length > 0);
        reset(newActive.tables);
        setActiveTabId(newActive.id);
      }

      setTabs(remaining);
    },
    [reset, saveCurrentToTab]
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
        let doc: ParsedDocument;
        try {
          doc = await invoke("read_markdown_file", { filePath });
        } catch {
          const text = await readTextFile(filePath);
          doc = parseMarkdown(text);
        }

        const text = doc.lines.join("\n");

        // 現タブが空（未編集・ファイル未割当）なら上書き、そうでなければ新タブで開く
        const currentTab = tabsRef.current.find((t) => t.id === activeTabIdRef.current);
        const isCurrentEmpty = currentTab && !currentTab.filePath && !currentTab.dirty && !currentTab.content;

        if (isCurrentEmpty) {
          // 空タブに上書き
          const currentId = activeTabIdRef.current;
          setOriginalLines(doc.lines);
          reset(doc.tables);
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
                    originalLines: doc.lines,
                    tables: structuredClone(doc.tables),
                    dirty: false,
                    contentUndoStack: [],
                    contentRedoStack: [],
                  }
                : t
            )
          );
        } else {
          // 新タブで開く
          saveCurrentToTab();
          const newTab: Tab = {
            id: crypto.randomUUID(),
            filePath,
            content: text,
            originalLines: doc.lines,
            tables: structuredClone(doc.tables),
            dirty: false,
            contentUndoStack: [],
            contentRedoStack: [],
          };
          setTabs((prev) => [...prev, newTab]);
          setActiveTabId(newTab.id);
          setContent(text);
          setOriginalLines(doc.lines);
          setDirty(false);
          setActiveFile(filePath);
          undoStackRef.current = [];
          redoStackRef.current = [];
          setContentUndoAvailable(false);
          setContentRedoAvailable(false);
          reset(doc.tables);
        }

        addRecentFile(filePath);
      } catch (e) {
        console.error("ファイル読み込みエラー:", e);
        showToast("ファイル読み込みに失敗しました", true);
      }
    },
    [reset, switchToTab, addRecentFile, saveCurrentToTab]
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
          showToast("自動保存しました");
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
      showToast("フォルダ選択ダイアログを開けませんでした", true);
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
      showToast("ファイル選択ダイアログを開けませんでした", true);
      return;
    }
    if (!selected) return;
    await loadFile(selected);
  }, [loadFile]);

  // --- Save ---
  const handleSave = useCallback(async () => {
    if (!activeFile) return;
    try {
      if (activeViewTab === "table") {
        await invoke("save_markdown_file", {
          filePath: activeFile,
          originalLines,
          tables,
        });
      } else {
        await writeTextFile(activeFile, content);
      }
      setDirty(false);
      const currentId = activeTabIdRef.current;
      setTabs((prev) =>
        prev.map((t) => (t.id === currentId ? { ...t, dirty: false } : t))
      );
      showToast("保存しました");
    } catch {
      try {
        const text =
          activeViewTab === "table"
            ? rebuildDocument(originalLines, tables)
            : content;
        await writeTextFile(activeFile, text);
        setDirty(false);
        showToast("保存しました");
      } catch (e) {
        console.error("保存エラー:", e);
        showToast("保存に失敗しました", true);
      }
    }
  }, [activeFile, activeViewTab, originalLines, tables, content]);

  // --- Save As ---
  const handleSaveAs = useCallback(async () => {
    let selected: string | null = null;
    try {
      selected = await save({
        filters: [{ name: "Markdown", extensions: ["md"] }],
      });
    } catch (e) {
      console.error("ダイアログエラー:", e);
      showToast("保存ダイアログを開けませんでした", true);
      return;
    }
    if (!selected) return;
    try {
      const text =
        activeViewTab === "table"
          ? rebuildDocument(originalLines, tables)
          : content;
      await writeTextFile(selected, text);
      setActiveFile(selected);
      setDirty(false);
      const currentId = activeTabIdRef.current;
      setTabs((prev) =>
        prev.map((t) =>
          t.id === currentId ? { ...t, filePath: selected, dirty: false } : t
        )
      );
      addRecentFile(selected!);
      showToast("保存しました");
    } catch (e) {
      console.error("保存エラー:", e);
      showToast("保存に失敗しました", true);
    }
  }, [activeViewTab, originalLines, tables, content, addRecentFile]);

  // --- Apply content (undo/redo スタックを経由しない低レベル更新) ---
  const applyContent = useCallback(
    (newContent: string) => {
      setContent(newContent);
      setDirty(true);
      const doc = parseMarkdown(newContent);
      setOriginalLines(doc.lines);
      reset(doc.tables);
    },
    [reset]
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

  // --- Unified undo/redo (content mode と table mode を切り替え) ---
  const handleUndo = useCallback(() => {
    if (activeViewTab === "table") {
      undo();
    } else if (undoStackRef.current.length > 0) {
      const prev = undoStackRef.current.pop()!;
      redoStackRef.current.push(contentRef.current);
      setContentUndoAvailable(undoStackRef.current.length > 0);
      setContentRedoAvailable(true);
      applyContent(prev);
    }
  }, [activeViewTab, undo, applyContent]);

  const handleRedo = useCallback(() => {
    if (activeViewTab === "table") {
      redo();
    } else if (redoStackRef.current.length > 0) {
      const next = redoStackRef.current.pop()!;
      undoStackRef.current.push(contentRef.current);
      setContentUndoAvailable(true);
      setContentRedoAvailable(redoStackRef.current.length > 0);
      applyContent(next);
    }
  }, [activeViewTab, redo, applyContent]);

  // --- Table cell operations ---
  const handleUpdateCell = useCallback(
    (tableIndex: number, row: number, col: number, value: string) => {
      updateCell(tableIndex, row, col, value);
      setDirty(true);
    },
    [updateCell]
  );

  const handleAddRow = useCallback(
    (tableIndex: number, afterRow: number, position: "above" | "below") => {
      addRow(tableIndex, afterRow, position);
      setDirty(true);
    },
    [addRow]
  );

  const handleDeleteRow = useCallback(
    (tableIndex: number, row: number) => {
      deleteRow(tableIndex, row);
      setDirty(true);
    },
    [deleteRow]
  );

  const handleAddColumn = useCallback(
    (tableIndex: number, afterCol: number, position: "left" | "right") => {
      addColumn(tableIndex, afterCol, position);
      setDirty(true);
    },
    [addColumn]
  );

  const handleDeleteColumn = useCallback(
    (tableIndex: number, col: number) => {
      deleteColumn(tableIndex, col);
      setDirty(true);
    },
    [deleteColumn]
  );

  // --- テーブル変更をエディタに反映 ---
  useEffect(() => {
    if (activeViewTab === "table" && dirty && originalLines.length > 0) {
      const rebuilt = rebuildDocument(originalLines, tables);
      setContent(rebuilt);
    }
  }, [tables, activeViewTab, dirty, originalLines]);

  // --- タブ切替時にデータ同期 ---
  const handleViewTabChange = useCallback(
    (tab: ViewTab) => {
      if (tab === "table" && activeViewTab === "preview") {
        const doc = parseMarkdown(content);
        setOriginalLines(doc.lines);
        reset(doc.tables);
      }
      setActiveViewTab(tab);
    },
    [activeViewTab, content, reset]
  );

  // --- Export PDF ---
  const handleExportPdf = useCallback(async () => {
    const el = previewRef.current;
    if (!el) return;
    try {
      const fileName = activeFile
        ? activeFile.split(/[\\/]/).pop()?.replace(/\.md$/i, "") || "document"
        : "document";

      // Tauri の save ダイアログでファイルパスを取得
      const savePath = await save({
        defaultPath: `${fileName}.pdf`,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (!savePath) return;

      showToast("PDF出力中...");

      const opt = {
        margin: 10,
        image: { type: "jpeg" as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm" as const, format: "a4" as const, orientation: "portrait" as const },
      };

      // html2pdf.js で ArrayBuffer を取得し、Tauri の writeFile で保存
      const arrayBuffer: ArrayBuffer = await html2pdf().set(opt).from(el).outputPdf("arraybuffer");
      await writeFile(savePath, new Uint8Array(arrayBuffer));
      showToast("PDFを保存しました");
    } catch (error) {
      console.error("PDF export error:", error);
      showToast("PDF出力に失敗しました", true);
    }
  }, [activeFile]);

  // --- Export HTML ---
  const handleExportHtml = useCallback(async () => {
    const el = previewRef.current;
    if (!el) return;
    try {
      const htmlContent = el.innerHTML;
      const title = activeFile
        ? activeFile.split(/[\\/]/).pop() || "document"
        : "document";
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
      body { font-family: "Segoe UI", "Meiryo", sans-serif; line-height: 1.8; color: #333; max-width: 800px; margin: 0 auto; padding: 2rem; }
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
        showToast("HTMLをエクスポートしました");
      }
    } catch (error) {
      console.error("HTML export error:", error);
      showToast("HTMLエクスポートに失敗しました", true);
    }
  }, [activeFile]);

  // --- CSV Export ---
  const handleExportCsv = useCallback(
    async (tableIndex: number) => {
      const table = tables[tableIndex];
      if (!table) return;

      const rows = [table.headers, ...table.rows];
      const csv = rows
        .map((row) =>
          row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")
        )
        .join("\r\n");

      try {
        const path = await save({
          filters: [{ name: "CSV", extensions: ["csv"] }],
          defaultPath: `${table.heading || `table${tableIndex + 1}`}.csv`,
        });
        if (path) {
          await writeTextFile(path, "\uFEFF" + csv); // BOM for Excel
          showToast("CSVをエクスポートしました");
        }
      } catch (e) {
        showToast("CSVエクスポートに失敗しました", true);
      }
    },
    [tables]
  );

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
      showToast("CSVをインポートしました");
    } catch (e) {
      showToast("CSVインポートに失敗しました", true);
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
        const text = selected || "テキスト";
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
          const text = selected || "リンクテキスト";
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
    async (prompt: string) => {
      setAiTransformOpen(false);
      setAiTransformPos(null);
      const sel = savedSelectionRef.current;
      if (!sel || sel.start === sel.end) return;
      if (!aiSettings.apiKey) {
        showToast("⚙ 設定でAPIキーを入力してください", true);
        return;
      }
      const selectedText = contentRef.current.substring(sel.start, sel.end);
      setAiTransforming(true);
      try {
        const result = await callAI(aiSettings, prompt, selectedText);
        const newContent =
          contentRef.current.substring(0, sel.start) +
          result +
          contentRef.current.substring(sel.end);
        handleContentChange(newContent);
        showToast("AIが変換しました");
      } catch (err) {
        showToast(`AI変換失敗: ${err instanceof Error ? err.message : String(err)}`, true);
      } finally {
        setAiTransforming(false);
      }
    },
    [aiSettings, handleContentChange]
  );

  // --- Feature 1: AI Mermaid generation ---
  const handleAiGenerateMermaid = useCallback(async () => {
    if (!aiSettings.apiKey) {
      setAiGenerateError("⚙ 設定でAPIキーを入力してください");
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
      showToast("見出しが見つかりません");
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

    const tocBlock = `## 目次\n\n${toc}\n\n`;

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
        showToast("クリップボードにテキストがありません", true);
        return;
      }
      setFileTree([]);
      setActiveFile(null);
      undoStackRef.current = [];
      redoStackRef.current = [];
      setContentUndoAvailable(false);
      setContentRedoAvailable(false);
      const doc = parseMarkdown(text);
      setOriginalLines(doc.lines);
      reset(doc.tables);
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
      showToast("クリップボードから貼り付けました");
    } catch (error) {
      console.error("Clipboard read error:", error);
      showToast("クリップボードの読み取りに失敗しました", true);
    }
  }, [reset]);

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
      showToast("書式付きでコピーしました (PPT/Excelに貼り付け可能)");
    } catch (error) {
      console.error("Rich text copy error:", error);
      showToast("書式付きコピーに失敗しました", true);
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

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    (async () => {
      try {
        const { getCurrentWebview } = await import("@tauri-apps/api/webview");
        unlisten = await getCurrentWebview().onDragDropEvent(async (event) => {
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
      } catch (e) {
        console.error("Failed to register drag-drop handler:", e);
      }
    })();

    return () => { unlisten?.(); };
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
      } else if (e.ctrlKey && e.key === "b" && activeViewTab === "preview") {
        e.preventDefault();
        handleInsertFormatting("bold");
      } else if (e.ctrlKey && e.key === "i" && activeViewTab === "preview") {
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
          const name = tab.filePath ? tab.filePath.split(/[\\/]/).pop() ?? "このファイル" : "無題";
          if (!window.confirm(`"${name}" の変更は保存されていません。閉じますか？`)) return;
        }
        closeTab(activeTabIdRef.current);
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
    activeViewTab,
    openNewTab,
    closeTab,
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

  // Toolbar に渡す canUndo/canRedo: モードに応じて content/table を切り替え
  const toolbarCanUndo = activeViewTab === "table" ? canUndo : contentUndoAvailable;
  const toolbarCanRedo = activeViewTab === "table" ? canRedo : contentRedoAvailable;

  return (
    <div className="app">
      <Toolbar
        dirty={dirty}
        canUndo={toolbarCanUndo}
        canRedo={toolbarCanRedo}
        theme={theme}
        activeViewTab={activeViewTab}
        editorVisible={editorVisible}
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
        onCopyRichText={handleCopyRichText}
        onPasteFromClipboard={handlePasteFromClipboard}
        onToggleEditor={() => setEditorVisible((v) => !v)}
        onOpenSettings={() => setShowSettings(true)}
      />

      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={switchToTab}
        onCloseTab={closeTab}
        onNewTab={openNewTab}
      />

      {showSearch && (
        activeViewTab === "table" ? (
          <SearchReplace
            tables={tables}
            onReplace={handleUpdateCell}
            onClose={() => setShowSearch(false)}
          />
        ) : (
          <SearchReplace
            textContent={content}
            onTextReplace={handleContentChange}
            onClose={() => setShowSearch(false)}
          />
        )
      )}

      {/* View Tabs */}
      <div className="view-tabs">
        <button
          className={`view-tab ${activeViewTab === "preview" ? "active" : ""}`}
          onClick={() => handleViewTabChange("preview")}
        >
          プレビュー
        </button>
        <button
          className={`view-tab ${activeViewTab === "table" ? "active" : ""}`}
          onClick={() => handleViewTabChange("table")}
        >
          テーブル編集
        </button>
      </div>

      <div className="app-body">
        {/* 左パネル（フォルダ / アウトライン） */}
        <div className="left-panel">
          <div className="left-panel-tabs">
            <button
              className={`left-tab ${leftPanel === "folder" ? "active" : ""}`}
              onClick={() => setLeftPanel("folder")}
            >
              フォルダ
            </button>
            <button
              className={`left-tab ${leftPanel === "outline" ? "active" : ""}`}
              onClick={() => setLeftPanel("outline")}
            >
              アウトライン
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

        {activeViewTab === "preview" ? (
          /* Preview mode: Editor + Preview */
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
                    <span>Markdown ソース</span>
                    <button
                      className={`sync-scroll-btn ${syncScroll ? "active" : ""}`}
                      onClick={() => setSyncScroll((v) => !v)}
                      title={syncScroll ? "スクロール同期: ON (クリックでOFF)" : "スクロール同期: OFF (クリックでON)"}
                    >
                      ⇅ 同期
                    </button>
                  </div>
                  <div className="format-bar">
                    <button className="format-btn" onMouseDown={(e) => { e.preventDefault(); handleInsertFormatting("bold"); }} title="太字 (Ctrl+B)"><b>B</b></button>
                    <button className="format-btn" onMouseDown={(e) => { e.preventDefault(); handleInsertFormatting("italic"); }} title="斜体 (Ctrl+I)"><i>I</i></button>
                    <button className="format-btn" onMouseDown={(e) => { e.preventDefault(); handleInsertFormatting("strike"); }} title="取り消し線"><s>S</s></button>
                    <span className="format-separator" />
                    <button className="format-btn" onMouseDown={(e) => { e.preventDefault(); handleInsertFormatting("h1"); }} title="見出し1">H1</button>
                    <button className="format-btn" onMouseDown={(e) => { e.preventDefault(); handleInsertFormatting("h2"); }} title="見出し2">H2</button>
                    <button className="format-btn" onMouseDown={(e) => { e.preventDefault(); handleInsertFormatting("h3"); }} title="見出し3">H3</button>
                    <span className="format-separator" />
                    <button className="format-btn" onMouseDown={(e) => { e.preventDefault(); handleInsertFormatting("ul"); }} title="箇条書きリスト">• リスト</button>
                    <button className="format-btn" onMouseDown={(e) => { e.preventDefault(); handleInsertFormatting("ol"); }} title="番号付きリスト">1. リスト</button>
                    <button className="format-btn" onMouseDown={(e) => { e.preventDefault(); handleInsertFormatting("quote"); }} title="引用">&gt; 引用</button>
                    <span className="format-separator" />
                    <button className="format-btn format-btn-mono" onMouseDown={(e) => { e.preventDefault(); handleInsertFormatting("code"); }} title="コード">`code`</button>
                    <button className="format-btn" onMouseDown={(e) => { e.preventDefault(); handleInsertFormatting("link"); }} title="リンク">&#128279; リンク</button>
                    <button className="format-btn" onMouseDown={(e) => { e.preventDefault(); handleInsertFormatting("hr"); }} title="水平線">&#8212; 区切り</button>
                    <span className="format-separator" />
                    <button className="format-btn" onMouseDown={(e) => { e.preventDefault(); handleInsertToc(); }} title="目次を挿入">目次</button>
                    <button className="format-btn" onMouseDown={(e) => { e.preventDefault(); handleImportCsv(); }} title="CSVをインポートして追加">CSV</button>
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
                            ? `AI有効: ${aiSettings.provider} / ${aiSettings.model}`
                            : "APIキーが未設定です。右の「⚙ 設定する」から設定してください"}
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
                          title="Mermaid図テンプレートを挿入（APIキー不要）"
                        >
                          図テンプレ ▾
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
                              showToast("APIキーが設定されていません。設定を開きます");
                              setShowSettings(true);
                              return;
                            }
                            const textarea = editorRef.current;
                            if (!textarea) return;
                            if (textarea.selectionStart === textarea.selectionEnd) {
                              showToast("テキストを選択してからクリックしてください");
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
                          title={aiEnabled ? "選択テキストをAIで変換（翻訳・要約・校正・箇条書き）" : "⚙ APIキー未設定 — クリックして設定を開く"}
                          disabled={aiTransforming}
                        >
                          {aiTransforming ? "変換中..." : "AI変換"}
                        </button>
                        {/* Feature 1: AI Mermaid 生成 */}
                        <button
                          className={`ai-bar__btn${!aiEnabled ? " ai-bar__btn--inactive" : ""}`}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            if (!aiEnabled) {
                              showToast("APIキーが設定されていません。設定を開きます");
                              setShowSettings(true);
                              return;
                            }
                            setAiGenerateError("");
                            setShowAiGenerate(true);
                          }}
                          title={aiEnabled ? "AIでMermaid図をゼロから生成" : "⚙ APIキー未設定 — クリックして設定を開く"}
                        >
                          AI図生成
                        </button>
                        {/* API未設定時: 設定を促すリンク */}
                        {!aiEnabled && (
                          <button
                            className="ai-bar__setup-hint"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setShowSettings(true);
                            }}
                            title="設定画面を開いてAPIキーを入力してください"
                          >
                            ⚙ 設定する →
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
                    placeholder="Markdownを入力するか、ファイルを開いてください..."
                  />
                </div>
                <div className="divider" onMouseDown={handleMouseDown} />
              </>
            )}
            <MarkdownPreview
              content={content}
              previewRef={previewRef}
              aiSettings={aiSettings}
              onUpdateMermaidBlock={handleUpdateMermaidBlock}
            />
          </div>
        ) : (
          /* Table edit mode */
          <TableEditor
            tables={tables}
            onUpdateCell={handleUpdateCell}
            onAddRow={handleAddRow}
            onDeleteRow={handleDeleteRow}
            onAddColumn={handleAddColumn}
            onDeleteColumn={handleDeleteColumn}
            onExportCsv={handleExportCsv}
          />
        )}
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
          {MERMAID_TEMPLATES.map((t) => (
            <button
              key={t.label}
              className="ai-dropdown-item"
              onMouseDown={(e) => {
                e.preventDefault();
                handleInsertTemplate(t.code);
              }}
            >
              {t.label}
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
                handleAiTransform(opt.prompt);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Feature 1: AI Mermaid Generate modal */}
      {showAiGenerate && (
        <div className="ai-gen-overlay" onClick={() => { setShowAiGenerate(false); setAiGenerateDesc(""); setAiGenerateError(""); }}>
          <div className="ai-gen-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ai-gen-header">
              <span className="ai-gen-title">✦ AIでMermaid図を生成</span>
              <button className="settings-close" onClick={() => { setShowAiGenerate(false); setAiGenerateDesc(""); setAiGenerateError(""); }}>✕</button>
            </div>
            <p className="ai-gen-hint">図の内容を日本語で説明してください。AIがMermaidコードを生成します。</p>
            <textarea
              className="ai-gen-textarea"
              value={aiGenerateDesc}
              onChange={(e) => setAiGenerateDesc(e.target.value)}
              placeholder="例: ECサイトの注文処理フロー図を作って。受注→在庫確認→出荷→請求の流れで"
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
                キャンセル
              </button>
              <button
                className="settings-save-btn"
                onClick={handleAiGenerateMermaid}
                disabled={aiGenerating || !aiGenerateDesc.trim()}
              >
                {aiGenerating ? "生成中..." : "生成 (Ctrl+Enter)"}
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
