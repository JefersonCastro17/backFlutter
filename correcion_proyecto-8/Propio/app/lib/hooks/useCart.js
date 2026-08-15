// src/hooks/useCart.js

import { useState, useEffect, useMemo } from 'react';
import { sendOrder } from '../services/productData';
import {
  getCartSum,
  addCartItem,
  updateCartItem,
  deleteCartItem,
  clearCart as clearCartBackend,
} from '../services/cartService';

const mapBackendItems = (backendItems = [], fallbackItems = []) => {
  return backendItems.map((item) => {
    const fallback = fallbackItems.find(
      (f) => Number(f.productId || f.id) === Number(item.productId),
    );

    return {
      id: Number(item.id),
      productId: Number(item.productId),
      nombre: item.name || fallback?.nombre || fallback?.name || 'Producto',
      price: Number(item.currentPrice ?? item.priceSnapshot ?? fallback?.price ?? 0),
      cantidad: Number(item.quantity ?? item.cantidad ?? 0),
      image: fallback?.image,
    };
  });
};

export const useCart = () => {
  const [cart, setCart] = useState([]);

  const refreshCart = async () => {
    try {
      const cartSum = await getCartSum();
      if (Array.isArray(cartSum.items)) {
        setCart(mapBackendItems(cartSum.items));
      }
    } catch (error) {
      console.error('Error cargando carrito desde backend:', error);
    }
  };

  useEffect(() => {
    refreshCart();
  }, []);

  // Escucha eventos globales para limpiar el carrito (p.ej. logout)
  useEffect(() => {
    const handler = () => {
      setCart([]);
    };

    window.addEventListener('mercapleno:clearCart', handler);
    return () => window.removeEventListener('mercapleno:clearCart', handler);
  }, []);

  // Bloquea el inicio de nuevos procesos de checkout si se detecta logout
  const sessionActiveRef = (function () {
    let active = true;
    return {
      isActive: () => active,
      setInactive: () => {
        active = false;
      }
    };
  })();

  useEffect(() => {
    const onLogout = () => {
      sessionActiveRef.setInactive();
      setCart([]);
    };

    window.addEventListener('mercapleno:logout', onLogout);
    return () => window.removeEventListener('mercapleno:logout', onLogout);
  }, []);


  // --- FUNCIONES DE MANEJO DEL CARRITO ---
  const addToCart = async (product) => {
    await addCartItem({ productId: product.id, quantity: 1 });
    await refreshCart();
  };

  const setItemQuantity = async (cartItemId, newQuantity) => {
    await updateCartItem({ itemId: cartItemId, quantity: newQuantity });
    await refreshCart();
  };

  const removeFromCart = async (cartItemId) => {
    await deleteCartItem(cartItemId);
    await refreshCart();
  };
  
  const clearCart = async () => {
    await clearCartBackend();
    setCart([]);
  };

  // --- CÁLCULO DE TOTALES (Usa 'cart') ---
  const totals = useMemo(() => {
    // Asegúrate de que los campos 'price' y 'cantidad' existan
    const totalItems = cart.reduce((acc, item) => acc + item.cantidad, 0);
    const subTotal = cart.reduce((acc, item) => acc + (item.cantidad * item.price), 0);
    
    // Aquí puedes calcular el IVA (tax) si lo deseas
    const tax = 0; 
    const finalTotal = subTotal;

    return { totalItems, subTotal, tax, finalTotal };
  }, [cart]);

  // --- FUNCIÓN DE CHECKOUT (alineada con la V7) ---
  const processCheckout = async (id_metodo) => { 
    if (!sessionActiveRef.isActive()) {
      throw new Error('Sesion cerrada. Checkout cancelado.');
    }

    if (cart.length > 0) {
      const orderData = {
        id_metodo: id_metodo
      };
      try {
        if (!sessionActiveRef.isActive()) {
          throw new Error('Sesion cerrada antes de enviar la orden.');
        }

        const result = await sendOrder(orderData);

        if (result && (result.id_venta || result.ticketId)) {
          localStorage.setItem('lastPurchasedCart', JSON.stringify(cart));
          return result;
        }

        throw new Error(result?.message || result?.error || "Fallo en la transacción de venta.");
      } catch (error) {
        throw error;
      }
    }
    return false;
  };

  // --- VALORES DEVUELTOS POR EL HOOK ---
  return {
    cart,
    setCart,
    addToCart,
    setItemQuantity,
    removeFromCart,
    clearCart, // Asegura que clearCart esté disponible
    totalItems: totals.totalItems,
    subTotal: totals.subTotal,
    finalTotal: totals.finalTotal,
    processCheckout, // La función modificada
  };
};