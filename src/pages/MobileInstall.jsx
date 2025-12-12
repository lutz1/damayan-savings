import React, { useEffect, useState } from "react";
import { Box, Typography, Button, Paper } from "@mui/material";
import { useNavigate } from "react-router-dom";
import usePwaInstall from "../hooks/usePwaInstall";

const MobileInstall = () => {
  const navigate = useNavigate();
  const { isInstallable, promptInstall, markInstalled } = usePwaInstall();
  const [installed, setInstalled] = useState(false);


  useEffect(() => {
    if (installed) {
      // After install redirect to login
      const base = process.env.PUBLIC_URL || "";
      navigate(`${base}/login`);
    }
  }, [installed, navigate]);

  const handlePrompt = async () => {
    try {
      const choice = await promptInstall();
      if (choice && choice.outcome === "accepted") {
        setInstalled(true);
      }
    } catch (err) {
      console.error("Install prompt failed:", err);
    }
  };

  // iOS detection: beforeinstallprompt is not supported on iOS Safari.
  const isIos = typeof window !== "undefined" && /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
  const isInStandaloneMode =
    typeof window !== "undefined" && (window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch (err) {
      console.error("Copy failed", err);
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

        {isIos && !isInStandaloneMode ? (
          <>
            <Typography sx={{ mb: 2 }}>
              On iPhone/iPad the browser must be Safari to add the app to your Home Screen.
            </Typography>
            <Typography variant="body2" sx={{ textAlign: "left", mb: 2 }}>
              Steps: 1) Open this page in Safari. 2) Tap the Share button (box with up-arrow). 3) Choose "Add to Home Screen".
            </Typography>
            <Button variant="contained" color="primary" onClick={copyLink} sx={{ mb: 2 }}>
              Copy Link (Open in Safari)
            </Button>
            <Typography variant="body2" sx={{ color: "rgba(0,0,0,0.6)", mb: 1 }}>
              If you already opened in Safari and don't see the option, ensure your iOS is updated and that you're not in an embedded browser.
            </Typography>
          </>
        ) : isInstallable ? (
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

        <Button
          variant="outlined"
          onClick={() => {
            try {
              markInstalled();
            } catch (err) {}
            navigate("/login");
          }}
        >
          Continue without Installing
        </Button>
      </Paper>
    </Box>
  );
};

export default MobileInstall;
