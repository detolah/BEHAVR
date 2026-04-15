import client from './client.js';
export const registerCompany = data => client.post('/companies', data);
export const login           = data => client.post('/auth/login', data);
