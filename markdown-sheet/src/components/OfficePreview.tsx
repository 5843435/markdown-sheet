import { useEffect, useRef, useState } from "react";
import "./OfficePreview.css";

interface Props {
  data: Uint8Array;
  fileType: string;
  theme: "light" | "dark";
}

export default function OfficePreview({ data, fileType, theme }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [sheetHtml, setSheetHtml] = useState("");

  // .docx rendering
  useEffect(() => {
    if (fileType !== ".docx") return;
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    (async () => {
      try {
        const { renderAsync } = await import("docx-preview");
        if (cancelled) return;
        container.innerHTML = "";
        await renderAsync(data.buffer, container, undefined, {
          className: "office-docx-wrapper",
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: true,
          ignoreFonts: false,
          breakPages: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
        });
        setError(null);
      } catch (e) {
        if (!cancelled) {
          setError(`DOCX描画エラー: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [data, fileType]);

  // .xlsx / .xlsm rendering
  useEffect(() => {
    if (fileType !== ".xlsx" && fileType !== ".xlsm") return;

    let cancelled = false;
    (async () => {
      try {
        const XLSX = await import("xlsx");
        if (cancelled) return;
        const workbook = XLSX.read(data, { type: "array" });
        setSheetNames(workbook.SheetNames);
        setActiveSheet(0);

        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        if (sheet) {
          setSheetHtml(XLSX.utils.sheet_to_html(sheet, { id: "office-xlsx-table" }));
        }
        setError(null);
      } catch (e) {
        if (!cancelled) {
          setError(`Excel読み込みエラー: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [data, fileType]);

  // Sheet tab switch
  const handleSheetChange = async (index: number) => {
    setActiveSheet(index);
    try {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[index]];
      if (sheet) {
        setSheetHtml(XLSX.utils.sheet_to_html(sheet, { id: "office-xlsx-table" }));
      }
    } catch (e) {
      setError(`シート切替エラー: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  if (error) {
    return (
      <div className={`office-preview office-preview--${theme}`}>
        <div className="office-error">{error}</div>
      </div>
    );
  }

  if (fileType === ".docx") {
    return (
      <div className={`office-preview office-preview--${theme}`}>
        <div ref={containerRef} className="office-docx-container" />
      </div>
    );
  }

  // xlsx / xlsm
  return (
    <div className={`office-preview office-preview--${theme}`}>
      {sheetNames.length > 1 && (
        <div className="office-sheet-tabs">
          {sheetNames.map((name, i) => (
            <button
              key={name}
              className={`office-sheet-tab${i === activeSheet ? " active" : ""}`}
              onClick={() => handleSheetChange(i)}
            >
              {name}
            </button>
          ))}
        </div>
      )}
      <div
        className="office-xlsx-container"
        dangerouslySetInnerHTML={{ __html: sheetHtml }}
      />
    </div>
  );
}
