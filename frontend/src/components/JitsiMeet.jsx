import { useEffect, useRef, useState } from 'react';
import { videocallApi } from '../api/videocall';

const JITSI_DOMAIN = 'meet.jit.si';

const jitsiScriptPromises = new Map();

const normalizeJitsiDomain = (value) => {
  const raw = String(value || JITSI_DOMAIN).trim();
  try {
    const url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    return url.host || JITSI_DOMAIN;
  } catch {
    return raw.replace(/^https?:\/\//, '').split('/')[0] || JITSI_DOMAIN;
  }
};

const defaultScriptSrc = (domain) => `https://${normalizeJitsiDomain(domain)}/external_api.js`;

const loadJitsiScript = (scriptSrc) => {
  if (window.JitsiMeetExternalAPI) {
    return Promise.resolve();
  }

  if (jitsiScriptPromises.has(scriptSrc)) {
    return jitsiScriptPromises.get(scriptSrc);
  }

  const existingScript = document.querySelector(`script[src="${scriptSrc}"]`);

  const scriptPromise = new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      jitsiScriptPromises.delete(scriptSrc);
      reject(new Error('Jitsi script loading timed out'));
    }, 10000);

    const handleLoad = () => {
      window.clearTimeout(timeoutId);
      existingScript?.setAttribute('data-loaded', 'true');
      resolve();
    };

    const handleError = () => {
      window.clearTimeout(timeoutId);
      jitsiScriptPromises.delete(scriptSrc);
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
    script.src = scriptSrc;
    script.async = true;
    script.setAttribute('data-jitsi-external-api', 'true');
    script.addEventListener('load', () => {
      script.setAttribute('data-loaded', 'true');
      handleLoad();
    }, { once: true });
    script.addEventListener('error', handleError, { once: true });
    document.body.appendChild(script);
  });

  jitsiScriptPromises.set(scriptSrc, scriptPromise);
  return scriptPromise;
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

    videocallApi.getConfig(safeRoomName)
      .then((config) => {
        const domain = normalizeJitsiDomain(config?.domain);
        const scriptSrc = config?.external_api_url || defaultScriptSrc(domain);
        const configuredRoomName = config?.room_name || safeRoomName;

        return loadJitsiScript(scriptSrc).then(() => ({
          domain,
          roomName: configuredRoomName,
          jwt: config?.jwt,
        }));
      })
      .then((config) => {
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

        const apiOptions = {
          roomName: config.roomName,
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
        };

        if (config.jwt) {
          apiOptions.jwt = config.jwt;
        }

        const api = new window.JitsiMeetExternalAPI(config.domain, apiOptions);

        apiRef.current = api;
        setLoading(false);

        const addApiListener = typeof api.addListener === 'function'
          ? api.addListener.bind(api)
          : typeof api.addEventListener === 'function'
            ? api.addEventListener.bind(api)
            : null;

        if (addApiListener) {
          addApiListener('videoConferenceJoined', () => setLoading(false));
          addApiListener('readyToClose', () => onReadyToClose?.());
          addApiListener('videoConferenceLeft', () => onReadyToClose?.());
          addApiListener('errorOccurred', (event) => {
            const errorName = String(event?.name || event?.type || event?.error || '');
            if (errorName.toLowerCase().includes('auth')) {
              setError('Jitsi authentication failed. Check video provider credentials.');
            }
          });
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
