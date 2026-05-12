import { motion } from 'framer-motion';

const STARS = Array.from({ length: 60 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 1.6 + 0.4,
  delay: Math.random() * 4,
  dur: Math.random() * 3 + 2,
}));

function Stars() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {STARS.map((s) => (
        <motion.div
          key={s.id}
          style={{
            position: 'absolute',
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size,
            height: s.size,
            borderRadius: '50%',
            background: 'var(--ink-2)',
          }}
          animate={{ opacity: [0.15, 0.9, 0.15] }}
          transition={{ duration: s.dur, delay: s.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

function SatelliteIcon() {
  return (
    <motion.svg
      width="64" height="64" viewBox="0 0 64 64" fill="none"
      animate={{ rotate: [0, 8, -8, 0] }}
      transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
    >
      {/* orbit ring */}
      <ellipse cx="32" cy="32" rx="22" ry="10" stroke="var(--blue)" strokeWidth="1" strokeDasharray="4 3" opacity="0.35" />
      {/* planet body */}
      <circle cx="32" cy="32" r="9" fill="var(--surface-2)" stroke="var(--blue)" strokeWidth="1.5" />
      <circle cx="29" cy="29" r="2.5" fill="var(--surface-3)" opacity="0.7" />
      {/* satellite */}
      <motion.g
        animate={{ rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
        style={{ transformOrigin: '32px 32px' }}
      >
        <rect x="50" y="30" width="6" height="4" rx="1" fill="var(--blue)" opacity="0.9" />
        <rect x="52" y="26" width="1.5" height="12" rx="0.5" fill="var(--blue-2)" opacity="0.6" />
      </motion.g>
      {/* signal waves */}
      {[1, 2, 3].map((n) => (
        <motion.circle
          key={n}
          cx="32" cy="32" r={12 + n * 7}
          stroke="var(--blue)" strokeWidth="0.6" fill="none"
          animate={{ opacity: [0.4, 0], scale: [0.8, 1.4] }}
          transition={{ duration: 2.4, delay: n * 0.7, repeat: Infinity, ease: 'easeOut' }}
          style={{ transformOrigin: '32px 32px' }}
        />
      ))}
    </motion.svg>
  );
}

export default function ErrorScreen({
  title = 'Потеряли сигнал',
  subtitle = 'Сервер временно недоступен. Попробуйте через несколько минут.',
  onRetry,
  showContact = true,
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--sans)',
      padding: '24px',
      textAlign: 'center',
    }}>
      <Stars />

      {/* glow blob */}
      <div style={{
        position: 'absolute',
        width: 340, height: 340,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(75,166,220,0.07) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, maxWidth: 420 }}
      >
        <SatelliteIcon />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{
            fontFamily: 'var(--mono)',
            fontSize: 10,
            letterSpacing: '0.14em',
            color: 'var(--blue)',
            textTransform: 'uppercase',
          }}>
            connection lost
          </span>

          <h1 style={{
            margin: 0,
            fontSize: 26,
            fontWeight: 600,
            color: 'var(--ink)',
            lineHeight: 1.2,
          }}>
            {title}
          </h1>

          <p style={{
            margin: 0,
            fontSize: 14,
            color: 'var(--ink-2)',
            lineHeight: 1.6,
          }}>
            {subtitle}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
          {onRetry && (
            <motion.button
              className="btn primary block"
              onClick={onRetry}
              whileTap={{ scale: 0.97 }}
            >
              Попробовать снова
            </motion.button>
          )}

          {showContact && (
            <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-3)' }}>
              Если проблема не исчезает —{' '}
              <a
                href="mailto:abylajslamzanov@gmail.com"
                style={{ color: 'var(--blue)', textDecoration: 'none' }}
              >
                abylajslamzanov@gmail.com
              </a>
            </p>
          )}
        </div>

        {/* telemetry badge */}
        <motion.div
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 2.5, repeat: Infinity }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 10px',
            borderRadius: 6,
            border: '1px solid var(--line)',
            background: 'var(--surface)',
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--err)', display: 'inline-block' }} />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: '0.06em' }}>
            upstream · no response
          </span>
        </motion.div>
      </motion.div>
    </div>
  );
}
