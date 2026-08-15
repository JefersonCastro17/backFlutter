import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCartContext } from "../contexts/CartContext";
import { useAuthContext } from "../contexts/AuthContext";
import CartItem from "../components/ui/CartItem";
import TotalsSummary from "../components/features/TotalsSummary";
import { formatPrice, getPaymentMethods } from "../lib/services/productData";

import "../styles/base.css";
import "../styles/cart.css";

const FALLBACK_PAYMENT_METHODS = [
  { id: 1, name: "Efectivo", dbId: "M1" },
  { id: 2, name: "Tarjeta de Credito", dbId: "M2" },
  { id: 3, name: "Tarjeta de Debito", dbId: "M3" },
  { id: 4, name: "Transferencia", dbId: "M4" },
  { id: 5, name: "Nequi", dbId: "M5" },
  { id: 6, name: "Daviplata", dbId: "M6" }
];

const normalizeErrorMessage = (error, fallback = "Ocurrió un error inesperado.") => {
  if (!error) return fallback;
  if (typeof error === "string") return error || fallback;
  if (typeof error.message === "string" && error.message.trim()) return error.message;
  if (typeof error.error === "string" && error.error.trim()) return error.error;
  if (error.data && typeof error.data.message === "string" && error.data.message.trim()) return error.data.message;
  if (error.response?.data?.message) return error.response.data.message;
  return fallback;
};

function CartPage() {
  const navigate = useNavigate();
  const { cart, totalItems, clearCart, processCheckout } = useCartContext();
  const { isAuthenticated, getUserId } = useAuthContext();
  const [paymentMethods, setPaymentMethods] = useState(FALLBACK_PAYMENT_METHODS);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(FALLBACK_PAYMENT_METHODS[0].dbId);
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);

  useEffect(() => {
    const loadPaymentMethods = async () => {
      try {
        const methods = await getPaymentMethods();
        if (Array.isArray(methods) && methods.length > 0) {
          setPaymentMethods(methods);
          setSelectedPaymentMethod((current) => {
            if (methods.some((method) => method.dbId === current)) {
              return current;
            }
            return methods[0]?.dbId || current;
          });
        }
      } catch (error) {
        console.error('Error cargando metodos de pago:', error);
      }
    };

    loadPaymentMethods();
  }, []);

  const totals = useMemo(() => {
    const subTotalCents = cart.reduce((sum, item) => sum + Math.round(item.price * 100) * item.cantidad, 0);
    const subTotal = subTotalCents / 100;
    const taxRate = 0.19;
    const taxCents = Math.round(subTotalCents * taxRate);
    const tax = taxCents / 100;
    const finalTotalCents = subTotalCents + taxCents;
    const finalTotal = finalTotalCents / 100;
    return { subTotal, tax, finalTotal };
  }, [cart]);

  const handleCheckout = async () => {
    if (cart.length === 0) {
      setCheckoutError("Tu carrito esta vacio.");
      return;
    }

    const id_usuario = getUserId();
    if (!isAuthenticated || !id_usuario) {
      setCheckoutError("Debes iniciar sesion para completar la compra.");
      return;
    }

    setIsProcessing(true);
    setCheckoutError(null);

    try {
      if (!selectedPaymentMethod) {
        setCheckoutError("Selecciona un método de pago válido.");
        return;
      }

      const result = await processCheckout(selectedPaymentMethod);

      if (result && (result.id_venta || result.ticketId)) {
        const ticketId = result.ticketId || result.id_venta || "N/A";

        localStorage.setItem("lastPurchasedCart", JSON.stringify(cart));
        localStorage.setItem(
          "lastPurchasedTotals",
          JSON.stringify({
            total: Number(result.total ?? totals.finalTotal),
            subtotal: Number(result.subtotal ?? totals.subTotal),
            tax: Number(result.tax ?? totals.tax),
            ticketId,
            paymentMethod: paymentMethods.find((m) => m.dbId === selectedPaymentMethod)?.name || "Desconocido",
            warnings: Array.isArray(result.warnings) ? result.warnings : []
          })
        );

        try {
          await clearCart();
        } catch (clearError) {
          console.warn("No se pudo vaciar el carrito después del pago:", clearError);
        }

        navigate("/ticket");
      } else {
        setCheckoutError("Error al procesar la compra.");
      }
    } catch (error) {
      const safeMessage = normalizeErrorMessage(error, "Error grave al procesar el pago.");
      setCheckoutError(safeMessage);
      console.error("Checkout error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <main className="cart-page">
      <div className="cart-page__shell">
        <header className="cart-page__header">
          <div>
            <h1>Tu Carrito</h1>
            <p>Revisa tu pedido y finaliza la compra de forma segura.</p>
          </div>
          <div className="cart-page__badge">
            <span>{totalItems} productos</span>
            <strong>{formatPrice(totals.finalTotal)}</strong>
          </div>
        </header>

        {totalItems === 0 ? (
          <section className="cart-empty">
            <h2>Tu carrito esta vacio</h2>
            <p>Agrega productos desde el catalogo para continuar.</p>
            <button type="button" className="cart-btn cart-btn--primary" onClick={() => navigate("/catalogo")}>
              Explorar productos
            </button>
          </section>
        ) : (
          <div className="cart-page__grid">
            <section className="cart-list-panel">
              <div className="cart-list-head">
                <span>Producto</span>
                <span>Cantidad</span>
                <span>Subtotal</span>
              </div>

              <div className="cart-list-body">
                {cart.map((item) => (
                  <CartItem key={item.id} item={item} />
                ))}
              </div>
            </section>

            <aside className="cart-summary-panel">
              <div className="cart-summary-panel__actions">
                <button
                  type="button"
                  className="cart-btn cart-btn--danger"
                  onClick={async () => {
                    if (!window.confirm("Vaciar carrito?")) {
                      return;
                    }

                    try {
                      await clearCart();
                    } catch (error) {
                      console.error('Error al vaciar el carrito:', error);
                      alert('No se pudo vaciar el carrito. Intenta de nuevo.');
                    }
                  }}
                  disabled={isProcessing}
                >
                  Vaciar carrito
                </button>
                <button
                  type="button"
                  className="cart-btn cart-btn--muted"
                  onClick={() => navigate("/catalogo")}
                >
                  Seguir comprando
                </button>
              </div>

                        <div className="cart-payment-box">
                <label htmlFor="payment-method">Metodo de pago</label>
                <select
                  id="payment-method"
                  value={selectedPaymentMethod}
                  onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                  disabled={isProcessing || paymentMethods.length === 0}
                >
                  {paymentMethods.length > 0 ? (
                    paymentMethods.map((method) => (
                      <option key={method.value || method.id_metodo || method.id} value={method.value || method.id_metodo || method.id}>
                        {method.label || method.metodo_pago || method.name || method.id_metodo || method.id}
                      </option>
                    ))
                  ) : (
                    <option value="">Cargando metodos de pago...</option>
                  )}
                </select>
              </div>

              <TotalsSummary totals={totals} totalItems={totalItems} formatPrice={formatPrice} />

              {checkoutError && <p className="cart-checkout-error">{checkoutError}</p>}

              <button
                type="button"
                className="cart-btn cart-btn--pay"
                onClick={handleCheckout}
                disabled={isProcessing}
              >
                {isProcessing ? "Procesando..." : `Pagar ${formatPrice(totals.finalTotal)}`}
              </button>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}

export default CartPage;
