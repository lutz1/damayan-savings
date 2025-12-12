import React, { useEffect } from "react";
import { Box, Fade } from "@mui/material";
import { motion } from "framer-motion";

const Splashscreen = ({ open = false, logo, duration = 1800, onClose }) => {
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
          bgcolor: "rgba(0,0,0,0.9)",
          px: 2,
        }}
      >
        <Box sx={{ textAlign: "center", color: "#fff" }}>
          {logo && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: [1, 1.08, 0.98, 1] }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            >
              <Box
                component="img"
                src={logo}
                alt="Company logo"
                sx={{
                  // Use viewport-relative sizing so the logo appears large on small screens
                  width: { xs: "45vw", sm: "32vw", md: "28vw" },
                  maxWidth: 420,
                  minWidth: 140,
                  height: "auto",
                  mb: 2,
                  filter: "drop-shadow(0 6px 16px rgba(0,0,0,0.6))",
                  display: "block",
                  mx: "auto",
                }}
              />
            </motion.div>
          )}
        </Box>
      </Box>
    </Fade>
  );
};

export default Splashscreen;
