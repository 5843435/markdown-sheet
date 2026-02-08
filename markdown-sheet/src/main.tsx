import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Tauri環境の準備を待ってからReactアプリをレンダリング
async function initApp() {
  // Tauri環境かどうかチェック
  const isTauri =
    typeof window !== "undefined" &&
    (window as any).__TAURI_INTERNALS__ !== undefined;

  if (isTauri) {
    // Tauri環境の場合、少し待機してから初期化
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

initApp();
