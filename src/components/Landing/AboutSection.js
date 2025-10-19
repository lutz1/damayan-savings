import React from "react";
import { Box, Typography, Container, Grid, Paper, Divider } from "@mui/material";
import { motion } from "framer-motion";
import tclcLogo from "../../assets/tclc-logo1.png";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import DescriptionIcon from "@mui/icons-material/Description";
import SavingsIcon from "@mui/icons-material/Savings";
// Background images
import bg1 from "../../assets/certificate.jpg";
import bg2 from "../../assets/damayan.png";
import bg3 from "../../assets/cert.jpg";

const containerVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i = 1) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.2, duration: 0.6, ease: "easeOut" },
  }),
};

const AboutSection = () => {
  const floatingIcons = [
    { icon: <AttachMoneyIcon sx={{ fontSize: 60, color: "#FFD700" }} />, top: 10, left: 75 },
    { icon: <DescriptionIcon sx={{ fontSize: 50, color: "#1976d2" }} />, top: 40, left: 15 },
    { icon: <SavingsIcon sx={{ fontSize: 70, color: "#43A047" }} />, top: 70, left: 65 },
  ];

  const backgroundObjects = [
    { src: bg1, top: 10, left: 5, size: 120, rotateSpeed: 60 },
    { src: bg2, top: 50, left: 80, size: 150, rotateSpeed: 80 },
    { src: bg3, top: 30, left: 50, size: 100, rotateSpeed: 70 },
  ];

  // Section content blocks for alternating layout
  const contentBlocks = [
    {
      title: "Trucapital Credit Lending Corporation (TCLC)",
      image: tclcLogo,
      description: (
        <>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            <strong>SEC Registration Number:</strong> 2021012345 <br />
            <strong>Certificate of Authority to Operate:</strong> No. 3430
          </Typography>
          <Typography sx={{ color: "text.secondary", lineHeight: 1.7 }}>
            Trucapital Credit Lending Corporation (TCLC) is a trusted financial institution committed to uplifting Filipino families through accessible and responsible credit programs. With integrity, service, and innovation, TCLC empowers communities to achieve financial independence.
          </Typography>
        </>
      ),
    },
    {
      title: "Vision",
      image: null,
      description: (
        <Paper
          elevation={12}
          sx={{
            p: 4,
            borderLeft: "6px solid #1976d2",
            borderRadius: 4,
            background: "#E3F2FD",
            boxShadow: "0 20px 50px rgba(0,0,0,0.1)",
          }}
        >
          <Typography variant="h6" fontWeight={700} color="primary.main" gutterBottom>
            Vision
          </Typography>
          <Typography color="text.secondary">Empowered members living financially free.</Typography>
        </Paper>
      ),
    },
    {
      title: "Mission",
      image: null,
      description: (
        <Paper
          elevation={12}
          sx={{
            p: 4,
            borderLeft: "6px solid #43A047",
            borderRadius: 4,
            background: "#E8F5E9",
            boxShadow: "0 20px 50px rgba(0,0,0,0.1)",
          }}
        >
          <Typography variant="h6" fontWeight={700} color="success.main" gutterBottom>
            Mission
          </Typography>
          <Typography color="text.secondary">
            Providing excellent financial assistance and allied services that uplift every Filipino family’s well-being and financial security.
          </Typography>
        </Paper>
      ),
    },
  ];

  return (
    <Box
      id="about"
      sx={{
        py: { xs: 12, md: 16 },
        position: "relative",
        overflow: "hidden",
        background: "linear-gradient(135deg, #f0f4ff 0%, #ffffff 100%)",
      }}
    >
      {/* Background floating objects */}
      {backgroundObjects.map((obj, i) => (
        <motion.img
          key={i}
          src={obj.src}
          alt={`bg-${i}`}
          style={{
            position: "absolute",
            top: `${obj.top}%`,
            left: `${obj.left}%`,
            width: obj.size,
            height: "auto",
            zIndex: 0,
            pointerEvents: "none",
          }}
          animate={{ rotate: [0, 360] }}
          transition={{ duration: obj.rotateSpeed, repeat: Infinity, ease: "linear" }}
        />
      ))}

      {/* Floating icons */}
      {floatingIcons.map((obj, i) => (
        <motion.div
          key={i}
          style={{ position: "absolute", top: `${obj.top}%`, left: `${obj.left}%`, zIndex: 1 }}
          animate={{ rotate: [0, 360], scale: [1, 1.1, 1] }}
          transition={{ duration: 35 + i * 10, repeat: Infinity, ease: "easeInOut" }}
        >
          {obj.icon}
        </motion.div>
      ))}

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
            { title: "💚 Lingap", text: "Extending care and compassion to uplift those in need." },
            { title: "💛 Malasakit", text: "Promoting empathy and collective responsibility among all members." },
            { title: "💙 Kalinga", text: "Creating sustainable support for lasting community growth." },
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
                    boxShadow: "0 25px 60px rgba(0,0,0,0.1)",
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

        {/* Alternating content blocks */}
        {contentBlocks.map((block, idx) => (
          <Grid container spacing={4} alignItems="center" sx={{ mb: 8 }} key={idx} direction={idx % 2 === 0 ? "row" : "row-reverse"}>
            <Grid item xs={12} md={6}>
              {block.image && (
                <motion.img
                  src={block.image}
                  alt={block.title}
                  style={{ width: "100%", borderRadius: 16, boxShadow: "0 20px 45px rgba(0,0,0,0.15)" }}
                  whileHover={{ scale: 1.05, rotateY: 12 }}
                  transition={{ duration: 0.5 }}
                />
              )}
            </Grid>
            <Grid item xs={12} md={6}>
              <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={containerVariants} custom={idx + 1}>
                <Typography variant="h5" fontWeight={700} gutterBottom>
                  {block.title}
                </Typography>
                {block.description}
              </motion.div>
            </Grid>
          </Grid>
        ))}

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