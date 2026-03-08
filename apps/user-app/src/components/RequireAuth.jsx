import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../lib/firebase";

export default function RequireAuth({ children }) {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthed(Boolean(user?.uid));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <main style={{ fontFamily: "Segoe UI, sans-serif", padding: 24 }}>
        <p style={{ color: "#37566d", margin: 0 }}>Checking account...</p>
      </main>
    );
  }

  if (!authed) {
    return <Navigate to="/login-required" replace state={{ from: location.pathname }} />;
  }

  return children;
}
