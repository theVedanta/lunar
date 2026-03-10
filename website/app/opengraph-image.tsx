import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Lunar — AI Code Review as LSP Diagnostics";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0a0a0a",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "flex-end",
          padding: "80px",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
        }}
      >
        {/* Grid background */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        {/* Top-right glow */}
        <div
          style={{
            position: "absolute",
            top: -120,
            right: -120,
            width: 500,
            height: 500,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(255,255,255,0.07) 0%, transparent 70%)",
          }}
        />

        {/* Wordmark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: 40,
          }}
        >
          <span
            style={{
              fontSize: 72,
              fontWeight: 800,
              letterSpacing: "-0.04em",
              color: "#ffffff",
            }}
          >
            LUNAR
          </span>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 32,
            fontWeight: 400,
            color: "rgba(255,255,255,0.55)",
            lineHeight: 1.4,
            maxWidth: 700,
            marginBottom: 56,
          }}
        >
          AI code review surfaced as{" "}
          <span style={{ color: "rgba(255,255,255,0.9)" }}>
            LSP diagnostics
          </span>
          . Inline, in your editor, as you write.
        </div>

        {/* Diagnostic pills */}
        <div style={{ display: "flex", gap: 12 }}>
          {[
            { label: "Error", color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
            { label: "Warning", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
            { label: "Info", color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
            {
              label: "Hint",
              color: "rgba(255,255,255,0.4)",
              bg: "rgba(255,255,255,0.06)",
            },
          ].map(({ label, color, bg }) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "8px 16px",
                borderRadius: 999,
                background: bg,
                border: `1px solid ${color}30`,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: color,
                }}
              />
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 500,
                  color,
                }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
