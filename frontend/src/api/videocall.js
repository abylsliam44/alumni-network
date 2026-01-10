import api from './axios';

export const videocallApi = {
    /**
     * Проверяет доступность видеозвонков и получает конфигурацию.
     */
    getConfig: async () => {
        const { data } = await api.get('/api/v1/videocall/config');
        return data;
    },

    /**
     * Создает новую комнату для видеозвонка.
     * @param {string} conversationId - UUID разговора
     */
    createRoom: async (conversationId) => {
        const { data } = await api.post('/api/v1/videocall/create-room', {
            conversation_id: conversationId,
        });
        return data;
    },

    /**
     * Присоединяется к существующей комнате.
     * @param {string} roomName - Имя комнаты
     */
    joinRoom: async (roomName) => {
        const { data } = await api.post('/api/v1/videocall/join-room', {
            room_name: roomName,
        });
        return data;
    },
};
