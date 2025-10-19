import React, { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import HeroSection from "../components/Landing/HeroSection";
import AboutSection from "../components/Landing/AboutSection";
import CeoSection from "../components/Landing/CeoSection";
import StatsSection from "../components/Landing/StatsSection";
import ContactSection from "../components/Landing/ContactSection";
import ChatBot from "../components/Landing/ChatBot";
import { Fab, Zoom } from "@mui/material";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";

const LandingPage = () => {
  const [showScroll, setShowScroll] = useState(false);

  // Show button after scrolling 300px
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScroll(true);
      } else {
        setShowScroll(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Smooth scroll to top
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <>
      <Navbar />
      <HeroSection />
      <AboutSection />
      <CeoSection />
      <StatsSection />
      <ContactSection />
      <ChatBot />

      {/* ✅ Floating Scroll-to-Top Button */}
      <Zoom in={showScroll}>
        <Fab
          color="primary"
          size="medium"
          onClick={scrollToTop}
          aria-label="scroll back to top"
          sx={{
            position: "fixed",
            bottom: 40,
            right: 40,
            zIndex: 1000,
            boxShadow: 4,
            transition: "transform 0.3s ease-in-out",
            "&:hover": {
              transform: "translateY(-5px)",
              backgroundColor: "#1565c0",
            },
          }}
        >
          <KeyboardArrowUpIcon />
        </Fab>
      </Zoom>
    </>
  );
};

export default LandingPage;