import React, { useEffect, useState } from "react";
import { Container, Stack, Typography, Button, Grid } from "@mui/material";
import SearchIcon from '@mui/icons-material/Search';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import { motion } from "framer-motion";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate } from 'react-router-dom';
import merchantLogo from "../assets/merchantlogo.png";
import mapImg from "../assets/map.png";



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
  return (
    <Container maxWidth="sm" disableGutters sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', py: 4 }}>
      <Stack spacing={2} alignItems="center" sx={{ width: '100%' }}>
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
          <img src={merchantLogo} alt="Merchant" style={{ width: '100%', maxWidth: 260, display: 'block', margin: '0 auto' }} />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.15 }} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: 320, borderRadius: 8, overflow: 'hidden' }}>
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
            {(() => {
              const items =
                roleNormalized === 'MERCHANT'
                  ? [
                      { Icon: SearchIcon, text: 'Let delivery riders find your shop easily' },
                      { Icon: LocalShippingIcon, text: 'Ensure accurate pickup and delivery' },
                    ]
                  : roleNormalized === 'RIDER'
                  ? [
                      { Icon: LocalShippingIcon, text: 'Navigate to merchant shops and customer locations' },
                      { Icon: SearchIcon, text: 'Enable accurate routing and delivery tracking' },
                    ]
                  : [
                      { Icon: SearchIcon, text: 'Find nearby restaurants, shops, and services' },
                      { Icon: LocalShippingIcon, text: 'Enable faster and more accurate delivery' },
                    ];

              return items.map((it, idx) => {
                const Icon = it.Icon;
                const initialX = idx === 0 ? -12 : 12;
                const delay = idx === 0 ? 0.18 : 0.42;
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: initialX }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, delay, ease: 'easeOut' }}
                    whileHover={{ scale: 1.01 }}
                    style={{ width: '100%' }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%', justifyContent: 'flex-start' }}>
                      <Icon color="primary" sx={{ flexShrink: 0 }} />
                      <Typography variant="subtitle1" sx={{ flex: 1, textAlign: 'left', fontSize: { xs: '0.95rem', sm: '1rem' } }}>
                        {it.text}
                      </Typography>
                    </Stack>
                  </motion.div>
                );
              });
            })()}
          </Stack>
        </div>

        <Grid container sx={{ mt: 2, flex: 1 }}>
          {/* Placeholder area kept for future content */}
        </Grid>
      </Stack>

      <Stack sx={{ mt: 'auto', width: '100%', px: 2, pb: 3, position: 'sticky', bottom: 0, pt: 2, bgcolor: 'background.paper', zIndex: 10 }}>
        <Typography variant="body2" align="center" color="text.secondary" sx={{ mb: 1 }}>
          {statusText}
        </Typography>

        {permissionState === 'denied' ? (
          <>
            <Button variant="outlined" color="primary" size="large" fullWidth onClick={openSettings}>
              Open Settings
            </Button>
            <Button variant="contained" color="primary" size="large" fullWidth onClick={requestLocation} sx={{ mt: 1 }}>
              Retry
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outlined"
              color="primary"
              size="large"
              fullWidth
              onClick={requestLocation}
              disabled={permissionState === 'granted' || checkingPermission}
            >
              {checkingPermission ? 'Checking location...' : permissionState === 'granted' ? 'Location enabled' : 'Allow location'}
            </Button>

            <Button
              variant="contained"
              color="primary"
              size="large"
              fullWidth
              onClick={handleContinue}
              disabled={!isEnabled}
              sx={{ mt: 1 }}
            >
              Continue
            </Button>
          </>
        )}
      </Stack>
    </Container>
  );
};

export default LocationAccess;
