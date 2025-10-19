import React, { useEffect, useState, useRef } from "react";
import { Box, Typography, Grid, Paper } from "@mui/material";
import { motion, useAnimation, useMotionValue, useTransform } from "framer-motion";
import { useInView } from "react-intersection-observer";
import GroupIcon from "@mui/icons-material/Group";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import LocationOnIcon from "@mui/icons-material/LocationOn";

// Animated number component
const AnimatedNumber = ({ target, duration = 1500, trigger }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = parseInt(target.toString().replace(/,/g, ""), 10);
    const increment = end / (duration / 16.6);

    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16.6);

    return () => clearInterval(timer);
  }, [target, duration, trigger]);

  return (
    <Typography
      variant="h3"
      fontWeight={700}
      sx={{
        color: "#1976d2",
        fontSize: { xs: "2rem", sm: "2.5rem", md: "3rem" },
        transition: "all 0.3s ease",
      }}
    >
      {count.toLocaleString()}
    </Typography>
  );
};

const StatsSection = () => {
  const stats = [
    { label: "Total Members", value: 1482, icon: <GroupIcon sx={{ fontSize: 40, color: "#1976d2" }} /> },
    { label: "Active Loans", value: 237, icon: <AccountBalanceIcon sx={{ fontSize: 40, color: "#1976d2" }} /> },
    { label: "Partner Branches", value: 14, icon: <LocationOnIcon sx={{ fontSize: 40, color: "#1976d2" }} /> },
  ];

  const containerRef = useRef(null);
  const [trigger, setTrigger] = useState(0);
  const controls = useAnimation();
  const [inView] = useInView({ threshold: 0.3 });

  // Parallax motion value for scroll effect
  const scrollY = useMotionValue(0);
  const parallax = useTransform(scrollY, [0, 500], [0, -30]);

  useEffect(() => {
    const handleScroll = () => scrollY.set(window.scrollY);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [scrollY]);

  useEffect(() => {
    if (inView) {
      controls.start("visible");
      setTrigger(prev => prev + 1); // re-trigger number animation
    }
  }, [inView, controls]);

  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.25 } },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 50, rotateY: 20 },
    visible: { opacity: 1, y: 0, rotateY: 0, transition: { type: "spring", stiffness: 130 } },
    hover: { rotateY: 15, scale: 1.07, transition: { type: "spring", stiffness: 200 } },
    float: { y: [0, -10, 0, 10, 0], rotateY: [0, 5, -5, 5, 0], transition: { duration: 6, repeat: Infinity, ease: "easeInOut" } },
  };

  return (
    <Box
      id="stats"
      ref={containerRef}
      sx={{
        py: { xs: 8, md: 16 },
        background: "linear-gradient(135deg, #e6f0ff 0%, #ffffff 100%)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative floating shapes with parallax */}
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          style={{
            position: "absolute",
            width: 100 + i * 30,
            height: 100 + i * 30,
            borderRadius: "50%",
            backgroundColor: "#1976d2",
            opacity: 0.08 + i * 0.02,
            top: `${i * 20}%`,
            left: `${i * 15}%`,
            y: parallax,
          }}
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 30 + i * 10, repeat: Infinity, ease: "linear" }}
        />
      ))}

      {/* Section Title */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={controls}
        variants={{ visible: { opacity: 1, y: 0, transition: { duration: 0.8 } } }}
      >
        <Typography
          variant="h4"
          align="center"
          gutterBottom
          sx={{ fontWeight: 700, mb: 8, position: "relative", zIndex: 1 }}
        >
          Our Growing Community
        </Typography>
      </motion.div>

      {/* Stats Cards */}
      <motion.div variants={containerVariants} initial="hidden" animate={controls}>
        <Grid container justifyContent="center" spacing={6}>
          {stats.map((s, i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <motion.div variants={cardVariants} whileHover="hover" animate="float" style={{ perspective: 1200 }}>
                <Paper
                  elevation={12}
                  sx={{
                    p: { xs: 4, sm: 5 },
                    textAlign: "center",
                    borderRadius: 4,
                    cursor: "pointer",
                    background: "linear-gradient(145deg, #ffffff, #e6f0ff)",
                    position: "relative",
                    zIndex: 1,
                    boxShadow: "0 15px 40px rgba(0,0,0,0.08)",
                  }}
                >
                  <Box sx={{ mb: 2 }}>{s.icon}</Box>
                  <AnimatedNumber target={s.value} trigger={trigger} />
                  <Typography
                    color="text.secondary"
                    sx={{ mt: 1, fontSize: { xs: "1rem", sm: "1.1rem", md: "1.2rem" } }}
                  >
                    {s.label}
                  </Typography>
                </Paper>
              </motion.div>
            </Grid>
          ))}
        </Grid>
      </motion.div>
    </Box>
  );
};

export default StatsSection;