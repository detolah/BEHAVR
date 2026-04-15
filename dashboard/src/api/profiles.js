import client from './client.js';
export const getProfile   = id   => client.get(`/profiles/${id}`);
export const updateProfile = (id, data) => client.patch(`/profiles/${id}`, data);
export const getHistory   = id   => client.get(`/profiles/${id}/history`);
