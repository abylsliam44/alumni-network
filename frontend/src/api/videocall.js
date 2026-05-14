import api from './axios';

export const videocallApi = {
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
    getConfig: async (roomName) => {
        const { data } = await api.get('/api/v1/videocall/config', {
            params: { room_name: roomName },
        });
        return data;
    },
};
