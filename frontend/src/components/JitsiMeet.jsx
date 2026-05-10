import { useEffect, useRef, useState } from 'react';

const JITSI_DOMAIN = 'meet.jit.si';
const JITSI_SCRIPT_SRC = 'https://meet.jit.si/external_api.js';

let jitsiScriptPromise = null;

const loadJitsiScript = () => {
  if (window.JitsiMeetExternalAPI) {
    return Promise.resolve();
  }

  if (jitsiScriptPromise) {
    return jitsiScriptPromise;
  }

  const existingScript = document.querySelector(`script[src="${JITSI_SCRIPT_SRC}"]`);

  jitsiScriptPromise = new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error('Jitsi script loading timed out'));
    }, 10000);

    const handleLoad = () => {
      window.clearTimeout(timeoutId);
      existingScript?.setAttribute('data-loaded', 'true');
      resolve();
    };

    const handleError = () => {
      window.clearTimeout(timeoutId);
      jitsiScriptPromise = null;
      reject(new Error('Failed to load Jitsi Meet'));
    };

    if (existingScript) {
      if (existingScript.getAttribute('data-loaded') === 'true') {
        window.clearTimeout(timeoutId);
        resolve();
        return;
      }

      existingScript.addEventListener('load', handleLoad, { once: true });
      existingScript.addEventListener('error', handleError, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = JITSI_SCRIPT_SRC;
    script.async = true;
    script.setAttribute('data-jitsi-external-api', 'true');
    script.addEventListener('load', () => {
      script.setAttribute('data-loaded', 'true');
      handleLoad();
    }, { once: true });
    script.addEventListener('error', handleError, { once: true });
    document.body.appendChild(script);
  });

  return jitsiScriptPromise;
};

export const normalizeJitsiRoomName = (value) => {
  const raw = String(value || '').trim();
  const sanitized = raw
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return sanitized.length >= 3 ? sanitized.slice(0, 128) : '';
};

const JitsiMeet = ({ roomName, displayName = 'Guest', email = '', onReadyToClose }) => {
  const containerRef = useRef(null);
  const apiRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    const safeRoomName = normalizeJitsiRoomName(roomName);

    const cleanupInstance = () => {
      if (apiRef.current) {
        apiRef.current.dispose();
        apiRef.current = null;
      }
      if (container) {
        container.innerHTML = '';
      }
    };

    cleanupInstance();

    if (!container) {
      setError('Video call container is unavailable.');
      setLoading(false);
      return cleanupInstance;
    }

    if (!safeRoomName) {
      setError('Video call room is invalid.');
      setLoading(false);
      return cleanupInstance;
    }

    setLoading(true);
    setError('');

    loadJitsiScript()
      .then(() => {
        if (cancelled) return;

        if (!window.JitsiMeetExternalAPI) {
          throw new Error('Jitsi Meet API is unavailable.');
        }

        cleanupInstance();

        const userInfo = {
          displayName: displayName || 'Guest',
        };

        if (email) {
          userInfo.email = email;
        }

        const api = new window.JitsiMeetExternalAPI(JITSI_DOMAIN, {
          roomName: safeRoomName,
          parentNode: container,
          width: '100%',
          height: '100%',
          userInfo,
          configOverwrite: {
            disableDeepLinking: true,
            prejoinPageEnabled: true,
          },
          interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
          },
        });

        apiRef.current = api;
        setLoading(false);

        if (typeof api.addListener === 'function') {
          api.addListener('videoConferenceJoined', () => setLoading(false));
          api.addListener('readyToClose', () => onReadyToClose?.());
          api.addListener('videoConferenceLeft', () => onReadyToClose?.());
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || 'Failed to load video call.');
        setLoading(false);
      });

    return () => {
      cancelled = true;
      cleanupInstance();
    };
  }, [roomName, displayName, email, onReadyToClose]);

  return (
    <div className="jitsi-meet-shell">
      <div ref={containerRef} className="jitsi-meet-container" />

      {loading && (
        <div className="jitsi-meet-state">
          <div className="jitsi-meet-loader" />
          <span>Loading video call...</span>
        </div>
      )}

      {error && (
        <div className="jitsi-meet-state error">
          <strong>Unable to open video call</strong>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default JitsiMeet;
