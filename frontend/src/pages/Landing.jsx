import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Avatar from '../components/ui/Avatar';
import Icon, { AituGlyph } from '../components/ui/Icon';
import ThemeToggle from '../components/ui/ThemeToggle';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';

const NODE_LABELS = [
  'Madiyar · Kaspi',
  'Asem · Kolesa',
  'Tomiris · Higgsfield',
  'Yerbol · Stripe',
  'Madina · Beeline',
  'Ruslan · Codify',
  'Dinara · Halyk',
  'Aisha · Halyk',
  'Marat · stealth',
  'Daulet · Kaspi',
];

const LIVE_FEED = [
  { n: 'Madina A.', action: 'accepted mentor request', t: 'now', tone: 'var(--ok)' },
  { n: 'Ruslan O.', action: 'opened ML intern role', t: '2m', tone: 'var(--blue)' },
  { n: 'Tomiris B.', action: 'posted: RAG benchmarks', t: '8m', tone: 'var(--ink-2)' },
  { n: 'Asem K.', action: 'is hiring · Kolesa', t: '11m', tone: 'var(--warm)' },
];

const FIRST_STEPS = [
  { k: '01', t: 'Import your resume', st: 'next' },
  { k: '02', t: 'Pick 3 mentors', st: 'queued' },
  { k: '03', t: 'Set career intent', st: 'queued' },
];

const seedRng = (i) => {
  const x = Math.sin(i * 9301 + 49297) * 233280;
  return x - Math.floor(x);
};

const Landing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();

  const stageRef = useRef(null);
  const target = useRef({ x: 0.5, y: 0.5 });
  const current = useRef({ x: 0.5, y: 0.5 });
  const [mouse, setMouse] = useState({ x: 0.5, y: 0.5, active: false });
  const [t, setT] = useState(0);
  const [size, setSize] = useState({ w: 1380, h: 880 });
  const isLight = theme === 'light';

  // animation loop
  useEffect(() => {
    let raf;
    const tick = () => {
      current.current.x += (target.current.x - current.current.x) * 0.08;
      current.current.y += (target.current.y - current.current.y) * 0.08;
      setMouse((m) => ({ ...m, x: current.current.x, y: current.current.y }));
      setT(performance.now() / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // measure stage
  useEffect(() => {
    const measure = () => {
      const el = stageRef.current;
      if (el) setSize({ w: el.clientWidth, h: el.clientHeight });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // keyboard: Enter → primary CTA (ignore when an input or interactive el has focus)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Enter') return;
      const tag = (document.activeElement?.tagName || '').toUpperCase();
      if (['INPUT', 'TEXTAREA', 'BUTTON', 'A', 'SELECT'].includes(tag)) return;
      e.preventDefault();
      navigate(user ? '/dashboard' : '/register');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, user]);

  const onMove = (e) => {
    const r = stageRef.current.getBoundingClientRect();
    target.current = {
      x: (e.clientX - r.left) / r.width,
      y: (e.clientY - r.top) / r.height,
    };
    setMouse((m) => ({ ...m, active: true }));
  };
  const onLeave = () => {
    target.current = { x: 0.5, y: 0.5 };
    setMouse((m) => ({ ...m, active: false }));
  };

  // Constellation nodes — labelled + ambient
  const nodes = useMemo(() => {
    const out = [];
    NODE_LABELS.forEach((l, i) => {
      const a = (i / NODE_LABELS.length) * Math.PI * 2 + 0.3;
      const r = 0.22 + seedRng(i) * 0.16;
      out.push({ id: `L${i}`, label: l, a, r, big: true });
    });
    for (let i = 0; i < 90; i += 1) {
      const a = seedRng(i + 10) * Math.PI * 2;
      const r = 0.08 + seedRng(i + 100) * 0.45;
      out.push({ id: `a${i}`, a, r, big: false, size: 0.7 + seedRng(i + 200) * 1.8 });
    }
    return out;
  }, []);

  const W = size.w;
  const H = size.h;
  const cx = W * 0.62;
  const cy = H * 0.55;
  const mx = mouse.x * W;
  const my = mouse.y * H;
  const pull = mouse.active ? 0.08 : 0;

  // Theme-aware constants
  const bgBase = isLight ? '#f5f1ea' : '#07090b';
  const bgFollow = isLight
    ? `radial-gradient(900px 600px at ${mouse.x * 100}% ${mouse.y * 100}%, rgba(43,123,184,0.10), transparent 55%),
       radial-gradient(1200px 700px at 80% 30%, rgba(184,132,92,0.05), transparent 60%),
       radial-gradient(800px 800px at 20% 100%, rgba(43,123,184,0.04), transparent 60%),
       ${bgBase}`
    : `radial-gradient(900px 600px at ${mouse.x * 100}% ${mouse.y * 100}%, rgba(75,166,220,0.18), transparent 55%),
       radial-gradient(1200px 700px at 80% 30%, rgba(216,165,116,0.06), transparent 60%),
       radial-gradient(800px 800px at 20% 100%, rgba(75,166,220,0.04), transparent 60%),
       ${bgBase}`;

  const ambientColor = isLight ? '#1a1610' : '#f1ede4';
  const ambientOpacityBase = isLight ? 0.55 : 0.45;

  return (
    <div
      ref={stageRef}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="onb-stage"
    >
      <div className="onb-bg" style={{ background: bgFollow }} />
      <div className="onb-grid" />

      <div className="onb-bracket tl" />
      <div className="onb-bracket tr" />
      <div className="onb-bracket bl" />
      <div className="onb-bracket br" />

      {/* Top strip */}
      <div className="onb-topstrip">
        <div className="onb-brand">
          <AituGlyph size={28} color="var(--ink)" accent="var(--blue)" />
          <span className="onb-brand-text">
            ALUMNI NETWORKING PLATFORM — <b>v2.6 · MAY 2026</b>
          </span>
        </div>
        <div className="onb-live-row">
          <span className="onb-live"><span className="label">ALUMNI</span><span className="val">1,284</span></span>
          <span className="onb-live"><span className="dot" /><span className="label">MENTORS</span><span className="val">134</span></span>
          <span className="onb-live"><span className="label">OPEN ROLES</span><span className="val">86</span></span>
          <span className="onb-live"><span className="label">SESSION</span><span className="val">T+{Math.floor(t).toString().padStart(2, '0')}:{Math.floor((t * 6) % 60).toString().padStart(2, '0')}</span></span>
          <ThemeToggle />
        </div>
      </div>

      {/* Constellation SVG */}
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" className="onb-svg">
        <defs>
          <radialGradient id="onbCoreG" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--warm)" stopOpacity="1" />
            <stop offset="60%" stopColor="var(--warm)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--warm)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="onbNodeG" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--blue)" stopOpacity="1" />
            <stop offset="100%" stopColor="var(--blue)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* orbital rings */}
        {[0.18, 0.28, 0.40].map((r, i) => (
          <ellipse
            key={i}
            cx={cx} cy={cy}
            rx={W * r} ry={W * r * 0.55}
            fill="none"
            stroke={isLight ? 'rgba(43,123,184,0.12)' : 'rgba(75,166,220,0.10)'}
            strokeDasharray={i === 1 ? '0' : '2 6'}
            transform={`rotate(${t * (i === 1 ? 4 : -3)} ${cx} ${cy})`}
          />
        ))}

        {/* connections from cursor */}
        {nodes.filter((n) => n.big).map((n, i) => {
          const x = cx + Math.cos(n.a + t * 0.04) * (W * n.r);
          const y = cy + Math.sin(n.a + t * 0.04) * (W * n.r * 0.6);
          const dx = mx - x; const dy = my - y;
          const d = Math.hypot(dx, dy);
          const near = d < 280 && mouse.active;
          return (
            <line
              key={i}
              x1={mx} y1={my} x2={x} y2={y}
              stroke="var(--blue)"
              strokeOpacity={near ? Math.max(0, 0.45 - d / 700) : 0}
              strokeWidth={near ? 0.8 : 0}
            />
          );
        })}

        {/* central core */}
        <circle cx={cx} cy={cy} r={70} fill="url(#onbCoreG)" />
        <circle cx={cx} cy={cy} r={6} fill="var(--warm)" />
        <circle cx={cx} cy={cy} r={12 + Math.sin(t * 2) * 2} fill="none" stroke="var(--warm)" strokeOpacity="0.5" />
        <circle cx={cx} cy={cy} r={22 + Math.sin(t * 2 + 1) * 3} fill="none" stroke="var(--warm)" strokeOpacity="0.2" />
        <text x={cx} y={cy - 86} textAnchor="middle" fill="var(--warm)" fontFamily="var(--mono)" fontSize="10" letterSpacing="0.16em">YOU · ORIGIN</text>

        {/* nodes */}
        {nodes.map((n, i) => {
          const baseX = cx + Math.cos(n.a + t * 0.04) * (W * n.r);
          const baseY = cy + Math.sin(n.a + t * 0.04) * (W * n.r * 0.6);
          const dx = mx - baseX; const dy = my - baseY;
          const d = Math.hypot(dx, dy) || 1;
          const x = baseX + (dx / d) * Math.min(40, 1200 / d) * pull;
          const y = baseY + (dy / d) * Math.min(40, 1200 / d) * pull;

          if (!n.big) {
            return (
              <circle key={i} cx={x} cy={y} r={n.size}
                      fill={ambientColor} fillOpacity={ambientOpacityBase - n.r * 0.6} />
            );
          }
          const near = Math.hypot(mx - baseX, my - baseY) < 200 && mouse.active;
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={18} fill="url(#onbNodeG)" opacity={near ? 0.9 : 0.4} />
              <circle cx={x} cy={y} r={3.2} fill="var(--blue)" />
              <text
                x={x + 10} y={y + 3}
                fill={near ? 'var(--ink)' : 'var(--ink-3)'}
                fontFamily="var(--sans)" fontSize="11"
              >
                {n.label}
              </text>
            </g>
          );
        })}

        {/* cursor scanning ring */}
        {mouse.active && (
          <>
            <circle cx={mx} cy={my} r={48 + Math.sin(t * 3) * 8} fill="none" stroke="var(--blue)" strokeOpacity="0.35" />
            <circle cx={mx} cy={my} r={86 + Math.sin(t * 3 + 1) * 12} fill="none" stroke="var(--blue)" strokeOpacity="0.15" strokeDasharray="3 6" />
          </>
        )}
      </svg>

      {/* Custom cursor */}
      <div className="onb-cursor" style={{ left: mx, top: my, opacity: mouse.active ? 1 : 0 }}>
        <svg width="64" height="64" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="3" fill="var(--blue)" />
          <circle cx="32" cy="32" r="12" fill="none" stroke="var(--blue)" strokeOpacity="0.6" />
          <line x1="32" y1="2" x2="32" y2="14" stroke="var(--blue)" />
          <line x1="32" y1="50" x2="32" y2="62" stroke="var(--blue)" />
          <line x1="2" y1="32" x2="14" y2="32" stroke="var(--blue)" />
          <line x1="50" y1="32" x2="62" y2="32" stroke="var(--blue)" />
        </svg>
        <div className="onb-cursor-label">
          ◉ SCANNING<br />
          <span className="sub">{(mouse.x * 100).toFixed(1)}, {(mouse.y * 100).toFixed(1)}</span>
        </div>
      </div>

      {/* Headline & CTAs */}
      <div className="onb-headline">
        <div className="eye">◉ AITU · ALUMNI NETWORKING PLATFORM</div>
        <div className="h">
          The network<br />
          <i>already knows</i><br />
          where you're going.
        </div>
        <div className="sub">
          1,284 AITU alumni mapped to your skills, ambitions, and trajectory.
          Move your cursor — see who's closest.
        </div>
        <div className="ctas">
          <Link to={user ? '/dashboard' : '/register'} className="btn primary lg" style={{ paddingInline: 24 }}>
            Enter the network <Icon name="arrowR" size={14} />
          </Link>
          <Link to="/login" className="btn lg">
            Sign in
          </Link>
        </div>
        <div className="onb-people-row">
          <div className="onb-people-stack">
            {['MT', 'AK', 'TB', 'RO'].map((m, i) => (
              <div key={i} style={{ marginLeft: i ? -10 : 0, borderRadius: '50%' }}>
                <Avatar monogram={m} tone={`b${[1, 4, 6, 3][i]}`} size="s" />
              </div>
            ))}
          </div>
          <div className="meta">
            <b>● 247 ONLINE</b> · joined this week: 42
          </div>
        </div>
      </div>

      {/* Right HUD */}
      <div className="onb-side">
        <div className="onb-hud">
          <div className="onb-hud-title">LIVE · NEAR YOU</div>
          {LIVE_FEED.map((e, i) => (
            <div key={i} className="onb-hud-row">
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: e.tone }} />
              <div style={{ fontSize: 11.5, color: 'var(--ink-2)', lineHeight: 1.35 }}>
                <span style={{ color: 'var(--ink)' }}>{e.n}</span> {e.action}
              </div>
              <span className="mono" style={{ fontSize: 9.5, color: 'var(--ink-3)' }}>{e.t}</span>
            </div>
          ))}
        </div>

        <div className="onb-hud">
          <div className="onb-hud-title">◉ FIRST 3 STEPS</div>
          {FIRST_STEPS.map((s, i) => (
            <div key={i} className="onb-hud-row">
              <span className="mono" style={{ fontSize: 11, color: s.st === 'next' ? 'var(--blue)' : 'var(--ink-4)' }}>{s.k}</span>
              <span style={{ fontSize: 12, color: s.st === 'next' ? 'var(--ink)' : 'var(--ink-3)' }}>{s.t}</span>
              {s.st === 'next' && <Icon name="arrowR" size={12} style={{ color: 'var(--blue)' }} />}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom telemetry */}
      <div className="onb-bottom">
        <span>◉ POINTER · X {(mouse.x * 100).toFixed(2)}  Y {(mouse.y * 100).toFixed(2)}</span>
        <span className="mid">RENDERED 1,284 NODES · 12,604 EDGES · 60 FPS</span>
        <span>↵  PRESS ENTER TO BOARD</span>
      </div>
    </div>
  );
};

export default Landing;
