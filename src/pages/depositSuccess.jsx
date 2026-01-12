import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Box, Typography, CircularProgress, Card, CardContent, Button } from "@mui/material";
import { CheckCircle, ErrorOutline } from "@mui/icons-material";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import bgImage from "../assets/bg.jpg";

const DepositSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const auth = getAuth();

  useEffect(() => {
    const verifyPayment = async () => {
      try {
        // Try to get session_id from URL first, fallback to sessionStorage
        let sessionId = searchParams.get("session_id");
        
        if (!sessionId || sessionId === "{session_id}") {
          // PayMongo didn't pass session_id, try sessionStorage
          sessionId = sessionStorage.getItem("paymongo_checkout_id");
          console.log("[depositSuccess] Using stored checkoutId:", sessionId);
        } else {
          console.log("[depositSuccess] Using URL session_id:", sessionId);
        }

        if (!sessionId) {
          console.error("[depositSuccess] ❌ No payment session found");
          setStatus("error");
          setMessage("No payment session found. Please try again.");
          return;
        }

        console.log("[depositSuccess] 🔄 Starting payment verification with sessionId:", sessionId);

        // Wait for auth state to load - wrap in Promise
        const user = await new Promise((resolve) => {
          const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            console.log("[depositSuccess] Auth state changed. User:", currentUser?.uid || "null");
            unsubscribe();
            resolve(currentUser);
          });
        });

        if (!user) {
          console.error("[depositSuccess] ❌ No authenticated user found");
          setStatus("error");
          setMessage("Session expired. Please log in again and retry your deposit.");
          return;
        }

        console.log("[depositSuccess] ✅ User authenticated:", user.uid);

        // Get ID token to verify payment on backend
        const idToken = await user.getIdToken();
        const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

        console.log("[depositSuccess] 📤 Calling verification endpoint:", `${API_BASE}/api/verify-paymongo-payment`);

        // Call backend to verify and create deposit
        const response = await fetch(`${API_BASE}/api/verify-paymongo-payment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idToken,
            sessionId,
          }),
        });

        const result = await response.json();
        console.log("[depositSuccess] 📥 Verification response:", { status: response.status, result });

        if (response.ok) {
          setStatus("success");
          setMessage("Payment received! Your deposit is awaiting admin approval. You will be notified once it's confirmed.");
          console.log("[depositSuccess] ✅ Payment verified successfully");
          // Redirect to member dashboard after 3 seconds
          setTimeout(() => navigate("/member/dashboard"), 3000);
        } else {
          setStatus("error");
          const errorMsg = result.error || "Payment verification failed. Please contact support.";
          console.error("[depositSuccess] ❌ Verification failed:", errorMsg);
          setMessage(errorMsg);
        }
      } catch (err) {
        console.error("[depositSuccess] ❌ Error:", err);
        setStatus("error");
        setMessage("An error occurred. Please refresh and try again.");
      }
    };

    verifyPayment();
  }, [searchParams, auth, navigate]);

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        backgroundImage: `url(${bgImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        position: "relative",
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.4)",
          zIndex: 0,
        },
      }}
    >
      <Card
        sx={{
          maxWidth: 400,
          width: "90%",
          zIndex: 1,
          background: "rgba(30,30,30,0.95)",
          backdropFilter: "blur(20px)",
          color: "#fff",
          textAlign: "center",
          p: 3,
        }}
      >
        <CardContent>
          {status === "loading" && (
            <>
              <CircularProgress sx={{ color: "#81C784", mb: 2 }} />
              <Typography variant="h6">Verifying Payment...</Typography>
              <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.7)", mt: 1 }}>
                Please wait while we confirm your deposit.
              </Typography>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle sx={{ fontSize: 60, color: "#4CAF50", mb: 2 }} />
              <Typography variant="h6" sx={{ color: "#4CAF50", fontWeight: 600 }}>
                Payment Successful!
              </Typography>
              <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.7)", mt: 2 }}>
                {message}
              </Typography>
              <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)", mt: 2, display: "block" }}>
                Redirecting to dashboard...
              </Typography>
            </>
          )}

          {status === "error" && (
            <>
              <ErrorOutline sx={{ fontSize: 60, color: "#FF6B6B", mb: 2 }} />
              <Typography variant="h6" sx={{ color: "#FF6B6B", fontWeight: 600 }}>
                Payment Error
              </Typography>
              <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.7)", mt: 2, mb: 2 }}>
                {message}
              </Typography>
              <Button
                variant="contained"
                sx={{
                  bgcolor: "#81C784",
                  color: "#000",
                  fontWeight: 600,
                  "&:hover": { bgcolor: "#66BB6A" },
                }}
                onClick={() => navigate("/member/dashboard")}
              >
                Go to Dashboard
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default DepositSuccess;
