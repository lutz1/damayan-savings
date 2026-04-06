import React, { useEffect, useRef } from "react";
import { Box } from "@mui/material";
import { motion } from "framer-motion";
import bownersVideo from "../assets/bowners.mp4";
import bownersBg from "../assets/bownersbg.png";

const Splashscreen = ({ open = false, logo, duration = 1800, onClose, overlayColor = "rgba(0,0,0,0.9)" }) => {
  const videoRef = useRef(null);

  const handleVideoEnded = () => {
    if (typeof onClose === "function") onClose();
  };

  useEffect(() => {
    if (!open) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    let timer;
    if (duration > 0) {
      timer = setTimeout(() => {
        if (typeof onClose === "function") onClose();
      }, duration);
    }

    return () => {
      if (timer) clearTimeout(timer);
      document.body.style.overflow = prev || "";
    };
  }, [open, duration, onClose]);

  useEffect(() => {
    if (open && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [open]);

  if (!open) return null;

  return (
    <Box
      role="dialog"
      aria-modal="true"
      aria-label="Launching application"
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: overlayColor,
        px: { xs: 0, sm: 2 },
        overflow: "hidden",
      }}
    >
      <Box sx={{ textAlign: "center", color: "#fff", width: "100%", display: "flex", justifyContent: "center" }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: [1, 1.08, 0.98, 1] }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          style={{
            width: "100%",
            maxWidth: "min(100vw, 800px)",
            display: "flex",
            justifyContent: "center",
            position: "relative",
          }}
        >
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${bownersBg})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: "blur(18px)",
              transform: "scale(1.08)",
              opacity: 0.45,
              display: { xs: "block", sm: "none" },
            }}
          />
          <Box
            ref={videoRef}
            component="video"
            autoPlay
            loop={false}
            muted
            playsInline
            onEnded={handleVideoEnded}
            sx={{
              width: { xs: "100vw", sm: "100%" },
              height: { xs: "100dvh", sm: "auto" },
              maxWidth: { xs: "100vw", sm: "70vw", md: "60vw" },
              maxHeight: { xs: "100dvh", sm: "65vh", md: "75vh" },
              filter: "drop-shadow(0 6px 20px rgba(0,0,0,0.65))",
              display: "block",
              borderRadius: { xs: 0, sm: "12px" },
              objectFit: "contain",
              objectPosition: "center",
              position: "relative",
              zIndex: 1,
            }}
          >
            <source src={bownersVideo} type="video/mp4" />
          </Box>
        </motion.div>
      </Box>
    </Box>
  );
};

export default Splashscreen;
