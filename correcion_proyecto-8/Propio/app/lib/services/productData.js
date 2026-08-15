import { httpRequest } from "../api/httpClient";
import { API_ENDPOINTS } from "../config/api.config";

const SALES_BASE = API_ENDPOINTS.sales.base;

export const formatPrice = (price) => {
  const normalizedPrice =
    typeof price === "number"
      ? price
      : typeof price === "string"
        ? Number(price)
        : Number.NaN;

  if (!Number.isFinite(normalizedPrice)) return "$0.00";

  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(normalizedPrice);
};

export const authorizedFetch = async (endpoint, method = "GET", body = null) => {
  try {
    return await httpRequest(`${SALES_BASE}${endpoint}`, {
      method,
      data: body,
      auth: true
    });
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      const authError = new Error("Token invalido o requerido. Redirigir a Login.");
      authError.status = error.status;
      throw authError;
    }
    throw error;
  }
};

export const getProducts = async (nombre, categoria, precioMin, precioMax) => {
  const params = new URLSearchParams();

  if (nombre) params.append("search", nombre);
  if (categoria && categoria !== "todas") params.append("category", categoria);
  if (precioMin) params.append("precioMin", precioMin);
  if (precioMax) params.append("precioMax", precioMax);

  const endpoint = `/products?${params.toString()}`;
  const result = await authorizedFetch(endpoint);
  return result?.products || result?.data || result;
};

export const getCategories = async () => {
  const result = await authorizedFetch("/categories");
  return result?.categories || result?.data || result;
};

export const getPaymentMethods = async () => {
  try {
    const result = await httpRequest(API_ENDPOINTS.sales.paymentMethods, {
      method: "GET",
      auth: true,
    });
    const methods = result?.methods || result?.data || result || [];

    if (Array.isArray(methods) && methods.length > 0) {
      return methods.map((method) => ({
        id: String(method.id_metodo ?? method.value ?? method.id ?? ""),
        name: String(method.metodo_pago ?? method.label ?? method.name ?? method.id_metodo ?? "Metodo de pago"),
        dbId: String(method.id_metodo ?? method.value ?? method.id ?? "")
      }));
    }
  } catch (error) {
    console.warn("No se pudieron cargar los metodos de pago desde el backend, usando fallback local.", error);
  }

  return [
    { id: 1, name: "Efectivo", dbId: "M1" },
    { id: 2, name: "Tarjeta de Credito", dbId: "M2" },
    { id: 3, name: "Tarjeta de Debito", dbId: "M3" },
    { id: 4, name: "Transferencia", dbId: "M4" },
    { id: 5, name: "Nequi", dbId: "M5" },
    { id: 6, name: "Daviplata", dbId: "M6" }
  ];
};

export const sendOrder = async (orderData) => {
  return authorizedFetch('/orders', 'POST', orderData);
};

export const getOrderById = async (orderId) => {
  const result = await authorizedFetch(`/orders/${orderId}`);
  return result;
};
