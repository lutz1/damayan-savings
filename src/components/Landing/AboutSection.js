import React from "react";
import { Box, Typography, Container, Grid, Paper, Divider } from "@mui/material";
import { motion } from "framer-motion";
import aboutbg from "../../assets/aboutbg.png";

const containerVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i = 1) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.2, duration: 0.6, ease: "easeOut" },
  }),
};

const AboutSection = () => {
  
  return (
    <Box
      id="about"
      sx={{
        py: { xs: 12, md: 16 },
        position: "relative",
        overflow: "hidden",
        
      }}
    >
    {/* Background Image */}
          <Box
            component="img"
            src={aboutbg}
            alt="About Us Background"
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: 0.80, // adjust opacity here
              zIndex: 0,
            }}
          />
      <Container maxWidth="lg" sx={{ position: "relative", zIndex: 2 }}>
        {/* Header */}
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={containerVariants}>
          <Typography variant="h3" align="center" fontWeight={700} gutterBottom sx={{ color: "#1976d2", mb: 2 }}>
            About DAMAYAN
          </Typography>
          <Typography
            align="center"
            sx={{ mb: 12, maxWidth: 800, mx: "auto", color: "text.secondary", fontSize: { xs: "1rem", md: "1.1rem" } }}
          >
            “Lingap, Malasakit, at Kalinga sa Kapwa” — Our mission is to foster financial empowerment and solidarity among communities through responsible lending and shared compassion, powered by <strong>Trucapital Credit Lending Corporation (TCLC)</strong>.
          </Typography>
        </motion.div>

        {/* Values Section */}
        <Grid container spacing={6} justifyContent="center" sx={{ mb: 12 }}>
          {[
            { title: "💚 Lingap", text: "Extending care and compassion to uplift those in need. Damayan Trucapital upholds Lingap by providing compassionate, accessible, and responsible financial assistance to individuals and communities. We aim to uplift lives through lending solutions rooted in understanding, dignity, and genuine concern for every borrower’s journey." },
            { title: "💛 Malasakit", text: "Promoting empathy and collective responsibility among all members. Malasakit guides our commitment to empathy and shared responsibility. At Damayan Trucapital, we foster a culture where every member—staff, partners, and clients—works together with integrity, fairness, and genuine care to support each other’s growth and financial well-being." },
            { title: "💙 Kalinga", text: "Creating sustainable support for lasting community growth. Through Kalinga, Damayan Trucapital champions sustainable financial empowerment. We invest in long-term support systems that strengthen communities, promote responsible borrowing, and open opportunities for stable and lasting progress." },
          ].map((item, idx) => (
            <Grid item xs={12} md={4} key={idx}>
              <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={containerVariants} custom={idx + 1}>
                <Paper
                  elevation={12}
                  sx={{
                    p: 5,
                    textAlign: "center",
                    borderRadius: 5,
                    background: "linear-gradient(145deg, #ffffff, #e6f0ff)",
                    boxShadow: "0 25px 60px rgba(0, 0, 0, 0.2)",
                  }}
                >
                  <Typography variant="h6" fontWeight={700} sx={{ color: "#1976d2", mb: 2 }}>
                    {item.title}
                  </Typography>
                  <Typography color="text.secondary">{item.text}</Typography>
                </Paper>
              </motion.div>
            </Grid>
          ))}
        </Grid>

        <Divider sx={{ mt: 12, mb: 4, width: "60%", mx: "auto" }} />

        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
          <Typography align="center" variant="h6" fontWeight={500} color="text.secondary" sx={{ mt: 2, fontStyle: "italic" }}>
            “TCLC believes in compassion, progress, and empowerment — because every Filipino deserves a chance to thrive.”
          </Typography>
        </motion.div>
      </Container>
    </Box>
  );
};

export default AboutSection;