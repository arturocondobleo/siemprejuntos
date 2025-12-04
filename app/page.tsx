"use client";

import { useState, useEffect } from "react";
import { Amplify } from "aws-amplify";
import outputs from "@/amplify_outputs.json";
import { Authenticator } from "@aws-amplify/ui-react";
import { generateClient } from "aws-amplify/data";
import { uploadData, getUrl, remove } from "aws-amplify/storage";
import { QRCodeSVG } from "qrcode.react";
import type { Schema } from "@/amplify/data/resource";
import "@aws-amplify/ui-react/styles.css";
import "./../app/app.css";

Amplify.configure(outputs);

const client = generateClient<Schema>();

interface Payment {
  id?: string;
  monto: string;
  recibo: string;
  reporteCobranza: string;
  metodoPago: string;
  fecha: string;
  evidencePaths?: string[];
  createdAt?: string;
  updatedAt?: string;
}

interface CobranzaEntry {
  id?: string;
  remision: string;
  notaVenta: string;
  factura: string;
  total: string;
  saldo: string;
  pagos: Payment[];
  createdAt?: string;
  updatedAt?: string;
}

const EvidenceThumbnail = ({ path, onDelete }: { path: string, onDelete: () => void }) => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    getUrl({ path }).then(res => setUrl(res.url.toString())).catch(console.error);
  }, [path]);

  if (!url) return <div style={{ width: '50px', height: '50px', background: '#eee', borderRadius: '4px' }} />;

  return (
    <div style={{ position: 'relative', width: '50px', height: '50px', border: '1px solid #ddd', borderRadius: '4px', overflow: 'hidden' }}>
      <a href={url} target="_blank" rel="noopener noreferrer">
        <img src={url} alt="Evidencia" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </a>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDelete();
        }}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          background: 'rgba(255,0,0,0.7)',
          color: 'white',
          border: 'none',
          width: '15px',
          height: '15px',
          fontSize: '10px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        ×
      </button>
    </div>
  );
};

export default function App() {
  const [view, setView] = useState<"dashboard" | "cobranza">("dashboard");
  const [entries, setEntries] = useState<CobranzaEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<CobranzaEntry | null>(null);
  
  // Estado para nuevo pago
  const [isAddingPayment, setIsAddingPayment] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  
  // Estado para subida de evidencia
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadSessionId, setUploadSessionId] = useState<string | null>(null);
  const [uploadPaymentId, setUploadPaymentId] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState("");
  
  const [newPayment, setNewPayment] = useState<{
    monto: string;
    recibo: string;
    reporteCobranza: string;
    metodoPago: string;
    evidencePaths: string[];
  }>({
    monto: "",
    recibo: "",
    reporteCobranza: "",
    metodoPago: "",
    evidencePaths: []
  });

  useEffect(() => {
    const sub = client.models.Cobranza.observeQuery().subscribe({
      next: ({ items }) => {
        const mapped = items.map(item => ({
          id: item.id,
          remision: item.remision ?? "",
          notaVenta: item.notaVenta ?? "",
          factura: item.factura ?? "",
          total: item.total ?? "",
          saldo: item.saldo ?? "",
          pagos: [], // Placeholder, loaded on select
          createdAt: item.createdAt,
          updatedAt: item.updatedAt
        }));
        setEntries(mapped.sort((a, b) => Number(b.remision) - Number(a.remision)));
      }
    });
    return () => sub.unsubscribe();
  }, []);

  const handleCreateNew = () => {
    const newEntry: CobranzaEntry = {
      remision: "",
      notaVenta: "",
      factura: "",
      total: "",
      saldo: "",
      pagos: []
    };
    setSelectedEntry(newEntry);
  };

  const handleSelectEntry = async (entry: CobranzaEntry) => {
    if (entry.id) {
      const { data: payments } = await client.models.Payment.list({
        filter: { cobranzaId: { eq: entry.id } }
      });
      
      setSelectedEntry({
        ...entry,
        pagos: payments.map(p => ({
          id: p.id,
          monto: p.monto ?? "",
          recibo: p.recibo ?? "",
          reporteCobranza: p.reporteCobranza ?? "",
          metodoPago: p.metodoPago ?? "",
          fecha: p.fecha ?? "",
          evidencePaths: p.evidencePaths ? p.evidencePaths.filter((x): x is string => x !== null) : [],
          createdAt: p.createdAt,
          updatedAt: p.updatedAt
        }))
      });
    } else {
      setSelectedEntry(entry);
    }
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
        id: `temp-${Date.now()}`, // Temp ID
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
    setNewPayment({ monto: "", recibo: "", reporteCobranza: "", metodoPago: "", evidencePaths: [] });
  };

  const handleEditPaymentClick = (payment: Payment) => {
    setNewPayment({
      monto: payment.monto,
      recibo: payment.recibo,
      reporteCobranza: payment.reporteCobranza,
      metodoPago: payment.metodoPago,
      evidencePaths: payment.evidencePaths || []
    });
    setEditingPaymentId(payment.id || null);
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
    // Si estamos editando/creando un pago en el formulario, actualizamos el estado local del formulario
    if (paymentId === "NEW_PAYMENT" || paymentId === editingPaymentId) {
      setNewPayment(prev => ({
        ...prev,
        evidencePaths: [...prev.evidencePaths, path]
      }));
    }

    // Si estamos editando un pago existente, TAMBIÉN actualizamos la lista principal
    if (selectedEntry && paymentId !== "NEW_PAYMENT") {
      const updatedPayments = selectedEntry.pagos.map(p => {
        if (p.id === paymentId) {
          const currentPaths = p.evidencePaths || [];
          return { ...p, evidencePaths: [...currentPaths, path] };
        }
        return p;
      });

      setSelectedEntry({
        ...selectedEntry,
        pagos: updatedPayments
      });
    }
  };

  const handleDeleteEvidence = async (paymentId: string, pathToDelete: string) => {
    try {
      await remove({ path: pathToDelete });
      
      // Si estamos en el formulario, actualizamos el estado local
      if (paymentId === "NEW_PAYMENT" || paymentId === editingPaymentId) {
        setNewPayment(prev => ({
          ...prev,
          evidencePaths: prev.evidencePaths.filter(p => p !== pathToDelete)
        }));
      }

      // Si es un pago existente, actualizamos la lista principal
      if (selectedEntry && paymentId !== "NEW_PAYMENT") {
        const updatedPayments = selectedEntry.pagos.map(p => {
          if (p.id === paymentId) {
            return { 
              ...p, 
              evidencePaths: (p.evidencePaths || []).filter(path => path !== pathToDelete) 
            };
          }
          return p;
        });

        setSelectedEntry({
          ...selectedEntry,
          pagos: updatedPayments
        });
      }
    } catch (error) {
      console.error("Error deleting evidence:", error);
      alert("Error al eliminar la evidencia");
    }
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

  const handleUpdate = async () => {
    if (!selectedEntry) return;

    try {
      let cobranzaId = selectedEntry.id;

      if (!cobranzaId) {
        // Create
        const { data, errors } = await client.models.Cobranza.create({
          remision: selectedEntry.remision,
          notaVenta: selectedEntry.notaVenta,
          factura: selectedEntry.factura,
          total: selectedEntry.total,
          saldo: selectedEntry.saldo,
        });
        if (errors) throw new Error(errors[0].message);
        if (!data) throw new Error("Error creating Cobranza");
        cobranzaId = data.id;
      } else {
        // Update
        const { errors } = await client.models.Cobranza.update({
          id: cobranzaId,
          remision: selectedEntry.remision,
          notaVenta: selectedEntry.notaVenta,
          factura: selectedEntry.factura,
          total: selectedEntry.total,
          saldo: selectedEntry.saldo,
        });
        if (errors) throw new Error(errors[0].message);
      }

      // Handle Payments
      if (selectedEntry.pagos) {
        for (const p of selectedEntry.pagos) {
           const paymentData = {
             monto: p.monto,
             recibo: p.recibo,
             reporteCobranza: p.reporteCobranza,
             metodoPago: p.metodoPago,
             fecha: p.fecha,
             evidencePaths: p.evidencePaths ? p.evidencePaths.filter((x): x is string => x !== null) : [],
             cobranzaId: cobranzaId
           };

           if (!p.id || p.id.startsWith('temp-')) {
             await client.models.Payment.create(paymentData);
           } else {
             await client.models.Payment.update({
               id: p.id,
               ...paymentData
             });
           }
        }
      }

      setSelectedEntry(null);
    } catch (e) {
      console.error("Error saving:", e);
      alert("Error al guardar");
    }
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
          onClick={() => handleSelectEntry(entry)}
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
          onClick={() => handleSelectEntry(entry)}
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

                <button className="fab-add" onClick={handleCreateNew}>
                  +
                </button>

                {/* Modal de Subida de Evidencia */}
                {showUploadModal && (
                  <div className="modal-overlay" style={{ zIndex: 1100 }}>
                    <div className="modal" style={{ maxWidth: '400px', textAlign: 'center' }}>
                      <h3>Subir Evidencia</h3>
                      <p>Escanea el código QR con tu celular para subir la foto.</p>
                      
                      <div style={{ margin: '2rem 0' }}>
                        <div style={{ background: 'white', padding: '1rem', display: 'inline-block', border: '1px solid #ddd', borderRadius: '8px' }}>
                          {qrUrl && <QRCodeSVG value={qrUrl} size={200} />}
                        </div>
                        <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.5rem' }}>
                          La página se actualizará automáticamente cuando subas la foto.
                        </p>
                      </div>

                      <div style={{ marginBottom: '1rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
                         <label className="btn-secondary" style={{ display: 'inline-block', cursor: 'pointer', padding: '0.5rem 1rem', width: '100%', boxSizing: 'border-box' }}>
                            Subir sin usar QR
                            <input 
                              type="file" 
                              accept="image/*"
                              onChange={handleManualUpload}
                              style={{ display: 'none' }}
                            />
                         </label>
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

                            <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                              <button 
                                className="btn-secondary"
                                style={{ 
                                  background: '#f0f0f0', 
                                  border: '1px solid #ccc', 
                                  padding: '0.5rem 1rem', 
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                  height: '50px'
                                }}
                                onClick={(e) => {
                                  e.preventDefault();
                                  // Usamos "NEW_PAYMENT" si estamos creando uno nuevo, o el ID si estamos editando
                                  handleInitiateUpload(editingPaymentId || "NEW_PAYMENT");
                                }}
                              >
                                <span>📷</span> Subir evidencia
                              </button>

                              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {newPayment.evidencePaths.map((path, index) => (
                                  <EvidenceThumbnail 
                                    key={index} 
                                    path={path} 
                                    onDelete={() => handleDeleteEvidence(editingPaymentId || "NEW_PAYMENT", path)} 
                                  />
                                ))}
                              </div>
                            </div>

                            <div className="modal-actions">
                              <button className="btn-cancel" onClick={() => {
                                setIsAddingPayment(false);
                                setEditingPaymentId(null);
                                setNewPayment({ monto: "", recibo: "", reporteCobranza: "", metodoPago: "", evidencePaths: [] });
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
                                {pago.evidencePaths && pago.evidencePaths.length > 0 && (
                                  <div style={{ marginTop: '0.5rem' }}>
                                    <span style={{ color: 'green', fontSize: '0.8rem' }}>✓ {pago.evidencePaths.length} Evidencia(s) cargada(s)</span>
                                  </div>
                                )}
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

