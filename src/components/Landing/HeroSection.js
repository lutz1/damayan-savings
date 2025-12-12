import React, { useState, useEffect } from "react";
import { Box, Typography, Button, Stack, useMediaQuery } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import slideMobile from "../../assets/group.jpg";
import slide1 from "../../assets/herosec.png";


const slides = [
  { caption: "Empowering Families through Damayan Savings Program" },
  { caption: "Together, Building Financial Security and Compassion" },
  { caption: "TCLC – Lingap, Malasakit, at Kalinga sa Kapwa" },
  { caption: "Supporting Communities with Education and Health Initiatives" }
];

const glassmorphicStyle = {
  background: "rgba(255, 255, 255, 0.15)",
  backdropFilter: "blur(10px)",
  borderRadius: "12px",
  padding: "10px 10px",
};

const HeroSection = () => {
  const [index, setIndex] = useState(0);
  const navigate = useNavigate();
  const isInstalledSync = () => {
    try {
      const stored = localStorage.getItem("pwa_installed");
      if (stored === "true") return true;
    } catch (err) {}

    try {
      if (typeof window !== "undefined") {
        if (window.navigator && window.navigator.standalone === true) return true;
        if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return true;
      }
    } catch (err) {}

    return false;
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

const theme = useTheme();
const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <Box
      id="home"
      sx={{
        position: "relative",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        overflow: "hidden",
        color: "white",
        textAlign: "center",
      }}
    >
      {/* FIXED BACKGROUND */}
       <Box
        sx={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${isMobile ? slideMobile : slide1})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          zIndex: 0,
        }}
      />

      {/* DARK OVERLAY */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          background: "rgba(0, 0, 0, 0)",
          zIndex: 1,
        }}
      />
      
      {/* FOREGROUND CONTENT */}
      <Box sx={{ position: "relative", zIndex: 2, maxWidth: 900, px: 1 }}>
        {/* Title */}
        <motion.div
          key={`title`}
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2 }}
        >
          <Typography
            variant="h4"
            fontWeight={600}
            sx={{ textShadow: "2px 2px 10px rgba(0, 0, 0, 1)", mb: 3 }}
          >
            DAMAYAN: Lingap, Malasakit, at Kalinga sa Kapwa
          </Typography>
        </motion.div>

        {/* Subtitle */}
        <motion.div
          key={`subtitle`}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1 }}
        >
          <Box sx={glassmorphicStyle} display="inline-block" mb={4}>
            <Typography variant="h6" sx={{ opacity: 0.9 }}>
              Empowering communities through Trucapital Credit Lending Corporation
            </Typography>
          </Box>
        </motion.div>

        {/* ROTATING CAPTION TEXT ONLY */}
        <motion.div
          key={`caption-${index}`}
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 1 }}
        >
          <Box sx={{ ...glassmorphicStyle, mb: 20, maxWidth: "80%", margin: "0 auto" }}>
            <Typography variant="subtitle1" sx={{ fontStyle: "italic" }}>
              {slides[index].caption}
            </Typography>
          </Box>
        </motion.div>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2 }}
          whileHover={{ scale: 1.08 }}
        >
          <Button
            variant="contained"
            color="secondary"
            size="large"
            sx={{
              px: 5,
              py: 1.5,
              fontWeight: 700,
              borderRadius: 2,
              backgroundColor: "#FFD700",
              color: "#0d47a1",
              "&:hover": { backgroundColor: "#ffca28" },
              mt: 5,
            }}
            onClick={() => {
              if (isInstalledSync()) {
                navigate("/login");
              } else {
                navigate("/mobile-install");
              }
            }}
          >
            Apply for Damayan Savings
          </Button>
        </motion.div>

        {/* Indicators */}
        <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 8 }}>
          {slides.map((_, i) => (
            <Box
              key={i}
              onClick={() => setIndex(i)}
              sx={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                backgroundColor: i === index ? "#FFD700" : "rgba(255,255,255,0.6)",
                cursor: "pointer",
                transition: "0.3s",
              }}
            />
          ))}
        </Stack>
      </Box>
    </Box>
  );
};

export default HeroSection;