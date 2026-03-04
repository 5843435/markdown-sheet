import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef } from "react";

export function useFileWatcher(
  filePath: string | null,
  onFileChanged: (changedPath: string) => void
) {
  const callbackRef = useRef(onFileChanged);
  callbackRef.current = onFileChanged;

  useEffect(() => {
    if (!filePath) return;

    let unlisten: (() => void) | null = null;

    const setup = async () => {
      try {
        await invoke("watch_file", { filePath });
        unlisten = await listen<string>("file-changed", (event) => {
          callbackRef.current(event.payload);
        });
      } catch (e) {
        console.error("File watcher setup failed:", e);
      }
    };

    setup();

    return () => {
      unlisten?.();
      invoke("unwatch_file").catch(() => {});
    };
  }, [filePath]);
}
