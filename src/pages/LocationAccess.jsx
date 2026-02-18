import React, { useEffect, useState } from "react";
import { Container, Stack, Typography, Button, Box, Paper, IconButton } from "@mui/material";
import { motion } from "framer-motion";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate } from 'react-router-dom';

// Material Symbols Icon Component
const MaterialIcon = ({ name, filled = false, weight = 400, size = 24, sx = {} }) => (
  <span
    className="material-symbols-outlined"
    style={{
      fontSize: size,
      fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${weight}`,
      ...sx
    }}
  >
    {name}
  </span>
);



const LocationAccess = ({ role: propRole, onContinue, nextPath = '/' }) => {
  const [role, setRole] = useState(propRole || "");
  const [permissionState, setPermissionState] = useState('unknown');
  const [checkingPermission, setCheckingPermission] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (propRole) {
      setRole(propRole);
      return;
    }

    let unsub = null;
    if (typeof window !== "undefined") {
      unsub = onAuthStateChanged(auth, async (user) => {
        if (user?.uid) {
          try {
            const docRef = doc(db, "users", user.uid);
            const snap = await getDoc(docRef);
            const r = snap.exists() ? snap.data().role : "";
            setRole(r || "");
          } catch (err) {
            console.warn("Failed to fetch role from Firestore:", err);
          }
        }
      });
    }

    return () => {
      if (unsub) unsub();
    };
  }, [propRole]);

  useEffect(() => {
    let mounted = true;
    async function checkPermission() {
      if (!('geolocation' in navigator)) {
        if (mounted) setPermissionState('denied');
        return;
      }

      if (navigator.permissions && navigator.permissions.query) {
        try {
          const status = await navigator.permissions.query({ name: 'geolocation' });
          if (!mounted) return;
          setPermissionState(status.state);
          setCheckingPermission(false);
          // observe changes
          status.onchange = () => {
            if (mounted) setPermissionState(status.state);
          };
        } catch (e) {
          if (mounted) {
            setPermissionState('prompt');
            setCheckingPermission(false);
          }
        }
      } else {
        // Browser doesn't support Permissions API; assume prompt
        if (mounted) {
          setPermissionState('prompt');
          setCheckingPermission(false);
        }
      }
    }

    checkPermission();
    return () => {
      mounted = false;
    };
  }, []);

  const requestLocation = () => {
    if (!('geolocation' in navigator)) {
      setPermissionState('denied');
      return;
    }
    setCheckingPermission(true);
    navigator.geolocation.getCurrentPosition(
      () => {
        setPermissionState('granted');
        setCheckingPermission(false);
      },
      (err) => {
        if (err.code === 1) setPermissionState('denied');
        else setPermissionState('prompt');
        setCheckingPermission(false);
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  };

  const isEnabled = permissionState === 'granted';

  const handleContinue = () => {
    if (!isEnabled) return;
    if (typeof onContinue === 'function') {
      onContinue();
      return;
    }
    try {
      localStorage.setItem('locationCompleted', 'true');
    } catch (e) {}
    navigate(nextPath);
  };

  const roleNormalized = (role || "").toString().toUpperCase();
  const statusText = checkingPermission
    ? 'Checking location permission...'
    : permissionState === 'granted'
    ? 'Location access enabled — you can continue.'
    : permissionState === 'prompt'
    ? 'Please allow location access to enable location features.'
    : permissionState === 'denied'
    ? 'Location access denied — open your device or browser settings to enable.'
    : '';
  const openSettings = () => {
    // On iOS Safari / PWA we cannot reliably open Settings programmatically.
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    if (isIOS) {
      // eslint-disable-next-line no-alert
      alert(
        'Location permission is denied. To enable on iOS:\n\n' +
          '- Open the Settings app → Safari → Location → Choose "While Using the App" or "Ask".\n\n' +
          '- If you installed the app to the Home Screen (PWA), open Settings → Safari → Location and enable permissions for the site, then revisit the app.'
      );
      return;
    }

    // Try Android / desktop URLs (best-effort) then fallback to instructions
    const tries = [
      'intent://settings#Intent;action=android.settings.APPLICATION_DETAILS_SETTINGS;end',
      'chrome://settings/content/location',
      'about:preferences#privacy',
    ];
    for (const url of tries) {
      try {
        const win = window.open(url, '_blank');
        if (win) return;
      } catch (e) {}
    }
    // Fallback: show guidance dialog
    // eslint-disable-next-line no-alert
    alert(
      'Location permission is denied. To enable:\n\nAndroid Chrome: tap the lock icon next to the URL → Site settings → Location → Allow.\n\n' +
        'Desktop: open browser site settings and enable Location for this site.'
    );
  };
  const getBenefitItems = () => {
    if (roleNormalized === 'MERCHANT') {
      return [
        { icon: 'near_me', title: 'Reach Local Customers', desc: 'Appear in searches for nearby shoppers.' },
        { icon: 'electric_moped', title: 'Faster Deliveries', desc: 'Auto-match with the closest couriers.' }
      ];
    } else if (roleNormalized === 'RIDER') {
      return [
        { icon: 'local_shipping', title: 'Navigate Easily', desc: 'Find merchant shops and customer locations.' },
        { icon: 'route', title: 'Accurate Tracking', desc: 'Enable precise routing and delivery updates.' }
      ];
    } else {
      return [
        { icon: 'near_me', title: 'Reach Local Customers', desc: 'Appear in searches for nearby shoppers.' },
        { icon: 'electric_moped', title: 'Faster Deliveries', desc: 'Auto-match with the closest couriers.' }
      ];
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#F4F5F7',
        p: { xs: 0, sm: 2 }
      }}
    >
      <Paper
        elevation={3}
        sx={{
          position: 'relative',
          maxWidth: 390,
          width: '100%',
          height: { xs: '100vh', sm: 844 },
          bgcolor: 'white',
          overflow: 'hidden',
          borderRadius: { xs: 0, sm: '48px' },
          border: { xs: 'none', sm: '8px solid #0f172a' },
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Status bar spacer */}
        <Box sx={{ height: 48 }} />

        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 1 }}>
          <IconButton sx={{ color: '#94a3b8', '&:hover': { color: '#475569' } }}>
            <MaterialIcon name="close" size={24} />
          </IconButton>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              px: 1.5,
              py: 0.5,
              bgcolor: '#eff6ff',
              borderRadius: '9999px'
            }}
          >
            <MaterialIcon name="verified" filled size={14} sx={{ color: '#0052CC' }} />
            <Typography
              sx={{
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#0052CC'
              }}
            >
              Merchant Portal
            </Typography>
          </Box>
          <Box sx={{ width: 24 }} />
        </Box>

        {/* Main content */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            px: 4,
            pt: 4,
            textAlign: 'center',
            overflowY: 'auto'
          }}
        >
          {/* Illustration */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            style={{ position: 'relative', width: '100%', maxWidth: 240, marginBottom: 48 }}
          >
            <Box sx={{ position: 'relative', width: '100%', aspectRatio: '1/1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {/* Outer circle */}
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  bgcolor: '#eff6ff',
                  borderRadius: '50%',
                  transform: 'scale(1.1)'
                }}
              />
              {/* Inner circle */}
              <Box
                sx={{
                  position: 'absolute',
                  inset: 32,
                  bgcolor: 'rgba(219, 234, 254, 0.5)',
                  borderRadius: '50%',
                  transform: 'scale(1.05)'
                }}
              />
              {/* Icon group */}
              <Box sx={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0052CC' }}>
                  <motion.div
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 2, ease: 'easeInOut', repeat: Infinity, repeatDelay: 0.5 }}
                  >
                    <MaterialIcon name="location_on" filled weight={300} size={180} sx={{ filter: 'drop-shadow(0 10px 25px rgba(0,0,0,0.1))' }} />
                  </motion.div>
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 40,
                      bgcolor: 'white',
                      borderRadius: '12px',
                      p: 2,
                      boxShadow: '0 10px 40px -15px rgba(0, 82, 204, 0.3)',
                      border: '1px solid #eff6ff'
                    }}
                  >
                    <MaterialIcon name="storefront" size={48} sx={{ color: '#0052CC' }} />
                  </Box>
                </Box>
              </Box>
              {/* Check badge */}
              <motion.div
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 12 }}
                transition={{ delay: 0.4, type: 'spring', stiffness: 200 }}
                style={{ position: 'absolute', top: 16, right: 16 }}
              >
                <Box sx={{ bgcolor: '#10b981', color: 'white', p: 1, borderRadius: '8px', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)' }}>
                  <MaterialIcon name="check_circle" size={20} />
                </Box>
              </motion.div>
              {/* Shipping badge */}
              <motion.div
                initial={{ scale: 0, rotate: 45 }}
                animate={{ scale: 1, rotate: -6 }}
                transition={{ delay: 0.5, type: 'spring', stiffness: 200 }}
                style={{ position: 'absolute', bottom: 40, left: 0 }}
              >
                <Box sx={{ bgcolor: 'white', p: 1, borderRadius: '50%', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                  <MaterialIcon name="local_shipping" size={24} sx={{ color: '#0052CC' }} />
                </Box>
              </motion.div>
            </Box>
          </motion.div>

          {/* Heading */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
          >
            <Typography
              sx={{
                fontSize: '28px',
                fontWeight: 700,
                lineHeight: 1.2,
                letterSpacing: '-0.02em',
                color: '#0f172a',
                mb: 2
              }}
            >
              Optimize Your<br />Store Visibility
            </Typography>
          </motion.div>

          {/* Description */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <Typography
              sx={{
                fontSize: '15px',
                color: '#64748b',
                lineHeight: 1.5,
                fontWeight: 500,
                mb: 5
              }}
            >
              Enable location access to help local customers find your business and connect with nearby delivery partners instantly.
            </Typography>
          </motion.div>

          {/* Benefits */}
          <Stack spacing={1.5} sx={{ width: '100%', mb: 4 }}>
            {getBenefitItems().map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + idx * 0.1, duration: 0.5 }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    p: 2,
                    borderRadius: '12px',
                    bgcolor: 'rgba(239, 246, 255, 0.5)',
                    border: '1px solid #dbeafe'
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      width: 40,
                      height: 40,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '8px',
                      bgcolor: '#0052CC',
                      color: 'white',
                      flexShrink: 0
                    }}
                  >
                    <MaterialIcon name={item.icon} size={24} />
                  </Box>
                  <Box sx={{ textAlign: 'left' }}>
                    <Typography sx={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                      {item.title}
                    </Typography>
                    <Typography sx={{ fontSize: '12px', color: '#64748b' }}>
                      {item.desc}
                    </Typography>
                  </Box>
                </Box>
              </motion.div>
            ))}
          </Stack>
        </Box>

        {/* Bottom buttons */}
        <Box sx={{ px: 4, pb: 5, pt: 2, bgcolor: 'white' }}>
          <Stack spacing={2}>
            {permissionState === 'denied' ? (
              <>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={openSettings}
                  disabled={checkingPermission}
                  sx={{
                    height: 58,
                    borderRadius: '12px',
                    bgcolor: '#0052CC',
                    fontSize: '18px',
                    fontWeight: 700,
                    textTransform: 'none',
                    boxShadow: '0 10px 30px rgba(0, 82, 204, 0.3)',
                    '&:hover': { bgcolor: '#0747A6' },
                    '&:active': { transform: 'scale(0.98)' }
                  }}
                >
                  Open Settings
                </Button>
                <Button
                  variant="text"
                  fullWidth
                  onClick={requestLocation}
                  sx={{
                    height: 40,
                    borderRadius: '12px',
                    color: '#94a3b8',
                    fontSize: '14px',
                    fontWeight: 600,
                    textTransform: 'none',
                    '&:hover': { color: '#475569', bgcolor: 'transparent' }
                  }}
                >
                  Retry
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={requestLocation}
                  disabled={permissionState === 'granted' || checkingPermission}
                  sx={{
                    height: 58,
                    borderRadius: '12px',
                    bgcolor: '#0052CC',
                    fontSize: '18px',
                    fontWeight: 700,
                    textTransform: 'none',
                    boxShadow: '0 10px 30px rgba(0, 82, 204, 0.3)',
                    '&:hover': { bgcolor: '#0747A6' },
                    '&:active': { transform: 'scale(0.98)' },
                    '&.Mui-disabled': { bgcolor: '#cbd5e1', color: 'white' }
                  }}
                >
                  {checkingPermission ? 'Checking...' : permissionState === 'granted' ? '✓ Location Enabled' : 'Enable Location'}
                </Button>
                {permissionState === 'granted' && (
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={handleContinue}
                    sx={{
                      height: 58,
                      borderRadius: '12px',
                      bgcolor: '#10b981',
                      fontSize: '18px',
                      fontWeight: 700,
                      textTransform: 'none',
                      boxShadow: '0 10px 30px rgba(16, 185, 129, 0.3)',
                      '&:hover': { bgcolor: '#059669' },
                      '&:active': { transform: 'scale(0.98)' }
                    }}
                  >
                    Continue
                  </Button>
                )}
                <Button
                  variant="text"
                  fullWidth
                  onClick={handleContinue}
                  disabled={permissionState === 'granted'}
                  sx={{
                    height: 40,
                    borderRadius: '12px',
                    color: '#94a3b8',
                    fontSize: '14px',
                    fontWeight: 600,
                    textTransform: 'none',
                    '&:hover': { color: '#475569', bgcolor: 'transparent' },
                    '&.Mui-disabled': { display: 'none' }
                  }}
                >
                  Not Now
                </Button>
              </>
            )}
          </Stack>

          {/* Security notice */}
          <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <MaterialIcon name="lock" size={12} sx={{ color: '#cbd5e1' }} />
              <Typography
                sx={{
                  fontSize: '10px',
                  color: '#cbd5e1',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase'
                }}
              >
                Professional Security Standard
              </Typography>
            </Box>
            <Typography
              sx={{
                fontSize: '11px',
                color: '#cbd5e1',
                textAlign: 'center',
                lineHeight: 1.3
              }}
            >
              Your store location is only used to facilitate order fulfillment and customer discovery.
            </Typography>
          </Box>
        </Box>

        {/* iOS home indicator */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 8,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 134,
            height: 5,
            bgcolor: '#e2e8f0',
            borderRadius: '9999px'
          }}
        />
      </Paper>
    </Box>
  );
};

export default LocationAccess;
