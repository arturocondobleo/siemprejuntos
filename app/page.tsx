"use client";

import { useState, useEffect } from "react";
import { Amplify } from "aws-amplify";
import outputs from "@/amplify_outputs.json";
import { Authenticator } from "@aws-amplify/ui-react";
import { generateClient } from "aws-amplify/data";
import { uploadData, getUrl } from "aws-amplify/storage";
import { QRCodeSVG } from "qrcode.react";
import type { Schema } from "@/amplify/data/resource";
import "@aws-amplify/ui-react/styles.css";
import "./../app/app.css";

Amplify.configure(outputs);

const client = generateClient<Schema>();

interface Payment {
  id: string;
  monto: string;
  recibo: string;
  reporteCobranza: string;
  metodoPago: string;
  fecha: string;
  evidencePath?: string;
}

interface CobranzaEntry {
  id: string;
  remision: string;
  notaVenta: string;
  factura: string;
  total: string;
  saldo: string;
  pagos: Payment[];
}

export default function App() {
  const [view, setView] = useState<"dashboard" | "cobranza">("dashboard");
  const [entries, setEntries] = useState<CobranzaEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<CobranzaEntry | null>(null);
  
  // Estado para nuevo pago
  const [isAddingPayment, setIsAddingPayment] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  
  // Estado para subida de evidencia
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadSessionId, setUploadSessionId] = useState<string | null>(null);
  const [uploadPaymentId, setUploadPaymentId] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState("");
  
  const [newPayment, setNewPayment] = useState({
    monto: "",
    recibo: "",
    reporteCobranza: "",
    metodoPago: ""
  });

  const [newEntryData, setNewEntryData] = useState({
    remision: "",
    notaVenta: "",
    factura: "",
    total: ""
  });

  const handleAdd = () => {
    if (!newEntryData.remision) return; // Basic validation

    const entry: CobranzaEntry = {
      id: Date.now().toString(),
      remision: newEntryData.remision,
      notaVenta: newEntryData.notaVenta,
      factura: newEntryData.factura,
      total: newEntryData.total,
      saldo: newEntryData.total,
      pagos: []
    };
    
    setEntries(prev => {
      const newEntries = [...prev, entry];
      return newEntries.sort((a, b) => Number(b.remision) - Number(a.remision));
    });
    
    setShowModal(false);
    setNewEntryData({ remision: "", notaVenta: "", factura: "", total: "" });
  };

  const handleSavePayment = () => {
    if (!selectedEntry || !newPayment.monto) return;

    let updatedPayments;

    if (editingPaymentId) {
      // Actualizar pago existente
      updatedPayments = selectedEntry.pagos.map(p => 
        p.id === editingPaymentId 
        ? { ...p, ...newPayment } 
        : p
      );
    } else {
      // Agregar nuevo pago
      const payment: Payment = {
        id: Date.now().toString(),
        ...newPayment,
        fecha: new Date().toLocaleDateString()
      };
      updatedPayments = [...(selectedEntry.pagos || []), payment];
    }

    const currentTotal = parseFloat(selectedEntry.total) || 0;
    const totalPayments = updatedPayments.reduce((sum, p) => sum + (parseFloat(p.monto) || 0), 0);
    const newSaldo = currentTotal - totalPayments;

    setSelectedEntry({
      ...selectedEntry,
      pagos: updatedPayments,
      saldo: newSaldo.toFixed(2)
    });

    setIsAddingPayment(false);
    setEditingPaymentId(null);
    setNewPayment({ monto: "", recibo: "", reporteCobranza: "", metodoPago: "" });
  };

  const handleEditPaymentClick = (payment: Payment) => {
    setNewPayment({
      monto: payment.monto,
      recibo: payment.recibo,
      reporteCobranza: payment.reporteCobranza,
      metodoPago: payment.metodoPago
    });
    setEditingPaymentId(payment.id);
    setIsAddingPayment(true);
  };

  const handleInitiateUpload = async (paymentId: string) => {
    setUploadPaymentId(paymentId);
    setShowUploadModal(true);
    
    // Crear sesión de subida
    const { data: session, errors } = await client.models.PaymentEvidenceSession.create({
      sessionId: crypto.randomUUID(),
      status: "PENDING"
    });

    if (session) {
      setUploadSessionId(session.id);
      // Generar URL para el QR (asumiendo que la app está desplegada o accesible)
      const url = `${window.location.origin}/mobile-upload?sessionId=${session.id}`;
      setQrUrl(url);

      // Suscribirse a cambios
      const sub = client.models.PaymentEvidenceSession.observeQuery({
        filter: { id: { eq: session.id } }
      }).subscribe({
        next: ({ items }) => {
          const updatedSession = items[0];
          if (updatedSession && updatedSession.status === "COMPLETED" && updatedSession.imageUrl) {
            handleUploadComplete(paymentId, updatedSession.imageUrl);
            sub.unsubscribe();
            setShowUploadModal(false);
          }
        }
      });
    }
  };

  const handleUploadComplete = (paymentId: string, path: string) => {
    if (!selectedEntry) return;

    const updatedPayments = selectedEntry.pagos.map(p => 
      p.id === paymentId ? { ...p, evidencePath: path } : p
    );

    setSelectedEntry({
      ...selectedEntry,
      pagos: updatedPayments
    });
  };

  const handleManualUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && uploadPaymentId) {
      const file = e.target.files[0];
      const filename = `evidence/manual-${Date.now()}-${file.name}`;
      
      try {
        await uploadData({
          path: filename,
          data: file,
        }).result;
        
        handleUploadComplete(uploadPaymentId, filename);
        setShowUploadModal(false);
      } catch (err) {
        console.error("Error uploading file:", err);
        alert("Error al subir el archivo");
      }
    }
  };

  const handleUpdate = () => {
    if (!selectedEntry) return;
    
    setEntries(prev => {
      const updatedEntries = prev.map(e => e.id === selectedEntry.id ? selectedEntry : e);
      return updatedEntries.sort((a, b) => Number(b.remision) - Number(a.remision));
    });
    setSelectedEntry(null);
  };

  const filteredEntries = entries.filter(e => 
    e.remision.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.notaVenta.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.factura.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderCobranzaList = () => {
    // Si hay búsqueda, mostramos solo los resultados sin gaps
    if (searchTerm) {
      if (filteredEntries.length === 0) {
        return <p style={{ textAlign: 'center', color: '#888' }}>No hay registros</p>;
      }
      return filteredEntries.map((entry) => (
        <div 
          key={entry.id} 
          className="cobranza-card summary-card"
          onClick={() => setSelectedEntry(entry)}
        >
          <div className="card-row">
            <div className="input-group">
              <label>Número de remisión</label>
              <div className="value-display">{entry.remision}</div>
            </div>
            <div className="input-group">
              <label>Nota de venta</label>
              <div className="value-display">{entry.notaVenta}</div>
            </div>
          </div>
        </div>
      ));
    }

    // Si no hay búsqueda, mostramos la lista completa con gaps
    if (entries.length === 0) {
      return <p style={{ textAlign: 'center', color: '#888' }}>No hay registros</p>;
    }

    const listItems = [];
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      
      // Renderizar la entrada actual
      listItems.push(
        <div 
          key={entry.id} 
          className="cobranza-card summary-card"
          onClick={() => setSelectedEntry(entry)}
        >
          <div className="card-row">
            <div className="input-group">
              <label>Número de remisión</label>
              <div className="value-display">{entry.remision}</div>
            </div>
            <div className="input-group">
              <label>Nota de venta</label>
              <div className="value-display">{entry.notaVenta}</div>
            </div>
          </div>
        </div>
      );

      // Calcular y renderizar gap si existe
      if (i < entries.length - 1) {
        const currentRemision = parseInt(entry.remision);
        const nextRemision = parseInt(entries[i + 1].remision);
        
        if (!isNaN(currentRemision) && !isNaN(nextRemision) && (currentRemision - nextRemision > 1)) {
          const missing = [];
          for (let j = currentRemision - 1; j > nextRemision; j--) {
            missing.push(j);
          }
          listItems.push(
            <div key={`gap-${entry.id}`} className="gap-separator">
              ⚠️ Pendiente agregar: {missing.join(', ')}
            </div>
          );
        }
      }
    }
    return listItems;
  };

  return (
    <Authenticator>
      {({ signOut, user }) => (
        <main>
          {view === "dashboard" ? (
            <div className="container">
              <header className="header">
                <h1>Hola, {user?.signInDetails?.loginId?.split('@')[0]}</h1>
                <button onClick={signOut} className="btn-secondary">
                  Cerrar sesión
                </button>
              </header>
              
              <div className="grid-menu">
                <button 
                  onClick={() => setView("cobranza")} 
                  className="card-button"
                >
                  <span className="icon">💰</span>
                  <h2>Cobranza</h2>
                  <p>Acceder al módulo de cobros</p>
                </button>
              </div>
            </div>
          ) : (
            <div className="container">
              <header className="header">
                <button onClick={() => setView("dashboard")} className="btn-back">
                  ← Volver
                </button>
                <h1>Cobranza</h1>
                <div style={{ width: '100px' }}></div>
              </header>
              
              <div className="content-area">
                <input 
                  type="text" 
                  placeholder="Buscar por remisión, nota o factura..." 
                  className="search-bar"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />

                <div className="cobranza-list">
                  {renderCobranzaList()}
                </div>

                <button className="fab-add" onClick={() => setShowModal(true)}>
                  +
                </button>

                {/* Modal para Nueva Entrada */}
                {showModal && (
                  <div className="modal-overlay">
                    <div className="modal">
                      <h2>Nueva Entrada</h2>
                      <div className="input-group">
                        <label>Número de remisión</label>
                        <input 
                          type="number" 
                          value={newEntryData.remision}
                          onChange={e => setNewEntryData({...newEntryData, remision: e.target.value})}
                          placeholder="Ej. 1001"
                          autoFocus
                        />
                      </div>
                      <div className="input-group">
                        <label>Nota de venta</label>
                        <input 
                          type="text" 
                          value={newEntryData.notaVenta}
                          onChange={e => setNewEntryData({...newEntryData, notaVenta: e.target.value})}
                        />
                      </div>
                      <div className="input-group">
                        <label>Factura</label>
                        <input 
                          type="text" 
                          value={newEntryData.factura}
                          onChange={e => setNewEntryData({...newEntryData, factura: e.target.value})}
                        />
                      </div>
                      <div className="input-group">
                        <label>Total de la nota $</label>
                        <input 
                          type="number" 
                          value={newEntryData.total}
                          onChange={e => setNewEntryData({...newEntryData, total: e.target.value})}
                        />
                      </div>
                      <div className="modal-actions">
                        <button className="btn-cancel" onClick={() => setShowModal(false)}>Cancelar</button>
                        <button className="btn-primary" onClick={handleAdd}>Agregar</button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Modal de Subida de Evidencia */}
                {showUploadModal && (
                  <div className="modal-overlay" style={{ zIndex: 1100 }}>
                    <div className="modal" style={{ maxWidth: '400px', textAlign: 'center' }}>
                      <h3>Subir Evidencia</h3>
                      <p>Selecciona una opción para subir la evidencia del pago.</p>
                      
                      <div style={{ margin: '2rem 0' }}>
                        <h4>Opción 1: Desde tu PC</h4>
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={handleManualUpload}
                          style={{ marginTop: '0.5rem' }}
                        />
                      </div>

                      <div style={{ borderTop: '1px solid #eee', paddingTop: '1rem' }}>
                        <h4>Opción 2: Desde tu Celular</h4>
                        <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>
                          Escanea este código QR con tu cámara:
                        </p>
                        <div style={{ background: 'white', padding: '1rem', display: 'inline-block', border: '1px solid #ddd', borderRadius: '8px' }}>
                          {qrUrl && <QRCodeSVG value={qrUrl} size={200} />}
                        </div>
                        <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.5rem' }}>
                          La página se actualizará automáticamente cuando subas la foto.
                        </p>
                      </div>

                      <button 
                        className="btn-cancel" 
                        onClick={() => setShowUploadModal(false)}
                        style={{ marginTop: '1rem', width: '100%' }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {/* Modal para Detalles de Entrada */}
                {selectedEntry && (
                  <div className="modal-overlay">
                    <div className="modal modal-large">
                      <div className="modal-header">
                        <h2>Detalles de Cobranza</h2>
                        <button className="close-button" onClick={() => setSelectedEntry(null)}>×</button>
                      </div>
                      
                      <div className="card-row">
                        <div className="input-group">
                          <label>Número de remisión</label>
                          <input 
                            type="number" 
                            value={selectedEntry.remision} 
                            onChange={(e) => setSelectedEntry({...selectedEntry, remision: e.target.value})}
                          />
                        </div>
                        <div className="input-group">
                          <label>Nota de venta</label>
                          <input 
                            type="text" 
                            value={selectedEntry.notaVenta} 
                            onChange={(e) => setSelectedEntry({...selectedEntry, notaVenta: e.target.value})}
                          />
                        </div>
                        <div className="input-group">
                          <label>Factura</label>
                          <input 
                            type="text" 
                            value={selectedEntry.factura} 
                            onChange={(e) => setSelectedEntry({...selectedEntry, factura: e.target.value})}
                          />
                        </div>
                        <div className="input-group">
                          <label>Total de la nota $</label>
                          <input 
                            type="number" 
                            value={selectedEntry.total} 
                            onChange={(e) => setSelectedEntry({
                              ...selectedEntry, 
                              total: e.target.value,
                              saldo: e.target.value // Actualizamos saldo igual al total por ahora
                            })}
                          />
                        </div>
                      </div>
                      
                      <div className="saldo-label">
                        Saldo: ${selectedEntry.saldo}
                      </div>

                      <div className="card-section">
                        <div className="header" style={{ borderBottom: 'none', paddingBottom: 0, marginBottom: '1rem' }}>
                          <h3 className="section-title" style={{ margin: 0 }}>Pagos</h3>
                          {!isAddingPayment && (
                            <button 
                              className="btn-primary btn-small"
                              onClick={() => setIsAddingPayment(true)}
                            >
                              + Agregar Pago
                            </button>
                          )}
                        </div>

                        {isAddingPayment && (
                          <div className="add-payment-form">
                            <h4>{editingPaymentId ? 'Editar Pago' : 'Nuevo Pago'}</h4>
                            <div className="card-row">
                              <div className="input-group">
                                <label>Monto del pago $</label>
                                <input 
                                  type="number" 
                                  value={newPayment.monto}
                                  onChange={e => setNewPayment({...newPayment, monto: e.target.value})}
                                  autoFocus
                                />
                              </div>
                              <div className="input-group">
                                <label>Número de recibo</label>
                                <input 
                                  type="text" 
                                  value={newPayment.recibo}
                                  onChange={e => setNewPayment({...newPayment, recibo: e.target.value})}
                                />
                              </div>
                              <div className="input-group">
                                <label>Reporte de cobranza</label>
                                <input 
                                  type="text" 
                                  value={newPayment.reporteCobranza}
                                  onChange={e => setNewPayment({...newPayment, reporteCobranza: e.target.value})}
                                />
                              </div>
                              <div className="input-group">
                                <label>Método de pago</label>
                                <input 
                                  type="text" 
                                  value={newPayment.metodoPago}
                                  onChange={e => setNewPayment({...newPayment, metodoPago: e.target.value})}
                                  placeholder="Efectivo, Transferencia..."
                                />
                              </div>
                            </div>
                            <div className="modal-actions">
                              <button className="btn-cancel" onClick={() => {
                                setIsAddingPayment(false);
                                setEditingPaymentId(null);
                                setNewPayment({ monto: "", recibo: "", reporteCobranza: "", metodoPago: "" });
                              }}>
                                Cancelar
                              </button>
                              <button className="btn-primary" onClick={handleSavePayment}>
                                {editingPaymentId ? 'Actualizar Pago' : 'Confirmar Pago'}
                              </button>
                            </div>
                          </div>
                        )}

                        <div className="payment-list">
                          {selectedEntry.pagos && selectedEntry.pagos.length > 0 ? (
                            selectedEntry.pagos.map((pago) => (
                              <div 
                                key={pago.id} 
                                className="payment-card"
                                onClick={() => handleEditPaymentClick(pago)}
                                title="Click para editar"
                              >
                                <div className="payment-header">
                                  <span>{pago.fecha}</span>
                                  <span className="payment-amount">${pago.monto}</span>
                                </div>
                                <div className="payment-details">
                                  <div className="payment-detail-item">
                                    <strong>Recibo:</strong> {pago.recibo}
                                  </div>
                                  <div className="payment-detail-item">
                                    <strong>Reporte:</strong> {pago.reporteCobranza}
                                  </div>
                                  <div className="payment-detail-item">
                                    <strong>Método de pago:</strong> {pago.metodoPago}
                                  </div>
                                </div>
                                <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                  <button 
                                    className="btn-secondary btn-small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleInitiateUpload(pago.id);
                                    }}
                                  >
                                    {pago.evidencePath ? '📷 Ver/Cambiar Evidencia' : '📷 Subir Evidencia'}
                                  </button>
                                  {pago.evidencePath && <span style={{ color: 'green', fontSize: '0.8rem' }}>✓ Evidencia cargada</span>}
                                </div>
                              </div>
                            ))
                          ) : (
                            !isAddingPayment && <p className="placeholder-text">No hay pagos registrados</p>
                          )}
                        </div>
                      </div>

                      <div className="card-section">
                        <h3 className="section-title">Historial de cambios</h3>
                        <div className="placeholder-section">
                          Registro de actividad...
                        </div>
                      </div>
                      
                      <div className="modal-actions">
                        <button className="btn-cancel" onClick={() => setSelectedEntry(null)}>Cancelar</button>
                        <button className="btn-primary" onClick={handleUpdate}>Guardar</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      )}
    </Authenticator>
  );
}

