import client from './client.js';
export const listCustomers = () => client.get('/customers/list');
export const getCustomerById = id => client.get(`/customers/by-id/${id}`);

export const importCsv     = (rows)                        => client.post('/customers/import/csv',     { rows });
export const importZendesk = (subdomain, email, api_token) => client.post('/customers/import/zendesk', { subdomain, email, api_token });
