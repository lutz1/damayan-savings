import React, { useState, useEffect } from "react";
import { AppBar, Toolbar, Button, Box, useMediaQuery } from "@mui/material";
import { Link } from "react-scroll";
import { motion } from "framer-motion";
import { useTheme } from "@mui/material/styles";

import tclcLogo from "../assets/tclc-logo1.png";
import damayanLogo from "../assets/damayan.png";

const sections = ["home", "about", "leadership", "stats", "contact"];

const Navbar = () => {
  const [elevate, setElevate] = useState(false);
  const [activeSection, setActiveSection] = useState("home");
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm")); // detect mobile

  useEffect(() => {
    const handleScroll = () => setElevate(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.div
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
    >
      <AppBar
        position="fixed"
        color="transparent"
        elevation={elevate ? 4 : 0}
        sx={{
          transition: "all 0.3s ease",
          backgroundColor: elevate
            ? "rgba(25, 118, 210, 0.95)"
            : "rgba(25, 118, 210, 0.55)",
          backdropFilter: "blur(12px)",
          zIndex: 1300,
        }}
      >
        <Toolbar
          sx={{
            py: elevate ? 0.5 : 1.5,
            transition: "0.3s",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* ✅ Logo section (hidden on mobile) */}
          {!isMobile && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                px: 2,
                py: 0.5,
                borderRadius: 3,
                backgroundColor: "rgba(255,255,255,0.15)",
                backdropFilter: "blur(10px)",
                cursor: "pointer",
              }}
            >
              <Box component="img" src={tclcLogo} alt="TCLC Logo" sx={{ height: 40 }} />
              <Box component="img" src={damayanLogo} alt="DAMAYAN Logo" sx={{ height: 40 }} />
            </Box>
          )}

          {/* ✅ Navigation Links (always horizontal, visible on all sizes) */}
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              alignItems: "center",
              gap: isMobile ? 0.3 : 1.5,
              width: isMobile ? "100%" : "auto",
            }}
          >
            {sections.map((section) => (
              <Link
                key={section}
                to={section}
                smooth={true}
                duration={600}
                offset={-70}
                spy={true}
                onSetActive={() => setActiveSection(section)}
              >
                <Button
                  sx={{
                    fontWeight: 600,
                    mx: isMobile ? 0.2 : 1.5,
                    px: isMobile ? 1 : 2,
                    py: isMobile ? 0.5 : 0.7,
                    fontSize: isMobile ? "0.75rem" : "0.9rem",
                    color: activeSection === section ? "#FFD700" : "#fff",
                    textShadow: "0px 0px 6px rgba(0,0,0,0.5)",
                    transition: "all 0.3s ease",
                    borderRadius: 2,
                    backgroundColor:
                      activeSection === section
                        ? "rgba(255,255,255,0.15)"
                        : "transparent",
                    "&:hover": {
                      color: "#FFD700",
                      backgroundColor: "rgba(255,255,255,0.25)",
                      transform: "scale(1.05)",
                    },
                  }}
                >
                  {section.toUpperCase()}
                </Button>
              </Link>
            ))}
          </Box>
        </Toolbar>
      </AppBar>
    </motion.div>
  );
};

export default Navbar;