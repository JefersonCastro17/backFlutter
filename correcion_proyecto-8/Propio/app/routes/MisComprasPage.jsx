import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "../contexts/AuthContext";
import { httpRequest } from "../lib/api/httpClient";
import { formatPrice } from "../lib/services/productData";
import "../styles/ticket.css";

const ORDERS_PER_PAGE = 20;

function MisComprasPage() {
  const navigate = useNavigate();
  const { token, getUserId } = useAuthContext();
  const [ticketId, setTicketId] = useState("");
  const [ticket, setTicket] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  const consultarCompra = async (idParam) => {
    const id = idParam !== undefined ? Number(idParam) : Number(ticketId);

    if (!id || !Number.isInteger(id) || id <= 0) {
      setError("Ingresa un ID de comprobante válido.");
      setTicket(null);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await httpRequest(`/api/sales/orders/${id}`, {
        method: "GET",
        auth: true,
        token: token || undefined,
      });

      setTicket(data);
      setSelectedOrderId(id);
      setTicketId(String(id));
    } catch (err) {
      setTicket(null);
      setError(err?.message || "No se pudo consultar el comprobante.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchOrders = async () => {
      if (!getUserId()) return;
      try {
        setLoading(true);
        const list = await httpRequest(`/api/sales/orders`, {
          method: "GET",
          auth: true,
          token: token || undefined,
        });
        setOrders(list || []);
      } catch (err) {
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [token, getUserId]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(orders.length / ORDERS_PER_PAGE)), [orders.length]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * ORDERS_PER_PAGE;
    return orders.slice(start, start + ORDERS_PER_PAGE);
  }, [orders, currentPage]);

  const handleVolver = () => {
    navigate("/catalogo");
  };

  const userId = getUserId();

  const handlePrint = () => {
    if (!ticket) return;
    window.print();
  };

  const formatTicketText = () => {
    if (!ticket) return "";

    const lines = [
      "TICKET DE COMPRA ELECTRONICO",
      "MERCAPLENO",
      "",
      `Cliente: ${ticket.customer || "Cliente"}`,
      `Método de pago: ${ticket.paymentMethod || "No informado"}`,
      `Fecha: ${ticket.date ? new Date(ticket.date).toLocaleString("es-CO") : "Sin fecha"}`,
      `ID orden: ${ticket.id}`,
      "",
      "Productos:",
    ];

    (ticket.items || []).forEach((item) => {
      const name = item.name || item.nombre || "Producto";
      const quantity = Number(item.quantity ?? item.cantidad ?? 0);
      const price = Number(item.price ?? 0);
      const subtotal = Number(item.subtotal ?? price * quantity);
      lines.push(`${name} x${quantity}    ${formatPrice(subtotal)}`);
    });

    lines.push("", `Subtotal: ${formatPrice(Number(ticket.subTotal ?? ticket.subtotal ?? 0))}`);
    lines.push(`Impuestos: ${formatPrice(Number(ticket.tax ?? 0))}`);
    lines.push(`TOTAL: ${formatPrice(Number(ticket.total ?? 0))}`);
    return lines.join("\r\n");
  };

  const handleDownloadText = () => {
    if (!ticket) return;
    const content = formatTicketText();
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `comprobante_${ticket.id || "ticket"}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <main style={{ maxWidth: 1200, margin: "40px auto", padding: "0 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0 }}>Mis compras</h2>
          <p style={{ margin: "8px 0 0", color: "#4b5563" }}>
            Consulta tu comprobante o selecciona una compra de la lista.
          </p>
        </div>
        <button className="boton-nav" onClick={handleVolver}>
          Volver al catálogo
        </button>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 6px 18px rgba(0,0,0,0.08)" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
          <div style={{ flex: "1 1 430px", minWidth: 320, maxWidth: 520 }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
              <input
                type="number"
                min="1"
                placeholder="ID de la compra"
                value={ticketId}
                onChange={(e) => setTicketId(e.target.value)}
                style={{ flex: 1, minWidth: 150, padding: 12, borderRadius: 8, border: "1px solid #d1d5db" }}
              />
              <button className="boton-nav" onClick={() => consultarCompra()} disabled={loading}>
                {loading ? "Consultando..." : "Consultar comprobante"}
              </button>
            </div>

            {error && (
              <div style={{ background: "#fee2e2", color: "#991b1b", padding: 12, borderRadius: 8, marginBottom: 20 }}>
                {error}
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <h4 style={{ margin: "0 0 12px" }}>Compras registradas</h4>
              {orders.length === 0 && (
                <div style={{ color: "#4b5563", padding: "10px 0" }}>
                  No hay compras registradas.
                </div>
              )}
              <div style={{ display: "grid", gap: 12 }}>
                {paginatedOrders.map((o) => {
                  const isSelected = Number(selectedOrderId) === Number(o.id);
                  return (
                    <div
                      key={o.id}
                      onClick={() => consultarCompra(o.id)}
                      style={{
                        cursor: "pointer",
                        background: isSelected ? "#eef6ff" : "#fafafa",
                        border: isSelected ? "2px solid #0b63d5" : "1px solid #eee",
                        borderRadius: 12,
                        padding: 16,
                        transition: "background 0.2s, border 0.2s",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                        <div>
                          <div style={{ fontSize: 13, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>Comprobante</div>
                          <div style={{ fontWeight: 700, fontSize: 18, marginTop: 6 }}>#{o.id}</div>
                        </div>
                        <div style={{ textAlign: "right", minWidth: 90 }}>
                          <div style={{ color: "#6b7280", fontSize: 13 }}>Total</div>
                          <div style={{ fontWeight: 700, marginTop: 6 }}>{formatPrice(o.total)}</div>
                        </div>
                      </div>
                      <div style={{ marginTop: 12, color: "#4b5563", fontSize: 14 }}>
                        {o.date ? new Date(o.date).toLocaleString("es-CO") : "Fecha sin disponible"}
                      </div>
                      <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ background: "#e2e8f0", borderRadius: 9999, padding: "6px 10px", fontSize: 13 }}>
                          {o.itemsCount ?? o.items?.length ?? 0} productos
                        </span>
                        <span style={{ background: "#e2e8f0", borderRadius: 9999, padding: "6px 10px", fontSize: 13 }}>
                          {o.paymentMethod}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {orders.length > ORDERS_PER_PAGE && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16, gap: 8 }}>
                  <button
                    type="button"
                    className="boton-nav"
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    Anterior
                  </button>
                  <span style={{ color: "#4b5563" }}>
                    Página {currentPage} de {totalPages}
                  </span>
                  <button
                    type="button"
                    className="boton-nav"
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                  >
                    Siguiente
                  </button>
                </div>
              )}
            </div>
          </div>

          <div style={{ flex: "1 1 520px", minWidth: 320 }}>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, minHeight: 440 }}>
              {!ticket ? (
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: 360, color: "#6b7280" }}>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 18 }}>Selecciona una compra</p>
                  <p style={{ marginTop: 12, maxWidth: 320, textAlign: "center" }}>
                    Haz clic en una tarjeta de comprobante para ver el detalle completo de la orden.
                  </p>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 18, alignItems: "center" }}>
                    <div>
                      <div style={{ color: "#6b7280", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>Comprobante</div>
                      <h3 style={{ margin: "8px 0 0" }}>#{ticket.id}</h3>
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <button type="button" className="boton-nav" onClick={handlePrint} style={{ whiteSpace: "nowrap" }}>
                        Imprimir comprobante
                      </button>
                    </div>
                    <div>
                      <div style={{ color: "#6b7280", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>Fecha</div>
                      <div style={{ marginTop: 8 }}>{ticket.date ? new Date(ticket.date).toLocaleString("es-CO") : "Sin fecha"}</div>
                    </div>
                    <div>
                      <div style={{ color: "#6b7280", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>Total</div>
                      <div style={{ marginTop: 8, fontWeight: 700 }}>{formatPrice(ticket.total)}</div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 18 }}>
                    <div><strong>Cliente:</strong> {ticket.customer || "Usuario"}</div>
                    <div><strong>Método de pago:</strong> {ticket.paymentMethod}</div>
                    <div><strong>ID usuario:</strong> {userId ?? "No disponible"}</div>
                  </div>

                  <h4 style={{ margin: "0 0 12px" }}>Productos</h4>
                  <div style={{ borderTop: "1px solid #e5e7eb" }}>
                    {ticket.items?.map((item) => (
                      <div key={`${ticket.id}-${item.id}`} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "12px 0", borderBottom: "1px solid #f3f4f6" }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{item.name}</div>
                          <div style={{ color: "#6b7280", fontSize: 14 }}>Cantidad: {item.quantity}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div>{formatPrice(item.price)}</div>
                          <div style={{ color: "#6b7280", fontSize: 14 }}>{formatPrice(item.subtotal)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {ticket && (
          <div className="print-only">
            <div className="ticket-page-container">
              <div className="ticket-content">
                <h2 className="ticket-header">Ticket de Compra Electronico</h2>
                <p className="ticket-logo">MERCAPLENO</p>
                <div className="ticket-details-user">
                  <p><strong>Cliente:</strong> {ticket.customer}</p>
                  <p><strong>Método de pago:</strong> {ticket.paymentMethod}</p>
                  <p><strong>Fecha:</strong> {ticket.date ? new Date(ticket.date).toLocaleString("es-CO") : "Sin fecha"}</p>
                  <p><strong>ID orden:</strong> {ticket.id}</p>
                </div>
                <p className="productos-titulo"><strong>Productos:</strong></p>
                <div className="detalle-productos">
                  {ticket.items?.map((item) => {
                    const name = item.name || item.nombre || "Producto";
                    const quantity = Number(item.quantity ?? item.cantidad ?? 0);
                    const price = Number(item.price ?? 0);
                    const subtotal = Number(item.subtotal ?? price * quantity);
                    return (
                      <div key={`${ticket.id}-${item.id}-print`} className="producto-linea">
                        <span className="producto-nombre">{name} x{quantity}</span>
                        <span className="alinear-derecha">{formatPrice(subtotal)}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="ticket-totals">
                  <p>Subtotal: <span className="alinear-derecha">{formatPrice(Number(ticket.subTotal ?? ticket.subtotal ?? ticket.items?.reduce((sum, item) => sum + Number(item.subtotal ?? Number(item.price ?? 0) * Number(item.quantity ?? 0)), 0) ?? 0))}</span></p>
                  <p>Impuestos: <span className="alinear-derecha">{formatPrice(Number(ticket.tax ?? 0))}</span></p>
                  <h3 className="total-final">TOTAL: <span className="alinear-derecha">{formatPrice(Number(ticket.total ?? 0))}</span></h3>
                </div>
                <p className="agradecimiento">Gracias por tu compra.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default MisComprasPage;
