export const resolveUrl = (path) => {
    if (!path) return null;
    const apiBase = import.meta.env.VITE_API_URL || '';
    return path.startsWith('http') ? path : `${apiBase}${path}`;
};
