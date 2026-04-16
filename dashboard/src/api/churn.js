// dashboard/src/api/churn.js
import client from './client.js';

export const getChurnScore    = (customerId)  => client.get(`/churn/${customerId}`);
export const getPlaybook      = (customerId)  => client.get(`/playbook/${customerId}`);
export const getInterventions = (params = {}) => client.get('/interventions', { params });
export const getTimeline      = (customerId)  => client.get(`/timeline/${customerId}`);
export const getCohorts       = ()            => client.get('/cohorts');
