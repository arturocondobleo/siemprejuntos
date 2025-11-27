"use client";

import { useState } from "react";
import { Amplify } from "aws-amplify";
import outputs from "@/amplify_outputs.json";
import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import "./../app/app.css";

Amplify.configure(outputs);

export default function App() {
  const [view, setView] = useState<"dashboard" | "cobranza">("dashboard");

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
                <div style={{ width: '100px' }}></div> {/* Spacer for alignment */}
              </header>
              
              <div className="content-area">
                <p className="placeholder-text">Módulo de Cobranza en construcción...</p>
              </div>
            </div>
          )}
        </main>
      )}
    </Authenticator>
  );
}

