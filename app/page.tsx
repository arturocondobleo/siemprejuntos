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

  const filteredEntries = entries.filter(e => 
    e.remision.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.notaVenta.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.factura.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
                  {filteredEntries.map((entry) => (
                    <div key={entry.id} className="cobranza-card">
                      <div className="card-row">
                        <div className="input-group">
                          <label>Número de remisión</label>
                          <input type="text" value={entry.remision} readOnly />
                        </div>
                        <div className="input-group">
                          <label>Nota de venta</label>
                          <input type="text" value={entry.notaVenta} readOnly />
                        </div>
                        <div className="input-group">
                          <label>Factura</label>
                          <input type="text" value={entry.factura} readOnly />
                        </div>
                        <div className="input-group">
                          <label>Total de la nota $</label>
                          <input type="text" value={entry.total} readOnly />
                        </div>
                      </div>
                      
                      <div className="saldo-label">
                        Saldo: ${entry.saldo}
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
                    </div>
                  ))}
                  {filteredEntries.length === 0 && (
                    <p style={{ textAlign: 'center', color: '#888' }}>No hay registros</p>
                  )}
                </div>

                <button className="fab-add" onClick={() => setShowModal(true)}>
                  +
                </button>

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
              </div>
            </div>
          )}
        </main>
      )}
    </Authenticator>
  );
}

