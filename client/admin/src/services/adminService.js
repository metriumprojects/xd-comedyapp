import apiClient from './apiClient';

export const adminAPI = {
  getUsers: (page = 1, limit = 20, search = '', role = '', status = '') =>
    apiClient.get('/admin/users', { params: { page, limit, search, role, status } }),

  banUser: (userId, reason = '') =>
    apiClient.post(`/admin/users/${userId}/ban`, { reason }),

  unbanUser: (userId) =>
    apiClient.post(`/admin/users/${userId}/unban`),

  updateUserRole: (userId, role) =>
    apiClient.post(`/admin/users/${userId}/role`, { role }),

  deleteUser: (userId) =>
    apiClient.delete(`/admin/users/${userId}`),
};
