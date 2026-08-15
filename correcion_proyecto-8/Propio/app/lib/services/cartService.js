import { httpRequest } from '../api/httpClient';

const CART_BASE = '/api/cart';

const authFetch = async (endpoint, method = 'GET', body = null) => {
  return await httpRequest(`${CART_BASE}${endpoint}`, {
    method,
    data: body,
    auth: true,
  });
};

export const getCart = async () => {
  const response = await authFetch('');
  return response?.items || [];
};

export const getCartSum = async () => {
  const response = await authFetch('/sum');
  return response || { items: [] };
};

export const addCartItem = async ({ productId, quantity = 1 }) => {
  const response = await authFetch('/items', 'POST', { productId, quantity });
  return response || { items: [] };
};

export const updateCartItem = async ({ itemId, quantity }) => {
  const response = await authFetch(`/items/${itemId}`, 'PATCH', { quantity });
  return response || { items: [] };
};

export const deleteCartItem = async (itemId) => {
  const response = await authFetch(`/items/${itemId}`, 'DELETE');
  return response || { items: [] };
};

export const clearCart = async () => {
  return await authFetch('', 'DELETE');
};
