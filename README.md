# Markdown Studio

Tauri 2 + React 製の Windows デスクトップ向け Markdown エディタ。

## 主な機能

- **Markdown プレビュー** — リアルタイムレンダリング、GFM テーブル・コードハイライト・Mermaid 図対応
- **テーブル編集モード** — Excel ライクな UI でテーブルをセル単位で編集
- **書式ツールバー** — 太字・斜体・見出し・リスト・コード・リンクなど（Ctrl+B / Ctrl+I）
- **スクロール同期** — エディタとプレビューのスクロール位置を連動
- **検索・置換** — プレビューモード（テキスト全体）／テーブル編集モード両対応
- **フォント・表示設定** — メイリオ / 游ゴシック / MS P明朝 など日本語フォントに対応、フォントサイズ・行間も調整可能
- **エクスポート** — PDF 出力、HTML エクスポート、書式付きクリップボードコピー
- **ファイルツリー** — フォルダを開いて `.md` ファイルを一覧表示・切替
- **テーマ** — ライト / ダーク切替
- **エディタ非表示** — プレビュー専用モードへ切替（Ctrl+\）
- **Undo / Redo** — テーブル編集の操作履歴

## 開発環境セットアップ

```powershell
cd C:\Tools\markdown-sheet\markdown-sheet
npm install
npm run tauri dev
```

## ビルド（MSI インストーラー）

```powershell
cd C:\Tools\markdown-sheet\markdown-sheet
npm run tauri build
```

ビルド成果物は `src-tauri/target/release/bundle/msi/` に出力されます。

## 技術スタック

| 項目 | 内容 |
| --- | --- |
| フレームワーク | Tauri 2 + React 19 |
| 言語 | TypeScript |
| ビルドツール | Vite 6 |
| Markdown パーサー | marked v17 (GFM) |
| 図ダイアグラム | Mermaid v11 |
| シンタックスハイライト | highlight.js |
| PDF 出力 | html2pdf.js |

## キーボードショートカット

| キー | 機能 |
| --- | --- |
| Ctrl+S | 保存 |
| Ctrl+Z | Undo |
| Ctrl+Y | Redo |
| Ctrl+B | 太字 |
| Ctrl+I | 斜体 |
| Ctrl+F / Ctrl+H | 検索・置換 |
| Ctrl+Shift+C | 書式付きコピー |
| Ctrl+\ | エディタ表示切替 |

---

## アーキテクチャ

### 全体構成

```mermaid
graph TB
    subgraph TAURI["Tauri 2 デスクトップアプリ"]
        subgraph RUST["Rust バックエンド"]
            CMD["commands.rs\nget_file_tree()\nread_markdown_file()\nsave_markdown_file()"]
            RPARSER["markdown_parser.rs\nparse_markdown()\nrebuild_document()"]
            CMD --- RPARSER
        end

        IPC{{"Tauri IPC\ninvoke()"}}

        subgraph WEBVIEW["WebView — React 19 + TypeScript"]
            APP["App.tsx\n状態管理 / キーボードSC / Undo スタック\nスクロール同期 / エクスポート"]

            subgraph COMP["Components"]
                TBR["Toolbar"]
                FT["FileTree"]
                MP["MarkdownPreview"]
                TE["TableEditor + ContextMenu"]
                SR["SearchReplace"]
            end

            subgraph HOOKS["Hooks / Lib"]
                UTE["useTableEditor\nセル編集・行列追加削除"]
                UUR["useUndoRedo(T)\n汎用 Undo/Redo スタック"]
                MDPJS["markdownParser.ts\nJS側パーサー(同期処理用)"]
            end

            subgraph EXTLIB["外部ライブラリ"]
                MRK["marked v17\nMarkdown → HTML"]
                MRM["Mermaid v11\n図ダイアグラム"]
                HJS["highlight.js\nコードハイライト"]
                H2P["html2pdf.js\nPDF出力"]
            end
        end
    end

    subgraph OS["OS"]
        FS[("ファイルシステム\n.md / .html / .svg")]
        DLG["ネイティブダイアログ"]
        CLIP["クリップボード"]
    end

    RUST <--> IPC
    IPC <--> APP
    APP --> COMP
    APP --> HOOKS
    MP --> EXTLIB
    UTE --> UUR
    APP <-->|"plugin-fs"| FS
    APP <-->|"plugin-dialog"| DLG
    APP -->|"navigator.clipboard"| CLIP
```

### データフロー

```mermaid
flowchart LR
    FILE[".md ファイル"]

    subgraph LOAD["ファイル読み込み"]
        IPC1["invoke(read_markdown_file)"]
        RPARSE["Rust: parse_markdown()\n→ ParsedDocument\n  lines / tables"]
    end

    subgraph STATE["App State"]
        CONTENT["content\n(raw markdown)"]
        TABLES["tables\n(MarkdownTable[])"]
    end

    subgraph PREVIEW_FLOW["プレビュー描画"]
        NORM["normalizeTableLines()\nテーブル空行除去"]
        MARKED["marked()\nGFM → HTML"]
        MERMAID["mermaid.render()\nSVG 生成"]
        HTML["レンダリング済み HTML"]
    end

    subgraph TABLE_FLOW["テーブル編集"]
        TABLED["TableEditor\n(Excel風 UI)"]
        UNDO["useUndoRedo\nスナップショット管理"]
        REBUILD["rebuildDocument()\nMarkdown 再構築"]
    end

    subgraph EXPORT["エクスポート"]
        PDF["PDF\nhtml2pdf.js"]
        HTMLEXP["HTML ファイル"]
        CLIP["書式付きクリップボード\n(PPT/Excel 対応)"]
        SVG["Mermaid SVG"]
    end

    FILE --> IPC1 --> RPARSE --> CONTENT & TABLES
    CONTENT --> NORM --> MARKED --> MERMAID --> HTML
    TABLES --> TABLED --> UNDO --> REBUILD
    REBUILD -->|"invoke / writeTextFile"| FILE
    HTML --> PDF & HTMLEXP & CLIP
    MERMAID --> SVG
```

### コンポーネントツリー

```mermaid
graph TD
    App["App.tsx\ncontent / tables / activeFile\neditorVisible / syncScroll"]

    App --> Toolbar["Toolbar\n保存・Undo・テーマ・エクスポート"]
    App --> FileTree["FileTree\n.md ファイル一覧"]
    App --> SearchReplace["SearchReplace\ntext mode / table mode"]
    App --> MarkdownPreview["MarkdownPreview\nmarked + mermaid + hljs\nフォント・行間設定"]
    App --> TableEditor["TableEditor\nセル編集・Tab移動\nコンテキストメニュー"]

    TableEditor --> ContextMenu["ContextMenu\n行列追加・削除"]

    App -..->|uses| useTableEditor["useTableEditor\nupdateCell / addRow\naddColumn / deleteRow"]
    useTableEditor -..->|uses| useUndoRedo["useUndoRedo(T)\npush / undo / redo / reset"]
```
