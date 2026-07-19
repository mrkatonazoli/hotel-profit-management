/** DataHeaven wordmark — "D-lépcső" mark (ascending steps + D-bowl arc,
 * aurora gradient) + Space Grotesk name. */
export default function Wordmark({ size = 22 }: { size?: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        aria-hidden="true"
        style={{ filter: "drop-shadow(0 2px 8px rgba(129,140,248,0.45))" }}
      >
        <defs>
          <linearGradient id="dh-mark" x1="0" y1="24" x2="24" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#22D3EE" />
            <stop offset="0.52" stopColor="#818CF8" />
            <stop offset="1" stopColor="#C084FC" />
          </linearGradient>
        </defs>
        <path d="M12 2 A10 10 0 0 1 12 22 L12 17.5 A5.5 5.5 0 0 0 12 6.5 Z" fill="url(#dh-mark)" />
        <rect x="2" y="16" width="3.6" height="6" rx="1.1" fill="url(#dh-mark)" />
        <rect x="5.4" y="11" width="3.6" height="11" rx="1.1" fill="url(#dh-mark)" opacity="0.85" />
        <rect x="8.8" y="6" width="3.6" height="16" rx="1.1" fill="url(#dh-mark)" opacity="0.7" />
      </svg>
      <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, letterSpacing: "-0.02em", fontSize: size * 0.82 }}>
        Data<span className="grad-text">Heaven</span>
      </span>
    </span>
  );
}
