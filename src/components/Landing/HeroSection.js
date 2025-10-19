import React, { useState, useEffect, useRef } from "react";
import { Box, Typography, Button, Stack } from "@mui/material";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";

import slide1 from "../../assets/slide1.jpg";
import slide2 from "../../assets/slide2.jpg";
import slide3 from "../../assets/slide3.jpg";
import slide4 from "../../assets/slide4.jpg";
import slide5 from "../../assets/slide5.jpg";
import slide6 from "../../assets/slide6.jpg";
import slide7 from "../../assets/slide7.jpg";
import slide8 from "../../assets/slide8.jpg";
import slide9 from "../../assets/slide9.jpg";
import slide10 from "../../assets/slide10.jpg";

const slides = [
  { image: slide1, caption: "Empowering Families through Damayan Savings Program" },
  { image: slide2, caption: "Together, Building Financial Security and Compassion" },
  { image: slide3, caption: "TCLC – Lingap, Malasakit, at Kalinga sa Kapwa" },
  { image: slide4, caption: "Supporting Communities with Education and Health Initiatives" },
  { image: slide5, caption: "Bridging Financial Gaps for the Underprivileged" },
  { image: slide6, caption: "Creating Sustainable Livelihood Programs" },
  { image: slide7, caption: "Uniting People through Acts of Kindness" },
  { image: slide8, caption: "Investing in Local Community Growth" },
  { image: slide9, caption: "Empowering Women and Youth for a Brighter Future" },
  { image: slide10, caption: "Join Damayan: Building a Compassionate Society Together" },
];

const glassmorphicStyle = {
  background: "rgba(255, 255, 255, 0.15)",
  backdropFilter: "blur(10px)",
  borderRadius: "12px",
  padding: "16px 24px",
};

const HeroSection = () => {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const slideContainerRef = useRef(null);
  const navigate = useNavigate(); // ✅ for redirect

  // Automatic slide transition
  useEffect(() => {
    const timer = setInterval(() => {
      setDirection(1);
      setIndex((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

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
      {/* Background slideshow */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          ref={slideContainerRef}
          style={{
            display: "flex",
            width: `${(slides.length + 1) * 100}%`,
            position: "absolute",
            top: 0,
            left: 0,
            height: "100vh",
          }}
          animate={{ x: `-${(index * 100) / (slides.length + 1)}%` }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
          onAnimationComplete={() => {
            if (index === slides.length) setIndex(0);
          }}
        >
          {[...slides, slides[0]].map((slide, i) => (
            <Box
              key={i}
              sx={{
                flex: `0 0 ${100 / (slides.length + 1)}%`,
                height: "100vh",
                backgroundImage: `url(${slide.image})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
          ))}
        </motion.div>
      </AnimatePresence>

      {/* Gradient overlay */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(to bottom, rgba(0,0,0,0.4), rgba(25,118,210,0.3))",
          zIndex: 1,
        }}
      />

      {/* Foreground content */}
      <Box sx={{ position: "relative", zIndex: 2, maxWidth: 900, px: 2, mt: 10 }}>
        {/* Main Title */}
        <motion.div
          key={`title-${index}`}
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
        >
          <Typography
            variant="h3"
            fontWeight={700}
            sx={{ textShadow: "2px 2px 10px rgba(0,0,0,0.6)", mb: 5 }}
          >
            DAMAYAN: Lingap, Malasakit, at Kalinga sa Kapwa
          </Typography>
        </motion.div>

        {/* Subtitle */}
        <motion.div
          key={`subtitle-${index}`}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 50 }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.5 }}
        >
          <Box sx={glassmorphicStyle} display="inline-block" mb={4}>
            <Typography variant="h6" sx={{ opacity: 0.9 }}>
              Empowering communities through Trucapital Credit Lending Corporation
            </Typography>
          </Box>
        </motion.div>

        {/* Caption */}
        <motion.div
          key={`caption-${index}`}
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 1, ease: "easeOut", delay: 0.8 }}
        >
          <Box sx={{ ...glassmorphicStyle, mb: 20, maxWidth: "80%", margin: "0 auto" }}>
            <Typography variant="subtitle1" sx={{ fontStyle: "italic" }}>
              {slides[index].caption}
            </Typography>
          </Box>
        </motion.div>

        {/* Call to Action Button */}
        <motion.div
          key={`button-${index}`}
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          transition={{ duration: 1.2, ease: "easeOut", delay: 1.1 }}
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
            onClick={() => navigate("/login")} // ✅ redirect to login
          >
            Apply for Damayan Savings
          </Button>
        </motion.div>

        {/* Slide Indicators */}
        <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 8 }}>
          {slides.map((_, i) => (
            <Box
              key={i}
              onClick={() => {
                setDirection(i > index ? 1 : -1);
                setIndex(i);
              }}
              sx={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                backgroundColor: i === index ? "#FFD700" : "rgba(255,255,255,0.6)",
                cursor: "pointer",
                transition: "background-color 0.3s",
              }}
            />
          ))}
        </Stack>
      </Box>
    </Box>
  );
};

export default HeroSection;