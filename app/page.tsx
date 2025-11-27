"use client";

import { useState } from "react";
import { Amplify } from "aws-amplify";
import outputs from "@/amplify_outputs.json";
import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import "./../app/app.css";

Amplify.configure(outputs);

interface CobranzaEntry {
  id: string;
  remision: string;
  notaVenta: string;
  factura: string;
  total: string;
  saldo: string;
}

export default function App() {
  const [view, setView] = useState<"dashboard" | "cobranza">("dashboard");
  const [entries, setEntries] = useState<CobranzaEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<CobranzaEntry | null>(null);
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
      saldo: newEntryData.total
    };
    
    setEntries(prev => {
      const newEntries = [...prev, entry];
      return newEntries.sort((a, b) => Number(b.remision) - Number(a.remision));
    });
    
    setShowModal(false);
    setNewEntryData({ remision: "", notaVenta: "", factura: "", total: "" });
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
                        <h3 className="section-title">Pagos</h3>
                        <div className="placeholder-section">
                          Próximamente...
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

