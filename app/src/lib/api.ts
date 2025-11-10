import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const api = {
  // Auth
  getNonce: async (walletAddress: string) => {
    const { data } = await apiClient.post('/auth/nonce', { walletAddress });
    return data;
  },

  verifySignature: async (walletAddress: string, signature: string, message: string) => {
    const { data } = await apiClient.post('/auth/verify', {
      walletAddress,
      signature,
      message,
    });
    return data;
  },

  // Claims
  submitClaim: async () => {
    const { data } = await apiClient.post('/claim');
    return data;
  },

  getClaimStatus: async (walletAddress: string) => {
    const { data } = await apiClient.get(`/claim/${walletAddress}`);
    return data;
  },

  // Dashboard
  getMetrics: async () => {
    const { data } = await apiClient.get('/dashboard/metrics');
    return data;
  },

  getClaims: async (limit = 10, offset = 0) => {
    const { data } = await apiClient.get('/dashboard/claims', {
      params: { limit, offset },
    });
    return data;
  },

  getStats: async (days = 7) => {
    const { data } = await apiClient.get('/dashboard/stats', {
      params: { days },
    });
    return data;
  },

  // Admin
  createAirdrop: async (airdropData: any) => {
    const { data } = await apiClient.post('/admin/airdrop', airdropData);
    return data;
  },

  pauseAirdrop: async (id: string) => {
    const { data } = await apiClient.put(`/admin/airdrop/${id}/pause`);
    return data;
  },

  resumeAirdrop: async (id: string) => {
    const { data } = await apiClient.put(`/admin/airdrop/${id}/resume`);
    return data;
  },

  addToWhitelist: async (airdropId: string, wallets: string[]) => {
    const { data } = await apiClient.post('/admin/whitelist', {
      airdropId,
      wallets,
    });
    return data;
  },

  addToBlacklist: async (walletAddress: string, reason: string) => {
    const { data } = await apiClient.post('/admin/blacklist', {
      walletAddress,
      reason,
    });
    return data;
  },

  getAllClaims: async (params: any = {}) => {
    const { data } = await apiClient.get('/admin/claims', { params });
    return data;
  },

  exportClaims: async () => {
    const response = await apiClient.get('/admin/export/claims', {
      responseType: 'blob',
    });
    return response.data;
  },

  getAnalytics: async () => {
    const { data } = await apiClient.get('/admin/analytics');
    return data;
  },
};

export default apiClient;
