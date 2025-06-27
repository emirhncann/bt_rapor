// API base URL'ini environment'a göre ayarla
export const getApiUrl = (endpoint: string): string => {
  if (process.env.NODE_ENV === 'development') {
    return `/api/btrapor${endpoint}`;
  }
  return `https://btrapor.boluteknoloji.tr${endpoint}`;
};

// API fetch wrapper
export const apiCall = async (endpoint: string, options?: RequestInit) => {
  const url = getApiUrl(endpoint);
  return fetch(url, options);
}; 