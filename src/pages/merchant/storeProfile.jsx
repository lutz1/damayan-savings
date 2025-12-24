import React, { useEffect, useState, useRef } from "react";
import { useJsApiLoader, GoogleMap, Marker } from "@react-google-maps/api";
import {
  Box,
  Card,
  CardContent,
  CardMedia,
  Stack,
  Typography,
  TextField,
  Button,
  Avatar,
  Snackbar,
  Alert,
  Container,
  IconButton,
  InputAdornment,
} from "@mui/material";
import {
  Save,
  PhotoCamera,
  Close,
  Store as StoreIcon,
  AccessTime,
  MyLocation,
} from "@mui/icons-material";
import { motion } from "framer-motion";
import MobileAppShell from "../../components/MobileAppShell";
import { auth, db, storage } from "../../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp, GeoPoint } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";

// Keep libraries array stable
const GOOGLE_MAP_LIBRARIES = ["places"];

const motionCard = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

// Helper to extract storage path from Firebase Storage URL
const getStoragePathFromUrl = (url) => {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname.split('/o/')[1];
    return decodeURIComponent(path.split('?')[0]);
  } catch (e) {
    return null;
  }
};

export default function StoreProfilePage() {
  const [uid, setUid] = useState(localStorage.getItem("uid") || null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [locating, setLocating] = useState(false);
  const mapRef = useRef(null);
  const searchInputElRef = useRef(null);
  const searchBoxRef = useRef(null);
  const searchContainerRef = useRef(null);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "YOUR_API_KEY_HERE",
    libraries: GOOGLE_MAP_LIBRARIES,
  });

  const [storeName, setStoreName] = useState("");
  const [hours, setHours] = useState("");
  const [location, setLocation] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [logoImage, setLogoImage] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [deliveryRadiusKm, setDeliveryRadiusKm] = useState("");
  const [deliveryRatePerKm, setDeliveryRatePerKm] = useState("");
  const [coords, setCoords] = useState(null); // { lat, lng }

  const [snack, setSnack] = useState({ open: false, severity: "success", message: "" });

  // Auth bridge
  useEffect(() => {
    if (uid) return;
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) return;
      setUid(u.uid);
      try { localStorage.setItem("uid", u.uid); } catch (_) {}
    });
    return unsub;
  }, [uid]);

  // Load store profile
  useEffect(() => {
    if (!uid) return;
    setLoading(true);

    const loadStore = async () => {
      try {
        const snap = await getDoc(doc(db, "merchants", uid));
        if (snap.exists()) {
          const data = snap.data();
          setStoreName(data.storeName || "");
          setHours(data.hours || "");
          setLocation(data.location || "");
          setCoverImage(data.coverImage || "");
          setLogoImage(data.logoImage || data.logo || data.storeLogo || "");
          setDeliveryTime(data.deliveryTime || "");
          setDeliveryRadiusKm(
            data.deliveryRadiusKm !== undefined && data.deliveryRadiusKm !== null
              ? String(data.deliveryRadiusKm)
              : ""
          );
          setDeliveryRatePerKm(
            data.deliveryRatePerKm !== undefined && data.deliveryRatePerKm !== null
              ? String(data.deliveryRatePerKm)
              : ""
          );
          const lat =
            typeof data.locationLat === "number"
              ? data.locationLat
              : data.locationGeo?.latitude;
          const lng =
            typeof data.locationLng === "number"
              ? data.locationLng
              : data.locationGeo?.longitude;
          if (typeof lat === "number" && typeof lng === "number") {
            setCoords({ lat, lng });
          }
        }
      } catch (err) {
        console.error(err);
        setSnack({ open: true, severity: "error", message: "Failed to load store profile" });
      }
      setLoading(false);
    };

    loadStore();
  }, [uid]);

  // Remove external autocomplete; we'll use in-map SearchBox instead

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setSnack({ open: true, severity: "warning", message: "Please select an image file" });
      return;
    }

    setImageUploading(true);

    try {
      const storageRef = ref(storage, `merchants/${uid}/cover_${Date.now()}_${file.name}`);
      const task = uploadBytesResumable(storageRef, file);

      task.on(
        "state_changed",
        () => {
          // progress tracking (optional for UI)
        },
        (err) => {
          console.error(err);
          setSnack({ open: true, severity: "error", message: "Image upload failed" });
          setImageUploading(false);
        },
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          // delete previous if exists
          if (coverImage) {
            try { 
              const path = getStoragePathFromUrl(coverImage);
              if (path) {
                await deleteObject(ref(storage, path)); 
              }
            } catch (err) {
              console.log('Could not delete old image:', err.code);
            }
          }
          setCoverImage(url);
          setSnack({ open: true, severity: "success", message: "Image uploaded" });
          setImageUploading(false);
        }
      );
    } catch (err) {
      console.error(err);
      setSnack({ open: true, severity: "error", message: "Upload error" });
      setImageUploading(false);
    }
  };

  const handleLogoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setSnack({ open: true, severity: "warning", message: "Please select an image file" });
      return;
    }

    setImageUploading(true);

    try {
      const storageRef = ref(storage, `merchants/${uid}/logo_${Date.now()}_${file.name}`);
      const task = uploadBytesResumable(storageRef, file);

      task.on(
        "state_changed",
        () => {},
        (err) => {
          console.error(err);
          setSnack({ open: true, severity: "error", message: "Logo upload failed" });
          setImageUploading(false);
        },
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          // delete previous logo if exists
          if (logoImage) {
            try {
              const path = getStoragePathFromUrl(logoImage);
              if (path) {
                await deleteObject(ref(storage, path));
              }
            } catch (err) {
              console.log('Could not delete old logo:', err.code);
            }
          }
          setLogoImage(url);
          setSnack({ open: true, severity: "success", message: "Logo uploaded" });
          setImageUploading(false);
        }
      );
    } catch (err) {
      console.error(err);
      setSnack({ open: true, severity: "error", message: "Upload error" });
      setImageUploading(false);
    }
  };

  const handleSave = async () => {
    if (!uid || !storeName.trim()) {
      setSnack({ open: true, severity: "warning", message: "Store name is required" });
      return;
    }

    setSaving(true);
    try {
      await setDoc(
        doc(db, "merchants", uid),
        {
          uid,
          storeName: storeName.trim(),
          hours,
          location,
          coverImage,
          logoImage,
          storeLogo: logoImage,
          deliveryTime: deliveryTime.trim(),
          deliveryRadiusKm: deliveryRadiusKm ? Number(deliveryRadiusKm) : null,
          deliveryRatePerKm: deliveryRatePerKm ? Number(deliveryRatePerKm) : null,
          locationLat: coords ? coords.lat : null,
          locationLng: coords ? coords.lng : null,
          locationGeo: coords ? new GeoPoint(coords.lat, coords.lng) : null,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setSnack({ open: true, severity: "success", message: "Store profile saved" });
    } catch (err) {
      console.error(err);
      setSnack({ open: true, severity: "error", message: "Failed to save" });
    }
    setSaving(false);
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setSnack({ open: true, severity: "warning", message: "Geolocation not supported" });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setCoords({ lat: latitude, lng: longitude });
        setLocating(false);
      },
      () => {
        setSnack({ open: true, severity: "error", message: "Unable to get current location" });
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Keep map view synced with coords
  useEffect(() => {
    if (mapRef.current && coords) {
      try {
        mapRef.current.panTo(coords);
        mapRef.current.setZoom(15);
      } catch (_) {
        // ignore
      }
    }
  }, [coords]);

  // Reverse geocode to keep the displayed address in sync with the pin
  useEffect(() => {
    if (!coords || !window.google?.maps?.Geocoder) return;
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: coords }, (results, status) => {
      if (status === "OK" && results?.[0]) {
        const addr = results[0].formatted_address || results[0].name;
        if (addr) setLocation(addr);
      }
    });
  }, [coords]);

  return (
    <MobileAppShell title="Store Profile">
      <Box sx={{ minHeight: "100vh", bgcolor: "#f5f5f5", pb: 2, pt: 2 }}>
        <Container maxWidth="sm" sx={{ pb: 12 }}>
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Box sx={{ mb: 3, textAlign: "center" }}>
              <Avatar
                sx={{
                  width: 64,
                  height: 64,
                  bgcolor: "#1976d2",
                  margin: "0 auto 16px",
                  boxShadow: "0 4px 12px rgba(25, 118, 210, 0.2)",
                }}
              >
                <StoreIcon sx={{ fontSize: 32 }} />
              </Avatar>
              <Typography variant="h5" fontWeight="bold" gutterBottom color="#263238">
                Your Store Profile
              </Typography>
              <Typography variant="body2" color="#546e7a">
                Customize your shop appearance and hours
              </Typography>
            </Box>
          </motion.div>

          {/* Cover Image */}
          <motion.div {...motionCard}>
            <Card sx={{ mb: 2, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
              <CardContent>
                <Stack spacing={1.5}>
                  <Typography variant="subtitle1" fontWeight={600} color="#263238">
                    📸 Store Cover Image
                  </Typography>
                  {coverImage ? (
                    <Box sx={{ position: "relative" }}>
                      <CardMedia
                        component="img"
                        image={coverImage}
                        alt="Store cover"
                        sx={{ borderRadius: 2, height: 180, objectFit: "cover" }}
                      />
                      <IconButton
                        sx={{
                          position: "absolute",
                          top: 8,
                          right: 8,
                          bgcolor: "#d32f2f",
                          color: "white",
                          "&:hover": { bgcolor: "#c62828" },
                        }}
                        onClick={async () => {
                          try {
                            const path = getStoragePathFromUrl(coverImage);
                            if (path) {
                              await deleteObject(ref(storage, path));
                            }
                            setCoverImage("");
                            setSnack({ open: true, severity: "success", message: "Image removed" });
                          } catch (e) {
                            console.log('Delete error:', e.code);
                            // Even if delete fails, clear the UI
                            setCoverImage("");
                            setSnack({ open: true, severity: "warning", message: "Image reference cleared" });
                          }
                        }}
                      >
                        <Close />
                      </IconButton>
                    </Box>
                  ) : (
                    <Button
                      component="label"
                      variant="outlined"
                      fullWidth
                      startIcon={<PhotoCamera />}
                      sx={{
                        height: 120,
                        borderStyle: "dashed",
                        borderWidth: 2,
                        borderColor: "#90caf9",
                        color: "#1976d2",
                        bgcolor: "#e3f2fd",
                        "&:hover": { borderColor: "#1976d2", bgcolor: "#bbdefb" },
                      }}
                      disabled={imageUploading}
                    >
                      {imageUploading ? "Uploading..." : "Upload Cover Image"}
                      <input hidden type="file" accept="image/*" onChange={handleImageSelect} />
                    </Button>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </motion.div>

          {/* Store Logo */}
          <motion.div {...motionCard} transition={{ delay: 0.05 }}>
            <Card sx={{ mb: 2, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
              <CardContent>
                <Stack spacing={1.5} alignItems="center">
                  <Typography variant="subtitle1" fontWeight={600} color="#263238" sx={{ alignSelf: "flex-start" }}>
                    🏷️ Store Logo
                  </Typography>
                  {logoImage ? (
                    <Box sx={{ position: "relative" }}>
                      <Avatar
                        src={logoImage}
                        alt="Store logo"
                        sx={{ width: 96, height: 96, border: "3px solid #fff", boxShadow: "0 6px 16px rgba(0,0,0,0.15)" }}
                      />
                      <IconButton
                        sx={{
                          position: "absolute",
                          top: -6,
                          right: -6,
                          bgcolor: "#d32f2f",
                          color: "white",
                          "&:hover": { bgcolor: "#c62828" },
                        }}
                        onClick={async () => {
                          try {
                            const path = getStoragePathFromUrl(logoImage);
                            if (path) {
                              await deleteObject(ref(storage, path));
                            }
                            setLogoImage("");
                            setSnack({ open: true, severity: "success", message: "Logo removed" });
                          } catch (e) {
                            console.log('Delete error:', e.code);
                            setLogoImage("");
                            setSnack({ open: true, severity: "warning", message: "Logo reference cleared" });
                          }
                        }}
                      >
                        <Close />
                      </IconButton>
                    </Box>
                  ) : (
                    <Button
                      component="label"
                      variant="outlined"
                      startIcon={<PhotoCamera />}
                      sx={{
                        borderStyle: "dashed",
                        borderWidth: 2,
                        borderColor: "#90caf9",
                        color: "#1976d2",
                        bgcolor: "#e3f2fd",
                        "&:hover": { borderColor: "#1976d2", bgcolor: "#bbdefb" },
                      }}
                      disabled={imageUploading}
                    >
                      {imageUploading ? "Uploading..." : "Upload Store Logo"}
                      <input hidden type="file" accept="image/*" onChange={handleLogoSelect} />
                    </Button>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </motion.div>

          {/* Store Details */}
          <motion.div {...motionCard} transition={{ delay: 0.1 }}>
            <Card sx={{ mb: 2, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="subtitle1" fontWeight={600} color="#263238">
                    📝 Store Information
                  </Typography>

                  <TextField
                    label="Store Name"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    fullWidth
                    required
                    placeholder="e.g., John's Coffee Shop"
                    disabled={loading}
                  />

                  <TextField
                    label="Operating Hours"
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    fullWidth
                    placeholder="e.g., 8:00 AM - 6:00 PM"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <AccessTime />
                        </InputAdornment>
                      ),
                    }}
                    disabled={loading}
                  />

                  <TextField
                    label="Delivery Time"
                    value={deliveryTime}
                    onChange={(e) => setDeliveryTime(e.target.value)}
                    fullWidth
                    placeholder="e.g., 30-45 mins"
                    disabled={loading}
                  />

                  <Stack direction="row" spacing={1}>
                    <TextField
                      label="Delivery Radius (km)"
                      type="number"
                      value={deliveryRadiusKm}
                      onChange={(e) => setDeliveryRadiusKm(e.target.value)}
                      fullWidth
                      placeholder="e.g., 5"
                      disabled={loading}
                      inputProps={{ min: 0, step: 0.5 }}
                    />
                    <TextField
                      label="Rate per km (₱)"
                      type="number"
                      value={deliveryRatePerKm}
                      onChange={(e) => setDeliveryRatePerKm(e.target.value)}
                      fullWidth
                      placeholder="e.g., 10"
                      disabled={loading}
                      inputProps={{ min: 0, step: 1 }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            ₱
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Stack>

                  {deliveryRadiusKm && deliveryRatePerKm && (
                    <Typography variant="caption" color="#546e7a">
                      Estimated delivery rate: ₱{(Number(deliveryRadiusKm) * Number(deliveryRatePerKm)).toFixed(2)} for {deliveryRadiusKm} km radius
                    </Typography>
                  )}

                  {/* Search is now inside the map as a SearchBox control */}
                  {location && (
                    <Typography variant="caption" sx={{ color: "#666", mt: 1 }}>
                      ✓ Selected: {location}
                    </Typography>
                  )}

                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<MyLocation />}
                    onClick={handleUseMyLocation}
                    disabled={locating || loading}
                    sx={{ alignSelf: "flex-start" }}
                  >
                    {locating ? "Locating..." : "Use my current location"}
                  </Button>

                  {/* Map with draggable marker */}
                  {isLoaded && (
                    <Box sx={{ height: 260, mt: 1, borderRadius: 1, overflow: "hidden", border: "1px solid #ddd" }}>
                      <GoogleMap
                        mapContainerStyle={{ width: "100%", height: "100%" }}
                        zoom={coords ? 15 : 12}
                        center={coords || { lat: 14.5995, lng: 120.9842 }}
                        onLoad={(map) => {
                          mapRef.current = map;
                          try {
                            // Inject styles once for iOS-like search box
                            if (!document.getElementById("ios-searchbox-style")) {
                              const style = document.createElement("style");
                              style.id = "ios-searchbox-style";
                              style.innerHTML = `
                                .ios-searchbox{display:flex;align-items:center;gap:8px;padding:6px 10px;background:rgba(255,255,255,0.85);backdrop-filter:saturate(180%) blur(12px);border-radius:9999px;border:1px solid rgba(0,0,0,0.1);box-shadow:0 2px 8px rgba(0,0,0,0.15)}
                                .ios-searchbox:focus-within{box-shadow:0 0 0 2px #1976d2 inset,0 6px 16px rgba(0,0,0,0.2)}
                                .ios-searchbox .icon{width:16px;height:16px;opacity:.6;margin-left:4px;display:flex;align-items:center;justify-content:center}
                                .ios-searchbox input{border:none;outline:none;background:transparent;width:240px;font-size:14px;padding:6px 6px}
                                .ios-searchbox input::placeholder{color:#999}
                                .ios-searchbox .clear{width:18px;height:18px;border-radius:50%;background:#e5e7eb;color:#374151;display:flex;align-items:center;justify-content:center;cursor:pointer;margin-right:4px;font-size:12px;line-height:18px}
                                .ios-searchbox .clear:hover{background:#d1d5db}
                              `;
                              document.head.appendChild(style);
                            }
                            // Create search input element
                            const container = document.createElement("div");
                            container.className = "ios-searchbox";
                            container.style.margin = "10px";
                            const icon = document.createElement("span");
                            icon.className = "icon";
                            icon.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';
                            const input = document.createElement("input");
                            input.type = "text";
                            input.placeholder = "Search";
                            input.setAttribute("aria-label", "Search location");
                            const clearBtn = document.createElement("span");
                            clearBtn.className = "clear";
                            clearBtn.textContent = "×";
                            clearBtn.title = "Clear";
                            clearBtn.addEventListener("click", () => {
                              input.value = "";
                              input.focus();
                            });
                            container.appendChild(icon);
                            container.appendChild(input);
                            container.appendChild(clearBtn);
                            searchContainerRef.current = container;
                            searchInputElRef.current = input;

                            // Add input to map controls
                            const ctrls = map.controls[window.google.maps.ControlPosition.TOP_LEFT];
                            ctrls.push(container);

                            // Wire Places SearchBox
                            const sb = new window.google.maps.places.SearchBox(input);
                            searchBoxRef.current = sb;

                            // Bias results to current viewport
                            map.addListener("bounds_changed", () => {
                              sb.setBounds(map.getBounds());
                            });

                            sb.addListener("places_changed", () => {
                              const places = sb.getPlaces();
                              if (!places || !places.length) return;
                              const p = places.find(pl => pl.geometry && (pl.geometry.location || pl.geometry.viewport)) || places[0];
                              const g = p.geometry;
                              if (g?.location) {
                                const lat = typeof g.location.lat === "function" ? g.location.lat() : g.location.lat;
                                const lng = typeof g.location.lng === "function" ? g.location.lng() : g.location.lng;
                                if (typeof lat === "number" && typeof lng === "number") {
                                  setCoords({ lat, lng });
                                }
                              } else if (g?.viewport && g.viewport.getCenter) {
                                const center = g.viewport.getCenter();
                                const lat = center.lat();
                                const lng = center.lng();
                                setCoords({ lat, lng });
                              }
                            });
                          } catch (_) {
                            // ignore
                          }
                        }}
                        onUnmount={() => {
                          try {
                            if (searchContainerRef.current && searchContainerRef.current.parentNode) {
                              searchContainerRef.current.parentNode.removeChild(searchContainerRef.current);
                            }
                          } catch (_) {}
                          searchBoxRef.current = null;
                          searchInputElRef.current = null;
                          searchContainerRef.current = null;
                          mapRef.current = null;
                        }}
                        onClick={(e) => {
                          const lat = e?.latLng?.lat?.();
                          const lng = e?.latLng?.lng?.();
                          if (typeof lat === "number" && typeof lng === "number") {
                            setCoords({ lat, lng });
                          }
                        }}
                        options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}
                      >
                        {coords && (
                          <Marker
                            position={coords}
                            draggable
                            onDragEnd={(e) => {
                              const lat = e?.latLng?.lat?.();
                              const lng = e?.latLng?.lng?.();
                              if (typeof lat === "number" && typeof lng === "number") {
                                setCoords({ lat, lng });
                              }
                            }}
                          />
                        )}
                      </GoogleMap>
                    </Box>
                  )}

                  {/* Helper hint for in-map search */}
                  <Typography variant="caption" sx={{ color: "#666" }}>
                    Tip: Use the search bar on the map (top-left) to find your shop.
                  </Typography>

                  {coords && (
                    <Typography variant="caption" sx={{ color: "#666" }}>
                      Pin: {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)} (drag to adjust)
                    </Typography>
                  )}

                  <Button
                    variant="contained"
                    fullWidth
                    startIcon={<Save />}
                    onClick={handleSave}
                    disabled={saving || loading || imageUploading}
                    sx={{
                      py: 1.5,
                      fontWeight: 600,
                      bgcolor: "#1976d2",
                      "&:hover": { bgcolor: "#1565c0" },
                    }}
                  >
                    {saving ? "Saving..." : "Save Store Profile"}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </motion.div>
        </Container>
      </Box>

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert severity={snack.severity} variant="filled" sx={{ width: "100%" }}>
          {snack.message}
        </Alert>
      </Snackbar>
    </MobileAppShell>
  );
}
