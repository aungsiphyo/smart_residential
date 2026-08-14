import { apiRequest } from './client';

export const HELPER_CATEGORIES = [
  'House Helper',
  'Cleaning',
  'Cooking',
  'Laundry',
  'Elder Care',
  'Child Care',
  'Maintenance',
];

export async function fetchHelpers(params = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.gender) query.set('gender', params.gender);

  const qs = query.toString();
  const path = qs ? `/helpers?${qs}` : '/helpers';
  const res = await apiRequest(path);
  return Array.isArray(res) ? res : res.data || [];
}

export async function createHelperRequest(payload) {
  const res = await apiRequest('/helper-requests', {
    method: 'POST',
    auth: true,
    body: payload,
  });
  return res.data || res.request;
}

export async function fetchMyHelperRequests() {
  return fetchHelperRequests({ mine: true });
}

export async function fetchHelperRequests(params = {}) {
  const query = new URLSearchParams();
  if (params.mine) query.set('mine', 'true');
  const qs = query.toString();
  const res = await apiRequest(
    qs ? `/helper-requests?${qs}` : '/helper-requests',
    { auth: true },
  );
  return Array.isArray(res) ? res : res.data || [];
}
