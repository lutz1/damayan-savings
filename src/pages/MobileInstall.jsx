import React, { useEffect, useState } from "react";
import { Box, Typography, Button, Paper } from "@mui/material";
import { useNavigate } from "react-router-dom";

const MobileInstall = () => {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const beforeHandler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    const installedHandler = () => {
      setInstalled(true);
      try {
        localStorage.setItem("pwa_installed", "true");
      } catch (err) {}
    };

    window.addEventListener("beforeinstallprompt", beforeHandler);
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", beforeHandler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  useEffect(() => {
    if (installed) {
      // After install redirect to login
      const base = process.env.PUBLIC_URL || "";
      navigate(`${base}/login`);
    }
  }, [installed, navigate]);

  const handlePrompt = async () => {
    if (!deferredPrompt) return;
    try {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice && choice.outcome === "accepted") {
        try {
          localStorage.setItem("pwa_installed", "true");
        } catch (err) {}
        setInstalled(true);
      }
    } catch (err) {
      console.error("Install prompt failed:", err);
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", p: 2, bgcolor: "#f5f5f5" }}>
      <Paper sx={{ p: 3, maxWidth: 520, textAlign: "center" }} elevation={6}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 700 }}>
          Install App to Continue
        </Typography>
        <Typography sx={{ mb: 2, color: "rgba(0,0,0,0.7)" }}>
          For the best experience on mobile devices, please install the Damayan app to your device.
        </Typography>

        {isInstallable ? (
          <Button variant="contained" color="primary" onClick={handlePrompt} sx={{ mb: 2 }}>
            Install App
          </Button>
        ) : (
          <Button variant="contained" color="primary" onClick={() => window.location.reload()} sx={{ mb: 2 }}>
            Check Install Availability
          </Button>
        )}

        <Typography variant="body2" sx={{ color: "rgba(0,0,0,0.6)", mb: 1 }}>
          If the install prompt doesn't appear, open your browser menu and select "Install app" (or "Add to Home screen").
        </Typography>

        <Button variant="outlined" onClick={() => navigate("/login")}>Continue without Installing</Button>
      </Paper>
    </Box>
  );
};

export default MobileInstall;
