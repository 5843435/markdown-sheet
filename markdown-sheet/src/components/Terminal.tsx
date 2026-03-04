import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import "@xterm/xterm/css/xterm.css";
import "./Terminal.css";

interface Props {
  cwd: string;
  visible: boolean;
  theme: "light" | "dark";
}

const LIGHT_THEME = {
  background: "#ffffff",
  foreground: "#1e1e1e",
  cursor: "#1e1e1e",
  cursorAccent: "#ffffff",
  selectionBackground: "#add6ff",
  black: "#000000",
  red: "#cd3131",
  green: "#00bc00",
  yellow: "#949800",
  blue: "#0451a5",
  magenta: "#bc05bc",
  cyan: "#0598bc",
  white: "#555555",
  brightBlack: "#666666",
  brightRed: "#cd3131",
  brightGreen: "#14ce14",
  brightYellow: "#b5ba00",
  brightBlue: "#0451a5",
  brightMagenta: "#bc05bc",
  brightCyan: "#0598bc",
  brightWhite: "#a5a5a5",
};

const DARK_THEME = {
  background: "#1e1e1e",
  foreground: "#cccccc",
  cursor: "#cccccc",
  cursorAccent: "#1e1e1e",
  selectionBackground: "#264f78",
  black: "#000000",
  red: "#cd3131",
  green: "#0dbc79",
  yellow: "#e5e510",
  blue: "#2472c8",
  magenta: "#bc3fbc",
  cyan: "#11a8cd",
  white: "#e5e5e5",
  brightBlack: "#666666",
  brightRed: "#f14c4c",
  brightGreen: "#23d18b",
  brightYellow: "#f5f543",
  brightBlue: "#3b8eea",
  brightMagenta: "#d670d6",
  brightCyan: "#29b8db",
  brightWhite: "#e5e5e5",
};

export default function Terminal({ cwd, visible, theme }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const cwdRef = useRef(cwd);
  cwdRef.current = cwd;
  const unlistenOutputRef = useRef<(() => void) | null>(null);
  const unlistenExitRef = useRef<(() => void) | null>(null);

  // Spawn (or respawn) PTY session with current cwd
  const spawnPty = async (xterm: XTerm) => {
    // Kill existing session if any
    if (sessionIdRef.current) {
      const oldId = sessionIdRef.current;
      sessionIdRef.current = null;
      unlistenOutputRef.current?.();
      unlistenExitRef.current?.();
      unlistenOutputRef.current = null;
      unlistenExitRef.current = null;
      await invoke("kill_pty", { sessionId: oldId }).catch(() => {});
    }

    try {
      const id = await invoke<string>("spawn_pty", {
        cwd: cwdRef.current,
        cols: xterm.cols,
        rows: xterm.rows,
      });
      sessionIdRef.current = id;

      // Listen for PTY output
      unlistenOutputRef.current = await listen<string>(`pty-output-${id}`, (event) => {
        const bytes = Uint8Array.from(atob(event.payload), (c) => c.charCodeAt(0));
        xterm.write(bytes);
      });

      // Listen for PTY exit
      unlistenExitRef.current = await listen<void>(`pty-exit-${id}`, () => {
        xterm.write("\r\n[Process exited]\r\n");
        unlistenOutputRef.current?.();
        unlistenExitRef.current?.();
        unlistenOutputRef.current = null;
        unlistenExitRef.current = null;
      });
    } catch (e) {
      xterm.write(`\r\nFailed to start terminal: ${e}\r\n`);
    }
  };

  // Initialize terminal on mount
  useEffect(() => {
    if (initializedRef.current || !containerRef.current) return;
    initializedRef.current = true;

    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'Cascadia Code', 'Consolas', monospace",
      theme: theme === "dark" ? DARK_THEME : LIGHT_THEME,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    const unicode11Addon = new Unicode11Addon();

    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);
    xterm.loadAddon(unicode11Addon);
    xterm.unicode.activeVersion = "11";

    xterm.open(containerRef.current!);
    fitAddon.fit();

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // Send input from xterm to PTY
    xterm.onData((data) => {
      if (sessionIdRef.current) {
        invoke("write_to_pty", {
          sessionId: sessionIdRef.current,
          data,
        }).catch(() => {});
      }
    });

    spawnPty(xterm);

    return () => {
      if (sessionIdRef.current) {
        invoke("kill_pty", { sessionId: sessionIdRef.current }).catch(() => {});
        sessionIdRef.current = null;
      }
      unlistenOutputRef.current?.();
      unlistenExitRef.current?.();
      xterm.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
      initializedRef.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Restart PTY when cwd changes
  const prevCwdRef = useRef(cwd);
  useEffect(() => {
    if (prevCwdRef.current === cwd) return;
    prevCwdRef.current = cwd;
    if (xtermRef.current) {
      xtermRef.current.clear();
      spawnPty(xtermRef.current);
    }
  }, [cwd]); // eslint-disable-line react-hooks/exhaustive-deps

  // Theme update
  useEffect(() => {
    if (xtermRef.current) {
      xtermRef.current.options.theme = theme === "dark" ? DARK_THEME : LIGHT_THEME;
    }
  }, [theme]);

  // Re-fit when visibility changes or on resize
  useEffect(() => {
    if (!visible || !fitAddonRef.current) return;

    // Delay fit to allow layout to settle
    const timer = setTimeout(() => {
      fitAddonRef.current?.fit();
      if (sessionIdRef.current && xtermRef.current) {
        invoke("resize_pty", {
          sessionId: sessionIdRef.current,
          cols: xtermRef.current.cols,
          rows: xtermRef.current.rows,
        }).catch(() => {});
      }
    }, 50);

    const observer = new ResizeObserver(() => {
      fitAddonRef.current?.fit();
      if (sessionIdRef.current && xtermRef.current) {
        invoke("resize_pty", {
          sessionId: sessionIdRef.current,
          cols: xtermRef.current.cols,
          rows: xtermRef.current.rows,
        }).catch(() => {});
      }
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [visible]);

  return (
    <div
      ref={containerRef}
      className="terminal-container"
      style={{ display: visible ? "block" : "none" }}
    />
  );
}
