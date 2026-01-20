import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Hook для управления состоянием видеозвонка.
 * Использует LiveKit для WebRTC соединения.
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

            // Динамический импорт livekit-client
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

            // Создаем и подключаем комнату
            const room = new Room({
                adaptiveStream: true,
                dynacast: true,
            });

            roomRef.current = room;

            // Слушаем события комнаты
            room.on(RoomEvent.Connected, () => {
                setConnectionState('connected');
                startDurationTimer();
            });

            room.on(RoomEvent.Disconnected, () => {
                setConnectionState('disconnected');
                stopDurationTimer();
            });

            room.on(RoomEvent.ParticipantConnected, (participant) => {
                setRemoteParticipants((prev) => [...prev, participant]);
            });

            room.on(RoomEvent.ParticipantDisconnected, (participant) => {
                setRemoteParticipants((prev) =>
                    prev.filter((p) => p.identity !== participant.identity)
                );
            });

            room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
                // Добавляем или обновляем участника с новым треком
                setRemoteParticipants((prev) => {
                    const exists = prev.some((p) => p.identity === participant.identity);
                    if (exists) {
                        // Создаём новый массив с обновлённым участником для trigger re-render
                        return prev.map((p) =>
                            p.identity === participant.identity ? participant : p
                        );
                    } else {
                        return [...prev, participant];
                    }
                });
            });

            room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
                // Принудительно обновляем состояние участников для re-render
                setRemoteParticipants((prev) =>
                    prev.map((p) =>
                        p.identity === participant.identity ? participant : p
                    )
                );
            });

            // Handle Subscription Failures
            room.on(RoomEvent.TrackSubscriptionFailed, (trackSid, participant) => {
                console.error('Failed to subscribe to track:', trackSid, participant);
                // Optionally notify user via UI if needed, for now just log
            });

            // Handle Media Device Errors (permisssions, hardware issues)
            room.on(RoomEvent.MediaDevicesError, (e) => {
                const msg = `Media device error: ${e.message}`;
                console.error(msg);
                setError(msg);
            });

            room.on(RoomEvent.ConnectionStateChanged, (state) => {
                console.log('LiveKit connection state changed:', state);
                if (state === 'reconnecting') {
                    setConnectionState('reconnecting');
                } else if (state === 'connected') {
                    setConnectionState('connected');
                } else if (state === 'disconnected') {
                    setConnectionState('disconnected');
                }
            });

            // Подключаемся к комнате
            await room.connect(livekitUrl, token);

            // Публикуем локальные треки
            if (videoTrack) await room.localParticipant.publishTrack(videoTrack);
            if (audioTrack) await room.localParticipant.publishTrack(audioTrack);

        } catch (err) {
            console.error('Failed to connect to video call:', err);
            setError(err.message || 'Failed to connect');
            setConnectionState('disconnected');
        }
    }, [startDurationTimer, stopDurationTimer]);

    const localVideoTrackRef = useRef(null);
    const localAudioTrackRef = useRef(null);

    // Sync refs with state
    useEffect(() => {
        localVideoTrackRef.current = localVideoTrack;
    }, [localVideoTrack]);

    useEffect(() => {
        localAudioTrackRef.current = localAudioTrack;
    }, [localAudioTrack]);

    const disconnect = useCallback(async () => {
        stopDurationTimer();

        if (localVideoTrackRef.current) {
            localVideoTrackRef.current.stop();
            setLocalVideoTrack(null);
        }

        if (localAudioTrackRef.current) {
            localAudioTrackRef.current.stop();
            setLocalAudioTrack(null);
        }

        if (roomRef.current) {
            await roomRef.current.disconnect();
            roomRef.current = null;
        }

        setRemoteParticipants([]);
        setConnectionState('disconnected');
        setCallDuration(0);
    }, [stopDurationTimer]);

    const toggleMute = useCallback(async () => {
        if (roomRef.current && localAudioTrackRef.current) {
            const newMuteState = !isMuted;
            await roomRef.current.localParticipant.setMicrophoneEnabled(!newMuteState);
            setIsMuted(newMuteState);
        }
    }, [isMuted]);

    const toggleVideo = useCallback(async () => {
        if (roomRef.current && localVideoTrackRef.current) {
            const newVideoState = !isVideoOff;
            await roomRef.current.localParticipant.setCameraEnabled(!newVideoState);
            setIsVideoOff(newVideoState);
        }
    }, [isVideoOff]);

    // Cleanup при размонтировании
    useEffect(() => {
        return () => {
            disconnect();
        };
    }, []); // Run only on unmount

    return {
        connectionState,
        localVideoTrack,
        localAudioTrack,
        remoteParticipants,
        isMuted,
        isVideoOff,
        callDuration,
        error,
        connect,
        disconnect,
        toggleMute,
        toggleVideo,
    };
};
