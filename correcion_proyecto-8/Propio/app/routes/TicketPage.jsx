import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { formatPrice, getOrderById } from "../lib/services/productData";
import { useAuthContext } from "../contexts/AuthContext";

import "../styles/base.css";
import "../styles/ticket.css";

function TicketPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { getUserName, getUserEmail } = useAuthContext();
  const [ticketData, setTicketData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadTicketData = async () => {
      const userName = getUserName() || "Usuario Desconocido";
      const userEmail = getUserEmail() || "N/A";

      try {
        const finalCartJSON = localStorage.getItem("lastPurchasedCart");
        const finalTotalsJSON = localStorage.getItem("lastPurchasedTotals");
        const ticketIdFromState = location.state?.ticketId;

        if (finalCartJSON && finalTotalsJSON) {
          try {
            const totals = JSON.parse(finalTotalsJSON);
            const cart = JSON.parse(finalCartJSON);
            const now = new Date();
            const dateString = now.toLocaleDateString("es-CO", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit"
            });

            if (Array.isArray(cart) && totals) {
              setTicketData({
                cart,
                totals,
                name: userName,
                email: userEmail,
                date: dateString,
                ticketNumber: totals.ticketId || "N/A",
                paymentMethod: totals.paymentMethod || "Efectivo"
              });
              return;
            }
          } catch (parseError) {
            console.warn("Error parsing ticket data from localStorage:", parseError);
          }
        }

        if (!finalTotalsJSON && !ticketIdFromState) {
          setError("No hay información de comprobante disponible. Consulta Mis Compras para ver tus órdenes.");
          return;
        }

        const totals = finalTotalsJSON ? JSON.parse(finalTotalsJSON) : {};
        const ticketId = ticketIdFromState || totals.ticketId || totals.id || null;

        if (!ticketId) {
          setError("No se encontró un ID de comprobante válido. Consulta Mis Compras.");
          return;
        }

        const order = await getOrderById(ticketId);
        const subTotal = Array.isArray(order.items)
          ? order.items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0)
          : 0;
        const total = Number(order.total ?? 0);
        const tax = Number((total - subTotal).toFixed(2));

        setTicketData({
          cart: Array.isArray(order.items)
            ? order.items.map((item) => ({
                id: item.id,
                nombre: item.name,
                price: Number(item.price ?? 0),
                cantidad: Number(item.quantity ?? 0),
              }))
            : [],
          totals: {
            subTotal,
            tax: tax >= 0 ? tax : 0,
            finalTotal: total,
          },
          name: order.customer || userName,
          email: userEmail,
          date: order.date || new Date().toLocaleDateString("es-CO", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
          }),
          ticketNumber: String(order.id || ticketId),
          paymentMethod: order.paymentMethod || totals.paymentMethod || "No informado",
        });
      } catch (requestError) {
        const safeMessage = requestError?.message || "No se pudo recuperar el comprobante desde el servidor.";
        setError(safeMessage);
        console.error("Ticket loading error:", requestError);
      }
    };

    loadTicketData().finally(() => setLoading(false));
  }, [getUserEmail, getUserName, location.state]);

  const handleBack = () => {
    localStorage.removeItem("lastPurchasedCart");
    localStorage.removeItem("lastPurchasedTotals");
    navigate("/catalogo");
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return <div style={{ textAlign: "center", marginTop: "50px" }}>Cargando información del ticket...</div>;
  }

  if (error) {
    return (
      <div style={{ maxWidth: 980, margin: "40px auto", padding: "0 20px" }}>
        <div style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 12, padding: 20 }}>
          <h2>Error al mostrar el comprobante</h2>
          <p>{error}</p>
          <button className="boton-nav" onClick={handleBack} style={{ marginTop: 16 }}>
            Volver al catálogo
          </button>
        </div>
      </div>
    );
  }

  if (!ticketData) {
    return <div style={{ textAlign: "center", marginTop: "50px" }}>No hay información de ticket disponible.</div>;
  }

  return (
    <div className="ticket-page-container">
      <div className="ticket-content">
        <h2 className="ticket-header">Ticket de Compra Electronico</h2>
        <p className="ticket-logo">MERCAPLENO</p>

        <div className="ticket-details-user">
          <p><strong>Nombre:</strong> {ticketData.name}</p>
          <p><strong>Correo:</strong> {ticketData.email}</p>
          <p><strong>Fecha:</strong> {ticketData.date}</p>
          <p><strong>Numero de ticket:</strong> {ticketData.ticketNumber}</p>
          <p><strong>Metodo de Pago:</strong> {ticketData.paymentMethod}</p>
        </div>

        <p className="productos-titulo"><strong>Detalle de Productos:</strong></p>
        <div className="detalle-productos">
          {ticketData.cart.map((item) => {
            const nombre = item.nombre || item.name || "Producto";
            return (
              <div key={item.id} className="producto-linea">
                <span className="producto-nombre">
                  {nombre} ({item.cantidad} unid.)
                </span>
                <span className="alinear-derecha">
                  {formatPrice(item.price * item.cantidad)}
                </span>
              </div>
            );
          })}
        </div>

        <div className="ticket-totals">
          <p>Subtotal: <span className="alinear-derecha">{formatPrice(ticketData.totals.subTotal)}</span></p>
          <p>Impuestos (19%): <span className="alinear-derecha">{formatPrice(ticketData.totals.tax)}</span></p>
          <h3 className="total-final">TOTAL: <span className="alinear-derecha">{formatPrice(ticketData.totals.finalTotal)}</span></h3>
        </div>

        <p className="agradecimiento">Gracias por tu compra.</p>

        <div className="ticket-actions">
          <button onClick={handlePrint} className="boton-nav print-btn">
            Imprimir recibo
          </button>
          <button onClick={handleBack} className="boton-nav volver-catalogo-btn">
            Volver al Catalogo
          </button>
        </div>
      </div>
    </div>
  );
}

export default TicketPage;
