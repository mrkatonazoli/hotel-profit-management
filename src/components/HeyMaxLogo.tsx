"use client";

import { useId } from "react";

// ─── Icon ─────────────────────────────────────────────────────────────────────

interface HeyMaxIconProps {
  size?: number;
  variant?: "full" | "mono" | "white" | "glyph";
}

export function HeyMaxIcon({ size = 40, variant = "full" }: HeyMaxIconProps) {
  const id = useId().replace(/:/g, "");

  const stroke = variant === "white" ? "#FFFFFF" : "#35BD78";
  const dot    = variant === "white" ? "#FFFFFF" : "#90DBAC";

  return (
    <svg width={size} height={size} viewBox="0 0 52 52" fill="none" aria-hidden="true">
      {variant === "full" && (
        <defs>
          <linearGradient id={`hm-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#153251" />
            <stop offset="1" stopColor="#09203A" />
          </linearGradient>
        </defs>
      )}
      {variant === "full"  && <rect width="52" height="52" rx="14" fill={`url(#hm-${id})`} />}
      {variant === "mono"  && <rect width="52" height="52" rx="14" fill="#153251" />}
      {variant === "white" && (
        <rect x="1.25" y="1.25" width="49.5" height="49.5" rx="13"
          fill="none" stroke="#FFFFFF" strokeWidth="2.5" />
      )}
      <polyline
        points="13,34 22,22 30,30 39,16"
        fill="none"
        stroke={stroke}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="39" cy="16" r="3.6" fill={dot} />
    </svg>
  );
}

// ─── Wordmark ─────────────────────────────────────────────────────────────────

interface HeyMaxWordmarkProps {
  size?: number;
  onDark?: boolean;
}

export function HeyMaxWordmark({ size = 28, onDark = false }: HeyMaxWordmarkProps) {
  return (
    <span style={{
      fontFamily: "'Schibsted Grotesk', system-ui, -apple-system, 'Segoe UI', sans-serif",
      fontSize: size,
      letterSpacing: "-0.02em",
      lineHeight: 1,
      whiteSpace: "nowrap",
      color: onDark ? "#FFFFFF" : "#153251",
    }}>
      <span style={{ fontWeight: 500, color: onDark ? "#AEB9C8" : "#153251" }}>Hey</span>
      <span style={{ fontWeight: 700, color: onDark ? "#FFFFFF" : "#153251" }}>Max</span>
      <span style={{ color: "#35BD78" }}>!</span>
    </span>
  );
}

// ─── Full lockup ──────────────────────────────────────────────────────────────

interface HeyMaxLogoProps {
  size?: number;
  onDark?: boolean;
  iconVariant?: "full" | "mono" | "white" | "glyph";
}

export function HeyMaxLogo({ size = 28, onDark = false, iconVariant = "full" }: HeyMaxLogoProps) {
  const iconSize = Math.round(size * 1.2);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: size * 0.34 }}>
      <HeyMaxIcon size={iconSize} variant={iconVariant} />
      <HeyMaxWordmark size={size} onDark={onDark} />
    </span>
  );
}

export default HeyMaxLogo;
