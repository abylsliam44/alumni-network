import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Hook для управления состоянием видеозвонка.
 * Использует LiveKit v2 для WebRTC соединения.
 */
export const useVideoCall = () => {
    const [connectionState, setConnectionState] = useState('disconnected');
    const [localVideoTrack, setLocalVideoTrack] = useState(null);
    const [localAudioTrack, setLocalAudioTrack] = useState(null);
    const [remoteParticipants, setRemoteParticipants] = useState([]);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [callDuration, setCallDuration] = useState(0);
    const [error, setError] = useState(null);
    const [isAudioPlaybackBlocked, setIsAudioPlaybackBlocked] = useState(false);
    const [isVideoPlaybackBlocked, setIsVideoPlaybackBlocked] = useState(false);

    const roomRef = useRef(null);
    const callStartTimeRef = useRef(null);
    const durationIntervalRef = useRef(null);

    const startDurationTimer = useCallback(() => {
        callStartTimeRef.current = Date.now();
        durationIntervalRef.current = setInterval(() => {
            const elapsed = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
            setCallDuration(elapsed);
        }, 1000);
    }, []);

    const stopDurationTimer = useCallback(() => {
        if (durationIntervalRef.current) {
            clearInterval(durationIntervalRef.current);
            durationIntervalRef.current = null;
        }
    }, []);

    const connect = useCallback(async (livekitUrl, token) => {
        try {
            setConnectionState('connecting');
            setError(null);

            // Динамический импорт livekit-client v2
            const { Room, RoomEvent, Track, createLocalTracks } = await import('livekit-client');

            // Создаем локальные треки (камера и микрофон)
            const tracks = await createLocalTracks({
                audio: true,
                video: {
                    resolution: { width: 1280, height: 720 },
                    facingMode: 'user',
                },
            });

            const videoTrack = tracks.find((t) => t.kind === Track.Kind.Video);
            const audioTrack = tracks.find((t) => t.kind === Track.Kind.Audio);

            setLocalVideoTrack(videoTrack || null);
            setLocalAudioTrack(audioTrack || null);

            // Создаем комнату
            const room = new Room({
                adaptiveStream: true,
                dynacast: true,
            });

            roomRef.current = room;

            // ─── Слушаем события комнаты ───────────────────────────────────

            room.on(RoomEvent.Connected, async () => {
                setConnectionState('connected');
                startDurationTimer();
                setIsAudioPlaybackBlocked(typeof room.canPlaybackAudio === 'boolean' ? !room.canPlaybackAudio : false);
                setIsVideoPlaybackBlocked(typeof room.canPlaybackVideo === 'boolean' ? !room.canPlaybackVideo : false);

                // ВАЖНО: Публикуем треки ТОЛЬКО после Connected в v2.
                // Публикация до Connected вызывает "publication timed out".
                try {
                    if (videoTrack) {
                        await room.localParticipant.publishTrack(videoTrack);
                    }
                    if (audioTrack) {
                        await room.localParticipant.publishTrack(audioTrack);
                    }
                } catch (publishErr) {
                    console.error('Failed to publish local tracks:', publishErr);
                }
            });

            room.on(RoomEvent.Disconnected, () => {
                setConnectionState('disconnected');
                stopDurationTimer();
            });

            room.on(RoomEvent.ParticipantConnected, (participant) => {
                if (!participant) return;
                setRemoteParticipants((prev) => [...prev, participant]);
            });

            room.on(RoomEvent.ParticipantDisconnected, (participant) => {
                if (!participant) return;
                setRemoteParticipants((prev) =>
                    prev.filter((p) => p && p.identity !== participant.identity)
                );
            });

            room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
                if (!participant) return;
                // Обновляем список участников чтобы триггернуть ре-рендер
                setRemoteParticipants((prev) => {
                    const exists = prev.some((p) => p && p.identity === participant.identity);
                    if (exists) {
                        return prev.map((p) =>
                            p && p.identity === participant.identity ? participant : p
                        );
                    } else {
                        return [...prev, participant];
                    }
                });
            });

            room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
                if (!participant) return;
                setRemoteParticipants((prev) =>
                    prev.map((p) =>
                        p && p.identity === participant.identity ? participant : p
                    )
                );
            });

            room.on(RoomEvent.TrackSubscriptionFailed, (trackSid, participant) => {
                console.error('Failed to subscribe to track:', trackSid, participant?.identity);
            });

            room.on(RoomEvent.MediaDevicesError, (e) => {
                const msg = `Media device error: ${e.message}`;
                console.error(msg);
                setError(msg);
            });

            if (RoomEvent.AudioPlaybackStatusChanged) {
                room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
                    const blocked = typeof room.canPlaybackAudio === 'boolean' ? !room.canPlaybackAudio : false;
                    setIsAudioPlaybackBlocked(blocked);
                    if (blocked) {
                        console.warn('LiveKit audio playback is blocked until a user gesture resumes it.');
                    }
                });
            }

            if (RoomEvent.VideoPlaybackStatusChanged) {
                room.on(RoomEvent.VideoPlaybackStatusChanged, () => {
                    const blocked = typeof room.canPlaybackVideo === 'boolean' ? !room.canPlaybackVideo : false;
                    setIsVideoPlaybackBlocked(blocked);
                    if (blocked) {
                        console.warn('LiveKit video playback is blocked until a user gesture resumes it.');
                    }
                });
            }

            room.on(RoomEvent.ConnectionStateChanged, (state) => {
                console.log('LiveKit connection state changed:', state);
                if (state === 'reconnecting') {
                    setConnectionState('reconnecting');
                } else if (state === 'connected') {
                    setConnectionState('connected');
                } else if (state === 'disconnected') {
                    setConnectionState('disconnected');
                    stopDurationTimer();
                }
            });

            // ─── Подключаемся к комнате ───────────────────────────────────
            // В LiveKit v2 connect() разрешается когда соединение установлено,
            // треки публикуем внутри RoomEvent.Connected выше.
            await room.connect(livekitUrl, token);

            // Добавляем уже существующих участников (они не вызывают ParticipantConnected
            // если уже были в комнате до нашего подключения)
            const remoteParticipantsMap = room.remoteParticipants;
            if (remoteParticipantsMap && typeof remoteParticipantsMap.values === 'function') {
                const existingParticipants = Array.from(remoteParticipantsMap.values()).filter(Boolean);
                if (existingParticipants.length > 0) {
                    console.log('Found existing participants:', existingParticipants.map(p => p?.identity));
                    setRemoteParticipants(existingParticipants);
                }
            }

        } catch (err) {
            console.error('Failed to connect to video call:', err);
            setError(err.message || 'Failed to connect');
            setConnectionState('disconnected');
        }
    }, [startDurationTimer, stopDurationTimer]);

    const localVideoTrackRef = useRef(null);
    const localAudioTrackRef = useRef(null);

    // Синхронизируем рефы со стейтом
    useEffect(() => {
        localVideoTrackRef.current = localVideoTrack;
    }, [localVideoTrack]);

    useEffect(() => {
        localAudioTrackRef.current = localAudioTrack;
    }, [localAudioTrack]);

    const disconnect = useCallback(async () => {
        try {
            stopDurationTimer();

            if (localVideoTrackRef.current) {
                try {
                    localVideoTrackRef.current.stop();
                } catch (e) {
                    console.error('Error stopping video track:', e);
                }
                setLocalVideoTrack(null);
            }

            if (localAudioTrackRef.current) {
                try {
                    localAudioTrackRef.current.stop();
                } catch (e) {
                    console.error('Error stopping audio track:', e);
                }
                setLocalAudioTrack(null);
            }

            if (roomRef.current) {
                try {
                    await roomRef.current.disconnect();
                } catch (e) {
                    console.error('Error disconnecting from room:', e);
                }
                roomRef.current = null;
            }

            setRemoteParticipants([]);
            setConnectionState('disconnected');
            setCallDuration(0);
            setError(null);
            setIsAudioPlaybackBlocked(false);
            setIsVideoPlaybackBlocked(false);
            setIsMuted(false);
            setIsVideoOff(false);
        } catch (e) {
            console.error('Error in disconnect:', e);
        }
    }, [stopDurationTimer]);

    const resumeMediaPlayback = useCallback(async () => {
        const room = roomRef.current;
        if (!room) return;

        try {
            if (typeof room.startAudio === 'function') {
                await room.startAudio();
            }
            if (typeof room.startVideo === 'function') {
                await room.startVideo();
            }

            setIsAudioPlaybackBlocked(typeof room.canPlaybackAudio === 'boolean' ? !room.canPlaybackAudio : false);
            setIsVideoPlaybackBlocked(typeof room.canPlaybackVideo === 'boolean' ? !room.canPlaybackVideo : false);
        } catch (e) {
            console.error('Failed to resume media playback:', e);
            setError(e.message || 'Failed to resume media playback');
        }
    }, []);

    const toggleMute = useCallback(async () => {
        try {
            if (roomRef.current?.localParticipant) {
                const newMuteState = !isMuted;
                await roomRef.current.localParticipant.setMicrophoneEnabled(!newMuteState);
                setIsMuted(newMuteState);
            }
        } catch (e) {
            console.error('Error toggling mute:', e);
        }
    }, [isMuted]);

    const toggleVideo = useCallback(async () => {
        try {
            if (roomRef.current?.localParticipant) {
                const newVideoState = !isVideoOff;
                await roomRef.current.localParticipant.setCameraEnabled(!newVideoState);
                setIsVideoOff(newVideoState);
            }
        } catch (e) {
            console.error('Error toggling video:', e);
        }
    }, [isVideoOff]);

    // Cleanup при размонтировании
    useEffect(() => {
        return () => {
            disconnect();
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return {
        connectionState,
        localVideoTrack,
        localAudioTrack,
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
    };
};
