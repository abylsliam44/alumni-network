const ICONS = {
  home: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <circle cx="17" cy="9" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M14 20c0-2.4 1.5-4.5 3.5-5.4" />
    </>
  ),
  graph: (
    <>
      <path d="M4 20V8M10 20v-6M16 20V4M22 20H2" />
    </>
  ),
  jobs: (
    <>
      <rect x="3" y="6" width="18" height="14" rx="2" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 12h18" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </>
  ),
  cal: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </>
  ),
  message: <path d="M21 12a8 8 0 0 1-12 7l-5 1 1-4a8 8 0 1 1 16-4z" />,
  msg: <path d="M21 12a8 8 0 0 1-12 7l-5 1 1-4a8 8 0 1 1 16-4z" />,
  bell: (
    <>
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9z" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </>
  ),
  spark: (
    <>
      <path d="M12 3l1.8 5.4L19 10l-5.2 1.6L12 17l-1.8-5.4L5 10l5.2-1.6z" />
      <path d="M19 4l.6 1.8L21 6.4l-1.4.6L19 9l-.6-1.8L17 6.4l1.4-.6z" />
    </>
  ),
  doc: (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6M8 14h8M8 18h6" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.5-4.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  arrowR: <path d="M5 12h14M13 6l6 6-6 6" />,
  arrowL: <path d="M19 12H5M11 18l-6-6 6-6" />,
  arrowU: <path d="M12 19V5M6 11l6-6 6 6" />,
  arrowD: <path d="M12 5v14M6 13l6 6 6-6" />,
  chevronR: <path d="M9 6l6 6-6 6" />,
  chevronL: <path d="M15 6l-6 6 6 6" />,
  chevronD: <path d="M6 9l6 6 6-6" />,
  chevronU: <path d="M6 15l6-6 6 6" />,
  filter: <path d="M4 5h16l-6 8v6l-4-2v-4z" />,
  send: (
    <>
      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" />
    </>
  ),
  paper: <path d="M15 5l4 4-9 9-4 1 1-4 8-10z" />,
  edit: <path d="M15 5l4 4-9 9-4 1 1-4 8-10z" />,
  check: <path d="M5 12l5 5L20 7" />,
  close: (
    <>
      <path d="M6 6l12 12M18 6l-12 12" />
    </>
  ),
  x: (
    <>
      <path d="M6 6l12 12M18 6l-12 12" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4M6 10l6-6 6 6" />
      <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v12M6 14l6 6 6-6" />
      <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 1 0-5.7-5.7l-1.5 1.5" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5" />
    </>
  ),
  pin: (
    <>
      <path d="M12 2v8a4 4 0 0 1 4 4H8a4 4 0 0 1 4-4z" />
      <path d="M12 14v8M9 22h6" />
    </>
  ),
  mapPin: (
    <>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  sliders: (
    <>
      <path d="M4 6h12M4 12h6M4 18h16" />
      <circle cx="18" cy="6" r="2" />
      <circle cx="13" cy="12" r="2" />
      <circle cx="9" cy="18" r="2" />
    </>
  ),
  external: (
    <>
      <path d="M14 4h6v6" />
      <path d="M10 14L20 4" />
      <path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.04-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 5.21 15 1.7 1.7 0 0 0 3.66 14H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1.04 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.21 1.7 1.7 0 0 0 10 2.66V3a2 2 0 1 1 4 0v-.09a1.7 1.7 0 0 0 1.04 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87A1.7 1.7 0 0 0 21 9h.34a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.6 2z" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </>
  ),
  heart: <path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z" />,
  star: <path d="M12 2l3.1 6.6 7.3 1-5.3 5.1 1.3 7.3-6.4-3.4-6.4 3.4 1.3-7.3-5.3-5.1 7.3-1z" />,
  building: (
    <>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </>
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v5M12 16v.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-5M12 8v.01" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M5 6l1 14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-14" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </>
  ),
  video: (
    <>
      <rect x="2" y="6" width="14" height="12" rx="2" />
      <path d="M22 8l-6 4 6 4z" />
    </>
  ),
  paperclip: <path d="M21 11l-9 9a5 5 0 1 1-7-7l9-9a3 3 0 0 1 4 4L8.5 18a1 1 0 1 1-1.4-1.4L17 6.5" />,
  award: (
    <>
      <circle cx="12" cy="9" r="6" />
      <path d="M9 14l-2 7 5-3 5 3-2-7" />
    </>
  ),
  bookmark: <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />,
  refresh: (
    <>
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </>
  ),
  eye: (
    <>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <path d="M1 1l22 22" />
    </>
  ),
  bot: (
    <>
      <rect x="3" y="8" width="18" height="12" rx="2" />
      <path d="M12 4v4M8 14h.01M16 14h.01" />
    </>
  ),
  dot3: (
    <>
      <circle cx="6" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="18" cy="12" r="1.5" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4" />
    </>
  ),
  moon: <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />,
};

const Icon = ({ name, size = 18, strokeWidth = 1.5, ...props }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...props}
  >
    {ICONS[name] || null}
  </svg>
);

export const AituGlyph = ({ size = 32, color = 'currentColor', accent = 'var(--blue)' }) => {
  const cx = size / 2;
  const cy = size / 2;
  const arcs = [
    { r: size * 0.18, dots: 10, color, sweep: 360, start: 0 },
    { r: size * 0.3, dots: 14, color, sweep: 270, start: 200 },
    { r: size * 0.42, dots: 18, color: accent, sweep: 240, start: 230 },
    { r: size * 0.54, dots: 24, color, sweep: 200, start: 240 },
  ];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      {arcs.flatMap((arc, arcIndex) =>
        Array.from({ length: arc.dots }, (_, dotIndex) => {
          const t = arc.start + (arc.sweep / arc.dots) * dotIndex;
          const rad = (t * Math.PI) / 180;
          return (
            <circle
              key={`${arcIndex}-${dotIndex}`}
              cx={cx + Math.cos(rad) * arc.r}
              cy={cy + Math.sin(rad) * arc.r}
              r={Math.max(0.7, size * 0.022)}
              fill={arc.color}
              opacity="0.85"
            />
          );
        })
      )}
      <circle cx={cx} cy={cy} r={size * 0.1} fill={color} />
    </svg>
  );
};

export default Icon;
