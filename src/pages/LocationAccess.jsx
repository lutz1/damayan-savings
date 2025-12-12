import React from "react";
import { Box, Typography, Grid, Paper } from "@mui/material";
import { motion } from "framer-motion";
import merchantLogo from "../assets/merchantlogo.jpg";
import productImg from "../assets/product.jpg";
import riderImg from "../assets/rider.jpg";
import servicesImg from "../assets/services.jpg";

const CategoryCard = ({ src, label }) => (
  <Paper elevation={3} sx={{ p: 1, textAlign: "center" }}>
    <Box
      component="img"
      src={src}
      alt={label}
      sx={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 1 }}
    />
    <Typography sx={{ mt: 1, fontWeight: 600 }}>{label}</Typography>
  </Paper>
);

const LocationAccess = () => {
  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Box sx={{ pt: 6, pb: 3, textAlign: "center" }}>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <Box
            component="img"
            src={merchantLogo}
            alt="Merchant"
            sx={{ width: { xs: "48vw", sm: 260 }, maxWidth: 360, mx: "auto", display: "block" }}
          />
        </motion.div>
      </Box>

      <Box sx={{ flex: 1, display: "flex", alignItems: "flex-end", pb: 6, px: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4}>
            <CategoryCard src={productImg} label="Products" />
          </Grid>
          <Grid item xs={12} sm={4}>
            <CategoryCard src={riderImg} label="Rider" />
          </Grid>
          <Grid item xs={12} sm={4}>
            <CategoryCard src={servicesImg} label="Services" />
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};

export default LocationAccess;
