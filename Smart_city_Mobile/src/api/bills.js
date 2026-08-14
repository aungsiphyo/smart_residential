import { apiRequest } from './client';

export async function fetchBills() {
  const res = await apiRequest('/bills', { auth: true });
  return Array.isArray(res) ? res : res.data || [];
}
