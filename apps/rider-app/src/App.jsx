import { createFirebaseClients } from "../../../shared/firebase/firebaseClient";

const { app, db } = createFirebaseClients("RiderApp");

export default function App() {
  return (
    <main style={{ fontFamily: "Segoe UI, sans-serif", padding: 24 }}>
      <h1>Rider App</h1>
      <p>Uses the same Firebase project and Firestore database.</p>
      <p>Firebase App: {app.name}</p>
      <p>Firestore ready: {db ? "yes" : "no"}</p>
    </main>
  );
}
