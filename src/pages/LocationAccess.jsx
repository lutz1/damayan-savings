import React from "react";
import { Container, Stack, Typography, Button, Grid } from "@mui/material";
import SearchIcon from '@mui/icons-material/Search';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import { motion } from "framer-motion";
import merchantLogo from "../assets/merchantlogo.png";
import mapImg from "../assets/map.png";



const LocationAccess = () => {
  return (
    <Container maxWidth="sm" disableGutters sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', py: 4 }}>
      <Stack spacing={2} alignItems="center" sx={{ width: '100%' }}>
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
          <img src={merchantLogo} alt="Merchant" style={{ width: '48vw', maxWidth: 260, display: 'block', margin: '0 auto' }} />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.15 }} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '80vw', maxWidth: 320, borderRadius: 8, overflow: 'hidden' }}>
            <motion.img
              src={mapImg}
              alt="Map"
              style={{ width: '100%', height: 'auto', display: 'block' }}
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ duration: 1.8, ease: 'easeInOut', repeat: Infinity, repeatDelay: 1 }}
            />
          </div>
        </motion.div>

        <div style={{ width: '90%', padding: '8px 16px 24px' }}>
          <Typography variant="h5" align="left" sx={{ pb: 1 }}>
            Location permission is required on the next screen for:
          </Typography>
          <Stack spacing={1} alignItems="center" sx={{ width: '100%' }}>
            <motion.div
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.18, ease: 'easeOut' }}
              whileHover={{ scale: 1.01 }}
              style={{ width: '100%' }}
            >
              <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%', justifyContent: 'flex-start' }}>
                <SearchIcon color="primary" sx={{ flexShrink: 0 }} />
                <Typography variant="subtitle1" sx={{ flex: 1, textAlign: 'left', fontSize: { xs: '0.95rem', sm: '1rem' } }}>
                  Find the best restaurants, shops and services near you
                </Typography>
              </Stack>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.42, ease: 'easeOut' }}
              whileHover={{ scale: 1.01 }}
              style={{ width: '100%' }}
            >
              <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%', justifyContent: 'flex-start' }}>
                <LocalShippingIcon color="primary" sx={{ flexShrink: 0 }} />
                <Typography variant="subtitle1" sx={{ flex: 1, textAlign: 'left', fontSize: { xs: '0.95rem', sm: '1rem' } }}>
                  Faster and more accurate delivery
                </Typography>
              </Stack>
            </motion.div>
          </Stack>
        </div>

        <Grid container sx={{ mt: 2, flex: 1 }}>
          {/* Placeholder area kept for future content */}
        </Grid>
      </Stack>

      <Stack sx={{ mt: 'auto', width: '100%', px: 2, pb: 3, position: 'sticky', bottom: 0, pt: 2, bgcolor: 'background.paper', zIndex: 10 }}>
        <Button variant="contained" color="primary" size="large" fullWidth onClick={() => {}}>
          Continue
        </Button>
      </Stack>
    </Container>
  );
};

export default LocationAccess;
