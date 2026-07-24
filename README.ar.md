# Markdown Studio

[English](README.md) · [日本語](README.ja.md) · [简体中文](README.zh.md) · [Español](README.es.md) · [हिन्दी](README.hi.md) · **العربية** · [Português](README.pt.md)

محرّر Markdown لسطح مكتب Windows، مبني باستخدام Tauri 2 + React.

## المزايا

- **معاينة Markdown** — عرض فوري، مع جداول GFM وتمييز الشيفرة ومخططات Mermaid
- **وضع تحرير الجداول** — حرّر الجداول خلية بخلية بواجهة تشبه Excel
- **شريط أدوات التنسيق** — عريض ومائل وعناوين وقوائم وشيفرة وروابط والمزيد (Ctrl+B / Ctrl+I)
- **مزامنة التمرير** — إبقاء موضعَي التمرير في المحرّر والمعاينة متزامنَين
- **البحث والاستبدال** — يعمل في وضع المعاينة (النص كاملاً) وفي وضع تحرير الجداول على حد سواء
- **إعدادات الخط والعرض** — خطوط قابلة للضبط (بما في ذلك الخطوط اليابانية مثل Meiryo وYu Gothic وMS PMincho)، وحجم الخط، وارتفاع السطر
- **التصدير** — PDF وHTML وWord (.docx) ونسخ منسّق (غني) إلى الحافظة
- **شجرة الملفات** — افتح مجلداً وتصفّح ملفات `.md` وبدّل بينها
- **السمة** — تبديل بين الوضع الفاتح والداكن
- **إخفاء المحرّر** — التبديل إلى وضع المعاينة فقط (Ctrl+\\)
- **تراجع / إعادة** — سجل لعمليات التحرير
- **مساعدة الذكاء الاصطناعي** (اختياري) — حوّل النص المحدد (ترجمة، تلخيص، تدقيق لغوي، نقاط) وأنشئ مخططات Mermaid من وصف، باستخدام مفتاح API الخاص بك
- **واجهة متعددة اللغات** — 7 لغات (English, 日本語, 简体中文, Español, हिन्दी, العربية, Português)، تُكتشف تلقائياً من إعدادات لغة نظام التشغيل ويمكن تبديلها في أي وقت من الإعدادات

## التنزيل

**نسخة محمولة لنظام Windows 64-bit (لا تتطلب تثبيتاً):**

[markdown-sheet-v1.6.0.exe.dat](https://github.com/5843435/markdown-sheet/raw/main/markdown-sheet-v1.6.0.exe.dat)

> يُوزَّع بامتداد `.dat` من أجل البيئات التي يُحظر فيها التنزيل من GitHub Releases.

### خطوات الإعداد
1. نزّل الملف من الرابط أعلاه
2. أعد تسمية الملف إلى `markdown-sheet.exe`
3. **انقر بزر الماوس الأيمن على ملف exe ← Properties ← فعّل "Unblock" ضمن "Security: This file came from…" ← OK**
4. انقر نقراً مزدوجاً للتشغيل

## إعداد بيئة التطوير

```powershell
cd markdown-sheet
npm install
npm run tauri dev
```

## البناء (مثبّت MSI)

```powershell
cd markdown-sheet
npm run tauri build
```

تُكتب مخرجات البناء إلى `src-tauri/target/release/bundle/msi/`.

## المكدس التقني

| العنصر | التفاصيل |
| --- | --- |
| إطار العمل | Tauri 2 + React 19 |
| اللغة | TypeScript |
| أداة البناء | Vite 6 |
| محلّل Markdown | marked v17 (GFM) |
| المخططات | Mermaid v11 |
| تمييز بناء الجملة | highlight.js |
| تصدير PDF | html2pdf.js |
| التدويل | i18n مخصّص خفيف الوزن (7 لغات، بدون تبعيات وقت التشغيل) |

## اختصارات لوحة المفاتيح

| المفتاح | الإجراء |
| --- | --- |
| Ctrl+S | حفظ |
| Ctrl+Z | تراجع |
| Ctrl+Y | إعادة |
| Ctrl+B | عريض |
| Ctrl+I | مائل |
| Ctrl+F / Ctrl+H | البحث والاستبدال |
| Ctrl+Shift+C | نسخ منسّق |
| Ctrl+\\ | تبديل المحرّر |
| F11 | معاينة بملء الشاشة |

## التدويل

تأتي الواجهة بـ 7 لغات. عند التشغيل الأول يكتشف التطبيق لغة نظام التشغيل ويعود إلى English إن لم تكن مدعومة. يمكنك تغيير اللغة في أي وقت من **الإعدادات ← اللغة**؛ ويُحفظ اختيارك.

توجد الترجمات ضمن [markdown-sheet/src/i18n/locales/](markdown-sheet/src/i18n/locales/) — ملف واحد لكل لغة، وكلها مفهرسة مقابل `en.ts` (المصدر المرجعي). لإضافة لغة، أنشئ ملف `<code>.ts` جديداً ينفّذ كل مفتاح موجود في `en.ts` وسجّله في [markdown-sheet/src/i18n/index.tsx](markdown-sheet/src/i18n/index.tsx).

---

## البنية المعمارية

### الهيكل العام

```mermaid
graph LR
    subgraph TAURI["Tauri 2 desktop app"]
        subgraph RUST["Rust backend"]
            CMD["File operations\n(read / save)"]
            RPARSER["Text formatting / conversion"]
            CMD --- RPARSER
        end

        IPC{{"Integration"}}

        subgraph WEBVIEW["UI layer — React 19 + TypeScript"]
            APP["Main logic\n(state, history, sync, etc.)"]

            subgraph COMP["UI components"]
                TBR["Toolbar"]
                FT["File list"]
                MP["Preview"]
                TE["Table editing"]
                SR["Search & replace"]
            end

            subgraph HOOKS["Shared logic"]
                UTE["Table edit helpers"]
                UUR["Undo / redo"]
                MDPJS["Text parsing (sub-process)"]
            end

            subgraph EXTLIB["External libraries"]
                MRK["Text → readable format"]
                MRM["Diagram / chart rendering"]
                HJS["Code syntax highlighting"]
                H2P["PDF export"]
            end
        end
    end

    subgraph OS["Computer"]
        FS[("File storage")]
        DLG["File picker"]
        CLIP["Copy & paste"]
    end

    RUST <--> IPC
    IPC <--> APP
    APP --> COMP
    APP --> HOOKS
    MP --> EXTLIB
    UTE --> UUR
    APP <-->|"File access"| FS
    APP <-->|"Dialogs"| DLG
    APP -->|"Copy"| CLIP
```

### تدفق البيانات

```mermaid
flowchart LR
    FILE[".md file"]

    subgraph LOAD["File loading"]
        IPC1["invoke(read_markdown_file)"]
        RPARSE["Rust: parse_markdown()\n→ ParsedDocument\n  lines / tables"]
    end

    subgraph STATE["App State"]
        CONTENT["content\n(raw markdown)"]
        TABLES["tables\n(MarkdownTable[])"]
    end

    subgraph PREVIEW_FLOW["Preview rendering"]
        NORM["normalizeTableLines()\nremove blank table rows"]
        MARKED["marked()\nGFM → HTML"]
        MERMAID["mermaid.render()\nSVG generation"]
        HTML["Rendered HTML"]
    end

    subgraph TABLE_FLOW["Table editing"]
        TABLED["TableEditor\n(Excel-like UI)"]
        UNDO["useUndoRedo\nsnapshot management"]
        REBUILD["rebuildDocument()\nMarkdown rebuild"]
    end

    subgraph EXPORT["Export"]
        PDF["PDF\nhtml2pdf.js"]
        HTMLEXP["HTML file"]
        CLIP["Rich clipboard\n(PPT/Excel)"]
        SVG["Mermaid SVG"]
    end

    FILE --> IPC1 --> RPARSE --> CONTENT & TABLES
    CONTENT --> NORM --> MARKED --> MERMAID --> HTML
    TABLES --> TABLED --> UNDO --> REBUILD
    REBUILD -->|"invoke / writeTextFile"| FILE
    HTML --> PDF & HTMLEXP & CLIP
    MERMAID --> SVG
```

### شجرة المكوّنات

```mermaid
graph TD
    App["App.tsx\ncontent / tables / activeFile\neditorVisible / syncScroll"]

    App --> Toolbar["Toolbar\nSave, Undo, Theme, Export"]
    App --> FileTree["FileTree\n.md file list"]
    App --> SearchReplace["SearchReplace\ntext mode / table mode"]
    App --> MarkdownPreview["MarkdownPreview\nmarked + mermaid + hljs\nfont / line-height settings"]
    App --> TableEditor["TableEditor\ncell edit, Tab nav\ncontext menu"]

    TableEditor --> ContextMenu["ContextMenu\nadd/remove rows & cols"]

    App -..->|uses| useTableEditor["useTableEditor\nupdateCell / addRow\naddColumn / deleteRow"]
    useTableEditor -..->|uses| useUndoRedo["useUndoRedo(T)\npush / undo / redo / reset"]
```

## الرخصة

صادر بموجب [رخصة MIT](LICENSE).
