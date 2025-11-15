import React from "react";
import { Box, Typography, Container, Grid, Paper, Avatar } from "@mui/material";
import { Parallax } from "react-scroll-parallax";
import { motion } from "framer-motion";
import RevealOnScroll from "../RevealOnScroll";
import damayanLogo from "../../assets/damayan.png";
import ceobg from "../../assets/ceobg.png";
 // ✅ replace with your real file later

const CeoSection = () => {
  return (
    <Box
      id="leadership"
      sx={{
        position: "relative",
        py: 12,
        color: "white",
        overflow: "hidden",
      }}
    >
      {/* Background Image */}
                <Box
                  component="img"
                  src={ceobg}
                  alt="Leadership Background"
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
      {/* ✅ Parallax Background */}
      <Parallax speed={-15}>
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundImage:
              "url('https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1950&q=80')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            zIndex: 0,
            filter: "brightness(0.45)",
          }}
        />
      </Parallax>


      {/* ✅ Content */}
      <Container sx={{ position: "relative", zIndex: 2 }}>
        <RevealOnScroll>
          <Typography
  variant="h3"
  align="center"
  fontWeight={800}
  gutterBottom
  sx={{
    color: "#ffffff",
    mb: 7,
    textTransform: "uppercase",
    letterSpacing: 3,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: 1.5,
  }}
>
  <Box
    sx={{
      width: 55,
      height: 55,
      borderRadius: "50%",
      background: "linear-gradient(135deg, #1976d2, #42a5f5)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      boxShadow: "0 0 18px rgba(25,118,210,0.45)",
    }}
  >
    <i className="fas fa-user-tie" style={{ fontSize: 26 }} />
  </Box>
  Leadership & Ownership
</Typography>
        </RevealOnScroll>

        <Grid container spacing={6} alignItems="center">
          {/* ✅ CEO Profile */}
          <Grid item xs={12} md={4}>
            <RevealOnScroll delay={0.3}>
              <motion.div
                whileHover={{ scale: 1.03 }}
                transition={{ type: "spring", stiffness: 200 }}
              >
                <Paper
                  elevation={6}
                  sx={{
                    p: 4,
                    borderRadius: 4,
                    textAlign: "center",
                    background: "rgba(255,255,255,0.12)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <Avatar
                    alt="Edelyn Maningo"
                    sx={{
                      width: 120,
                      height: 120,
                      mx: "auto",
                      mb: 2,
                      border: "3px solid white",
                    }}
                  />
                  <Typography variant="h6" fontWeight="bold">
                    Edelyn Maningo
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>
                    CEO – Trucapital Credit Lending Corporation
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ mt: 2, lineHeight: 1.8, textAlign: "justify" }}
                  >
                    Born in <b>Asuncion, Davao del Norte</b>. A graduate of{" "}
                    <b>Bachelor of Science in Criminology</b> and an active
                    member of the <b>Philippine National Police</b> for 14 years
                    in service. Her leadership is rooted in discipline,
                    compassion, and empowerment.
                  </Typography>
                </Paper>
              </motion.div>
            </RevealOnScroll>
          </Grid>

          {/* ✅ Ownership & Program Info */}
          <Grid item xs={12} md={8}>
            <RevealOnScroll delay={0.4}>
              <Paper
                elevation={6}
                sx={{
                  p: 4,
                  borderRadius: 4,
                  background: "rgba(255,255,255,0.1)",
                  backdropFilter: "blur(10px)",
                }}
              >
                <Typography variant="h6" gutterBottom>
                  Damayan Program
                </Typography>
                <Typography variant="body2" sx={{ mb: 3, lineHeight: 1.8 }}>
                  The <b>Damayan Program</b> was created under{" "}
                  <b>Trucapital Credit Lending Corporation (TCLC)</b>. It was
                  the initiative of our CEO, drawn from her experience that every
                  individual has the right to earn and to help through the
                  collective compassion of the community.
                </Typography>

                <Typography variant="h6" gutterBottom>
                  Subsidiaries & Programs
                </Typography>
                <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
                  • Damayan – Program Mortuary Care Services <br />
                  • Zemmerocks Mineral Trading <br />
                  • Dreamline Strategic Marketing <br />
                  • Zerruccah Beach Resort <br />
                  • Z-Banana Plantation
                </Typography>
              </Paper>
            </RevealOnScroll>
          </Grid>
        </Grid>

        {/* ✅ Company Info Card */}
        <Grid container justifyContent="center" sx={{ mt: 6 }}>
          <Grid item xs={12} md={6}>
            <RevealOnScroll delay={0.6}>
              <Paper
                elevation={5}
                sx={{
                  p: 4,
                  textAlign: "center",
                  borderRadius: 4,
                  background: "rgba(255,255,255,0.12)",
                  backdropFilter: "blur(8px)",
                }}
              >
                <Avatar
                  src={damayanLogo}
                  alt="Damayan Logo"
                  sx={{
                    width: 80,
                    height: 80,
                    mx: "auto",
                    mb: 2,
                    border: "2px solid white",
                  }}
                />
                <Typography variant="h6" fontWeight="bold">
                  TRUCAPITAL CREDIT LENDING CORPORATION
                </Typography>
                <Typography variant="body2" sx={{ mt: 1, opacity: 0.9 }}>
                  SEC Reg. No. 2023430 — Certificate of Authority No. 3430
                </Typography>
              </Paper>
            </RevealOnScroll>
          </Grid>
        </Grid>

        {/* ✅ Vision & Mission */}
        <Grid container spacing={4} sx={{ mt: 8 }}>
          <Grid item xs={12} md={6}>
            <RevealOnScroll delay={0.7}>
              <motion.div
                whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 200 }}
              >
                <Paper
                  elevation={4}
                  sx={{
                    p: 4,
                    borderRadius: 4,
                    background: "rgba(255,255,255,0.15)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <Typography variant="h6" gutterBottom>
                    🌟 Vision
                  </Typography>
                  <Typography variant="body2">
                    A good leading modern <b>TCLC Program Principle</b> —
                    empowering members and helping them live financially free.
                  </Typography>
                </Paper>

                
              </motion.div>
            </RevealOnScroll>
          </Grid>

          <Grid item xs={12} md={6}>
            <RevealOnScroll delay={0.8}>
              <motion.div
                whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 200 }}
              >
                <Paper
                  elevation={4}
                  sx={{
                    p: 4,
                    borderRadius: 4,
                    background: "rgba(255,255,255,0.15)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <Typography variant="h6" gutterBottom>
                    💼 Mission
                  </Typography>
                  <Typography variant="body2">
                    To provide excellent financial assistance and allied
                    services, while uplifting the lives of every family member
                    through dedication, empathy, and trust.
                  </Typography>
                </Paper>
              </motion.div>
            </RevealOnScroll>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default CeoSection;