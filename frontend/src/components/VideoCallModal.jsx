import { useEffect, useRef, useState, useCallback } from 'react';
import { useVideoCall } from '../hooks/useVideoCall';

// Иконки
const MicIcon = ({ muted }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {muted ? (
            <>
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
            </>
        ) : (
            <>
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
            </>
        )}
    </svg>
);

const VideoIcon = ({ off }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {off ? (
            <>
                <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
                <line x1="1" y1="1" x2="23" y2="23" />
            </>
        ) : (
            <>
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </>
        )}
    </svg>
);

const EndCallIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
        <line x1="23" y1="1" x2="1" y2="23" />
    </svg>
);

const CloseIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// Безопасно получаем публикации треков участника (LiveKit v2 API)
// В v2 используется trackPublications (Map) вместо videoTracks/audioTracks
const getTrackPublications = (participant, kind) => {
    if (!participant) return [];

    // LiveKit v2: participant.trackPublications — Map<string, TrackPublication>
    const pubMap = participant.trackPublications;
    if (pubMap && typeof pubMap.values === 'function') {
        const all = Array.from(pubMap.values());
        if (kind === 'video') {
            return all.filter(pub => pub.kind === 'video');
        }
        if (kind === 'audio') {
            return all.filter(pub => pub.kind === 'audio');
        }
        return all;
    }

    return [];
};

// Проверяем есть ли у участника активный видео трек
const hasActiveVideoTrack = (participant) => {
    const videoTracks = getTrackPublications(participant, 'video');
    return videoTracks.some(pub => pub.track && pub.isSubscribed && !pub.isMuted);
};

// Находим активный видео трек участника
const getActiveVideoTrack = (participant) => {
    const videoTracks = getTrackPublications(participant, 'video');
    const pub = videoTracks.find(pub => pub.track && pub.isSubscribed);
    return pub?.track || null;
};

// Подкомпонент для управления аудио участника
// Вынесен из VideoCallModal чтобы избежать пересоздания при ре-рендерах родителя
const ParticipantAudio = ({ participant }) => {
    const audioRef = useRef(null);
    const attachedTracksRef = useRef(new Set());

    // Функция для прикрепления треков
    const attachTracks = useCallback((el) => {
        if (!el || !participant) return;

        const trackPublications = getTrackPublications(participant, 'audio');

        trackPublications.forEach(pub => {
            // Проверяем что трек существует и подписан
            if (pub.track && pub.isSubscribed && !pub.isMuted) {
                const trackSid = pub.track.sid;
                // Избегаем повторного прикрепления того же трека
                if (!attachedTracksRef.current.has(trackSid)) {
                    console.log(`Attaching audio track from ${participant.identity}:`, trackSid);
                    pub.track.attach(el);
                    attachedTracksRef.current.add(trackSid);
                }
            }
        });

        // Явно пытаемся воспроизвести
        el.play().catch(e => {
            console.error("Audio autoplay failed:", e);
        });
    }, [participant]);

    // Используем ref callback для управления жизненным циклом элемента
    const setAudioRef = useCallback((el) => {
        // Если элемент меняется (или удаляется), нужно открепить треки от старого
        if (audioRef.current && audioRef.current !== el) {
            const trackPublications = getTrackPublications(participant, 'audio');
            trackPublications.forEach(pub => {
                if (pub.track) {
                    pub.track.detach(audioRef.current);
                }
            });
            attachedTracksRef.current.clear();
        }

        audioRef.current = el;

        // Если появился новый элемент, прикрепляем
        if (el) {
            attachTracks(el);
        }
    }, [participant, attachTracks]);

    // Эффект для обновления при изменениях внутри participant (например, новый трек добавлен)
    useEffect(() => {
        if (audioRef.current && participant) {
            attachTracks(audioRef.current);
        }
    }); // Run on every render to ensure tracks are attached if they just arrived

    return <audio ref={setAudioRef} autoPlay playsInline />;
};

const VideoCallModal = ({
    isOpen,
    onClose,
    livekitUrl,
    token,
    otherUser,
    isIncoming = false,
    onCallEnded,
}) => {
    const {
        connectionState,
        localVideoTrack,
        remoteParticipants,
        isMuted,
        isVideoOff,
        callDuration,
        error,
        isAudioPlaybackBlocked,
        isVideoPlaybackBlocked,
        connect,
        disconnect,
        toggleMute,
        toggleVideo,
        resumeMediaPlayback,
    } = useVideoCall();

    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const [showControls, setShowControls] = useState(true);
    const controlsTimeoutRef = useRef(null);

    // Подключаемся при открытии модала
    useEffect(() => {
        if (isOpen && livekitUrl && token) {
            connect(livekitUrl, token);
        }
    }, [isOpen, livekitUrl, token, connect]);

    // Прикрепляем локальное видео
    useEffect(() => {
        const videoEl = localVideoRef.current;
        if (localVideoTrack && videoEl) {
            localVideoTrack.attach(videoEl);
            return () => {
                if (videoEl) {
                    localVideoTrack.detach(videoEl);
                }
            };
        }
    }, [localVideoTrack]);

    // Прикрепляем удалённое видео (только для активного участника)
    useEffect(() => {
        // Debug: логируем всех участников и их треки
        console.log('Remote participants:', remoteParticipants.map(p => ({
            identity: p?.identity,
            videoTracks: getTrackPublications(p, 'video').map(pub => ({
                sid: pub.trackSid,
                kind: pub.kind,
                isSubscribed: pub.isSubscribed,
                isMuted: pub.isMuted,
                hasTrack: !!pub.track,
            })),
            audioTracks: getTrackPublications(p, 'audio').map(pub => ({
                sid: pub.trackSid,
                kind: pub.kind,
                isSubscribed: pub.isSubscribed,
                isMuted: pub.isMuted,
                hasTrack: !!pub.track,
            })),
        })));

        // 1. Ищем участника с видео (приоритет реальному собеседнику с камерой)
        const videoParticipant = remoteParticipants.find(p => {
            // Пропускаем агента - он не публикует видео
            if (!p || p.identity === 'agent') return false;
            return hasActiveVideoTrack(p);
        });

        // Если нашли участника с видео - прикрепляем к рефу
        const videoEl = remoteVideoRef.current;
        if (videoParticipant && videoEl) {
            const videoTrack = getActiveVideoTrack(videoParticipant);

            if (videoTrack) {
                console.log(`Attaching remote video from ${videoParticipant.identity}`);
                videoEl.muted = true;
                videoTrack.attach(videoEl);
                videoEl.play().catch((e) => {
                    console.error('Remote video autoplay failed:', e);
                });
                return () => {
                    console.log(`Detaching remote video from ${videoParticipant.identity}`);
                    if (videoEl) {
                        videoTrack.detach(videoEl);
                    }
                };
            }
        }
    }, [remoteParticipants]); // Здесь зависимость от списка ок, так как видео элемент один

    // Автоскрытие контролов
    useEffect(() => {
        const handleMouseMove = () => {
            setShowControls(true);
            if (controlsTimeoutRef.current) {
                clearTimeout(controlsTimeoutRef.current);
            }
            controlsTimeoutRef.current = setTimeout(() => {
                setShowControls(false);
            }, 3000);
        };

        if (isOpen) {
            window.addEventListener('mousemove', handleMouseMove);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            if (controlsTimeoutRef.current) {
                clearTimeout(controlsTimeoutRef.current);
            }
        };
    }, [isOpen]);

    const handleEndCall = async () => {
        await disconnect();
        if (onCallEnded) {
            onCallEnded(callDuration);
        }
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="videocall-modal-overlay">
            <div className="videocall-modal">
                {/* Рендерим аудио для ВСЕХ участников независимо */}
                {remoteParticipants
                    .filter(participant => participant && participant.identity)
                    .map(participant => (
                        <ParticipantAudio key={participant.identity} participant={participant} />
                    ))}

                {/* Заголовок */}
                <div className={`videocall-header ${showControls ? 'visible' : ''}`}>
                    <div className="videocall-info">
                        <span className="videocall-user-name">{otherUser?.name || 'Участник'}</span>
                        <span className="videocall-status">
                            {connectionState === 'connecting' && 'Подключение...'}
                            {connectionState === 'connected' && formatDuration(callDuration)}
                            {connectionState === 'reconnecting' && 'Переподключение...'}
                            {connectionState === 'disconnected' && 'Отключено'}
                        </span>
                    </div>
                    <button className="videocall-close-btn" onClick={handleEndCall}>
                        <CloseIcon />
                    </button>
                </div>

                {/* Видео контейнер */}
                <div className="videocall-video-container">
                    {/* Удалённое видео (основное) */}
                    <div className="videocall-remote-video">
                        {remoteParticipants.length > 0 ? (
                            (() => {
                                // Logic to determine what to show
                                // 1. Find a participant with an active video track (excluding agent)
                                const videoParticipant = remoteParticipants.find(p => {
                                    if (!p || p.identity === 'agent') return false;
                                    return hasActiveVideoTrack(p);
                                });

                                // If we have a participant with video, show it
                                if (videoParticipant) {
                                    return <video ref={remoteVideoRef} autoPlay playsInline className="remote-video-element" />;
                                }

                                // Check if there's a real participant (not agent) in the room
                                const hasRealParticipant = remoteParticipants.some(p => p && p.identity !== 'agent');

                                // Otherwise show the avatar of the primary remote participant (not the agent if possible)
                                // We'll just show the avatar of the 'otherUser' passed in props as a fallback for 1-on-1 calls
                                return (
                                    <div className="videocall-waiting">
                                        <div className="videocall-avatar">
                                            <img
                                                src={
                                                    otherUser?.photo_url ||
                                                    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(otherUser?.name || 'U')}`
                                                }
                                                alt={otherUser?.name}
                                            />
                                        </div>
                                        <span className="videocall-waiting-text">
                                            {hasRealParticipant
                                                ? 'Собеседник без камеры'
                                                : 'Ожидание участника...'}
                                        </span>
                                    </div>
                                );
                            })()
                        ) : (
                            <div className="videocall-waiting">
                                <div className="videocall-avatar">
                                    <img
                                        src={
                                            otherUser?.photo_url ||
                                            `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(otherUser?.name || 'U')}`
                                        }
                                        alt={otherUser?.name}
                                    />
                                </div>
                                <span className="videocall-waiting-text">
                                    {connectionState === 'connecting'
                                        ? 'Подключение к звонку...'
                                        : 'Ожидание участника...'}
                                </span>
                                {connectionState === 'connecting' && (
                                    <div className="videocall-loader" />
                                )}
                            </div>
                        )}
                    </div>

                    {/* Локальное видео (маленькое) */}
                    <div className={`videocall-local-video ${isVideoOff ? 'video-off' : ''}`}>
                        {!isVideoOff ? (
                            <video ref={localVideoRef} autoPlay playsInline muted />
                        ) : (
                            <div className="videocall-local-placeholder">
                                <span>Камера выключена</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Контролы */}
                <div className={`videocall-controls ${showControls ? 'visible' : ''}`}>
                    <button
                        className={`videocall-control-btn ${isMuted ? 'active' : ''}`}
                        onClick={toggleMute}
                        title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
                    >
                        <MicIcon muted={isMuted} />
                    </button>

                    <button
                        className={`videocall-control-btn ${isVideoOff ? 'active' : ''}`}
                        onClick={toggleVideo}
                        title={isVideoOff ? 'Включить камеру' : 'Выключить камеру'}
                    >
                        <VideoIcon off={isVideoOff} />
                    </button>

                    <button
                        className="videocall-control-btn end-call"
                        onClick={handleEndCall}
                        title="Завершить звонок"
                    >
                        <EndCallIcon />
                    </button>
                </div>

                {/* Ошибка */}
                {error && (
                    <div className="videocall-error">
                        <span>Ошибка: {error}</span>
                        <button onClick={() => connect(livekitUrl, token)}>Попробовать снова</button>
                    </div>
                )}

                {!error && (isAudioPlaybackBlocked || isVideoPlaybackBlocked) && (
                    <div className="videocall-error">
                        <span>Браузер заблокировал воспроизведение медиа. Нажмите, чтобы включить звонок.</span>
                        <button onClick={resumeMediaPlayback}>Включить медиа</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VideoCallModal;
