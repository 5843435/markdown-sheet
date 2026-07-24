# Markdown Studio

[English](README.md) · [日本語](README.ja.md) · [简体中文](README.zh.md) · **Español** · [हिन्दी](README.hi.md) · [العربية](README.ar.md) · [Português](README.pt.md)

Un editor de Markdown para escritorio Windows, creado con Tauri 2 + React.

## Características

- **Vista previa de Markdown** — renderizado en tiempo real, con tablas GFM, resaltado de código y diagramas Mermaid
- **Modo de edición de tablas** — edita las tablas celda por celda con una interfaz al estilo de Excel
- **Barra de herramientas de formato** — negrita, cursiva, encabezados, listas, código, enlaces y más (Ctrl+B / Ctrl+I)
- **Sincronización de desplazamiento** — mantén sincronizadas las posiciones de desplazamiento del editor y la vista previa
- **Buscar y reemplazar** — funciona tanto en el modo de vista previa (texto completo) como en el modo de edición de tablas
- **Ajustes de fuente y presentación** — fuentes ajustables (incluidas fuentes japonesas como Meiryo, Yu Gothic, MS PMincho), tamaño de fuente y altura de línea
- **Exportación** — PDF, HTML, Word (.docx) y copia al portapapeles con formato enriquecido
- **Árbol de archivos** — abre una carpeta y navega o cambia entre archivos `.md`
- **Tema** — alternar entre claro y oscuro
- **Ocultar editor** — cambia al modo de solo vista previa (Ctrl+\\)
- **Deshacer / Rehacer** — historial de las operaciones de edición
- **Asistencia de IA** (opcional) — transforma el texto seleccionado (traducir, resumir, corregir, viñetas) y genera diagramas Mermaid a partir de una descripción, usando tu propia clave de API
- **Interfaz multilingüe** — 7 idiomas (English, 日本語, 简体中文, Español, हिन्दी, العربية, Português), detectados automáticamente según la configuración regional de tu sistema operativo y que puedes cambiar en cualquier momento en Ajustes

## Descarga

**Portable de 64 bits para Windows (no requiere instalación):**

[markdown-sheet-v1.6.0.exe.dat](https://github.com/5843435/markdown-sheet/raw/main/markdown-sheet-v1.6.0.exe.dat)

> Se distribuye con la extensión `.dat` para entornos donde las descargas desde GitHub Releases están bloqueadas.

### Pasos de configuración
1. Descarga desde el enlace anterior
2. Cambia el nombre del archivo a `markdown-sheet.exe`
3. **Haz clic derecho en el exe → Propiedades → marca "Desbloquear" en "Seguridad: este archivo proviene de…" → Aceptar**
4. Haz doble clic para ejecutar

## Configuración de desarrollo

```powershell
cd markdown-sheet
npm install
npm run tauri dev
```

## Compilación (instalador MSI)

```powershell
cd markdown-sheet
npm run tauri build
```

Los artefactos de compilación se escriben en `src-tauri/target/release/bundle/msi/`.

## Pila tecnológica

| Elemento | Detalles |
| --- | --- |
| Framework | Tauri 2 + React 19 |
| Lenguaje | TypeScript |
| Herramienta de compilación | Vite 6 |
| Analizador de Markdown | marked v17 (GFM) |
| Diagramas | Mermaid v11 |
| Resaltado de sintaxis | highlight.js |
| Exportación a PDF | html2pdf.js |
| Internacionalización | i18n personalizado y ligero (7 idiomas, sin dependencias en tiempo de ejecución) |

## Atajos de teclado

| Tecla | Acción |
| --- | --- |
| Ctrl+S | Guardar |
| Ctrl+Z | Deshacer |
| Ctrl+Y | Rehacer |
| Ctrl+B | Negrita |
| Ctrl+I | Cursiva |
| Ctrl+F / Ctrl+H | Buscar y reemplazar |
| Ctrl+Shift+C | Copia enriquecida |
| Ctrl+\\ | Alternar editor |
| F11 | Vista previa en pantalla completa |

## Internacionalización

La interfaz se distribuye en 7 idiomas. En el primer inicio, la aplicación detecta la configuración regional de tu sistema operativo y recurre al inglés si no es compatible. Puedes cambiar el idioma en cualquier momento desde **Ajustes → Idioma**; la elección se recuerda.

Las traducciones se encuentran en [markdown-sheet/src/i18n/locales/](markdown-sheet/src/i18n/locales/) — un archivo por idioma, todos referenciados contra `en.ts` (la fuente de verdad). Para agregar un idioma, crea un nuevo archivo `<code>.ts` que implemente todas las claves de `en.ts` y regístralo en [markdown-sheet/src/i18n/index.tsx](markdown-sheet/src/i18n/index.tsx).

---

## Arquitectura

### Estructura general

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

### Flujo de datos

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

### Árbol de componentes

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

## Licencia

Publicado bajo la [Licencia MIT](LICENSE).
