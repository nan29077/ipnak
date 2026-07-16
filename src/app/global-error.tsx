"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "#f4f6f9",
          color: "#16243d",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 320 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 8px" }}>
            앱에 문제가 발생했어요
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "#5b6b85", margin: "0 0 20px" }}>
            예기치 못한 오류가 생겼어요. 페이지를 새로고침해 주세요.
          </p>
          <button
            onClick={() => reset()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              borderRadius: 12,
              border: "none",
              background: "#1f3a63",
              color: "#fff",
              fontSize: 15,
              fontWeight: 600,
              padding: "12px 20px",
              cursor: "pointer",
            }}
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  );
}
