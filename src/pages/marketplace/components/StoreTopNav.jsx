import React, { useEffect, useRef, useState } from "react";
import { AppBar, Box, CardMedia, IconButton, Stack, Toolbar, Typography } from "@mui/material";
import { ArrowBack as ArrowBackIcon, FavoriteBorder as FavoriteBorderIcon, Star as StarIcon } from "@mui/icons-material";

const FALLBACK_IMAGE = "/icons/icon-192x192.png";

export default function StoreTopNav({ store, loading, onBack, onFavorite, fadeEnd = 160 }) {
  const [infoOpacity, setInfoOpacity] = useState(1);
  const lastOpacityRef = useRef(1);

  useEffect(() => {
    if (loading || !store) return undefined;

    const end = Math.max(1, fadeEnd);
    let ticking = false;

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const y = window.scrollY || 0;
        const raw = Math.max(0, 1 - y / end);
        const next = Number(raw.toFixed(3));
        if (Math.abs(next - lastOpacityRef.current) > 0.01) {
          lastOpacityRef.current = next;
          setInfoOpacity(next);
        }
        ticking = false;
      });
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [loading, store, fadeEnd]);

  if (loading || !store) return null;

  const ratingLabel = store.rating ? `${Number(store.rating).toFixed(1)} / 5` : "No ratings yet";
  const logoSrc = store.logoImage || store.logo || store.storeLogo || FALLBACK_IMAGE;
  const coverSrc = store.coverImage || FALLBACK_IMAGE;

  return (
    <Box
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
      }}
    >
      <Box sx={{ position: "relative", height: 180, bgcolor: "#eee" }}>
        <CardMedia
          component="img"
          image={coverSrc}
          alt="Store cover"
          sx={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: "linear-gradient(to bottom, rgba(0,0,0,0.35), rgba(0,0,0,0))",
          }}
        />

        <Box
          sx={{
            position: "absolute",
            bottom: -28,
            left: "50%",
            transform: "translateX(-50%)",
            width: 84,
            height: 84,
            borderRadius: "50%",
            overflow: "hidden",
            border: "4px solid #fff",
            boxShadow: "0 8px 20px rgba(0,0,0,0.25)",
            bgcolor: "#fff",
            zIndex: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Box
            component="img"
            src={logoSrc}
            alt="Store logo"
            sx={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </Box>

        <AppBar
          position="absolute"
          elevation={0}
          sx={{
            bgcolor: "transparent",
            boxShadow: "none",
            top: 0,
            left: 0,
            right: 0,
          }}
        >
          <Toolbar sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 1 }}>
            <IconButton
              edge="start"
              onClick={onBack}
              sx={{ color: "#fff", bgcolor: "rgba(0,0,0,0.35)", "&:hover": { bgcolor: "rgba(0,0,0,0.45)" } }}
            >
              <ArrowBackIcon />
            </IconButton>
            <IconButton
              sx={{ color: "#fff", bgcolor: "rgba(0,0,0,0.35)", "&:hover": { bgcolor: "rgba(0,0,0,0.45)" } }}
              aria-label="favorite"
              onClick={onFavorite}
            >
              <FavoriteBorderIcon />
            </IconButton>
          </Toolbar>
        </AppBar>
      </Box>

      <Box
        sx={{
          bgcolor: "#f5f5f5",
          pt: 6,
          pb: 2,
          borderBottom: "1px solid #e0e0e0",
          opacity: infoOpacity,
          transform: `translateY(-${(1 - infoOpacity) * 1}px)`,
          transition: "opacity 1ms ease-out, transform 1ms ease-out",
          willChange: "opacity, transform",
        }}
      >
        <Stack spacing={0.75} alignItems="center" sx={{ textAlign: "center", px: 2 }}>
          <Typography variant="h5" fontWeight={700}>
            {store.storeName || "Store"}
          </Typography>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <StarIcon sx={{ fontSize: 18, color: "#ffb300" }} />
            <Typography variant="body2" color="#607d8b">
              {ratingLabel}
            </Typography>
          </Stack>
          <Stack spacing={0.5} alignItems="center">
            {store.location && (
              <Typography variant="body2" color="#455a64">
                {store.location}
              </Typography>
            )}
            {store.hours && (
              <Typography variant="body2" color="#455a64">
                Hours: {store.hours}
              </Typography>
            )}
            {store.deliveryTime && (
              <Typography variant="body2" color="#455a64">
                Delivery time: {store.deliveryTime}
              </Typography>
            )}
            {(store.deliveryRadiusKm || store.deliveryRatePerKm) && (
              <Typography variant="body2" color="#455a64">
                Delivery fee: {store.deliveryRatePerKm ? `₱${store.deliveryRatePerKm}/km` : "-"}
                {store.deliveryRadiusKm ? ` within ${store.deliveryRadiusKm} km` : ""}
              </Typography>
            )}
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}
