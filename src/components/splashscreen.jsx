import React, { useEffect, useRef } from "react";
import { Box, Fade } from "@mui/material";
import { motion } from "framer-motion";
import merchantVideo from "../assets/merchant.mp4";

const Splashscreen = ({ open = false, logo, duration = 1800, onClose, overlayColor = "rgba(0,0,0,0.9)" }) => {
  const videoRef = useRef(null);

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

  return (
    <Fade in={open} timeout={500} unmountOnExit>
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
          px: 2,
        }}
      >
        <Box sx={{ textAlign: "center", color: "#fff", width: "100%", display: "flex", justifyContent: "center" }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: [1, 1.08, 0.98, 1] }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            style={{
              width: "100%",
              maxWidth: "min(90vw, 800px)",
              display: "flex",
              justifyContent: "center",
            }}
          >
            <Box
              ref={videoRef}
              component="video"
              autoPlay
              loop
              muted
              playsInline
              sx={{
                width: "100%",
                maxWidth: { xs: "90vw", sm: "70vw", md: "60vw" },
                maxHeight: { xs: "55vh", sm: "65vh", md: "75vh" },
                height: "auto",
                filter: "drop-shadow(0 6px 20px rgba(0,0,0,0.65))",
                display: "block",
                borderRadius: "12px",
                objectFit: "contain",
              }}
            >
              <source src={merchantVideo} type="video/mp4" />
            </Box>
          </motion.div>
        </Box>
      </Box>
    </Fade>
  );
};

export default Splashscreen;
