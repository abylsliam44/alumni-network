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
};
