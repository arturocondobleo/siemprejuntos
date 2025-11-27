"use client";

import { Amplify } from "aws-amplify";
import outputs from "@/amplify_outputs.json";
import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import "./../app/app.css";

Amplify.configure(outputs);

export default function App() {
  return (
    <Authenticator>
      {({ signOut, user }) => (
        <main>
          <h1>Dashboard</h1>
          <p>Bienvenido, {user?.signInDetails?.loginId}</p>
          <button onClick={signOut}>Cerrar sesión</button>
        </main>
      )}
    </Authenticator>
  );
}

