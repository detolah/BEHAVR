import client from './client.js';
export const listCustomers = () => client.get('/customers/list');
export const getCustomerById = id => client.get(`/customers/by-id/${id}`);
