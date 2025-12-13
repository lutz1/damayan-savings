import React, { useEffect } from "react";
import { Box, Fade } from "@mui/material";
import { motion } from "framer-motion";

const Splashscreen = ({ open = false, logo, duration = 1800, onClose, overlayColor = "rgba(0,0,0,0.9)" }) => {
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
          bgcolor: overlayColor,
          px: 2,
        }}
      >
        <Box sx={{ textAlign: "center", color: "#fff" }}>
          {logo && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: [1, 1.18, 0.98, 1] }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            >
              <Box
                component="img"
                src={logo}
                alt="Company logo"
                sx={{
                  width: "auto",
                  maxWidth: { xs: "90vw", sm: "70vw", md: "60vw" },
                  maxHeight: { xs: "55vh", sm: "65vh", md: "75vh" },
                  height: "auto",
                  filter: "drop-shadow(0 6px 20px rgba(0,0,0,0.65))",
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
