import React, { useEffect, useState, useRef } from "react";
import { useJsApiLoader } from "@react-google-maps/api";
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
  LocationOn,
} from "@mui/icons-material";
import { motion } from "framer-motion";
import MobileAppShell from "../../components/MobileAppShell";
import { auth, db, storage } from "../../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
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
  const autocompleteContainerRef = useRef(null);
  const placeAutocompleteElRef = useRef(null);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "YOUR_API_KEY_HERE",
    libraries: GOOGLE_MAP_LIBRARIES,
  });

  const [storeName, setStoreName] = useState("");
  const [hours, setHours] = useState("");
  const [location, setLocation] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [deliveryRadiusKm, setDeliveryRadiusKm] = useState("");
  const [deliveryRatePerKm, setDeliveryRatePerKm] = useState("");

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
        }
      } catch (err) {
        console.error(err);
        setSnack({ open: true, severity: "error", message: "Failed to load store profile" });
      }
      setLoading(false);
    };

    loadStore();
  }, [uid]);

  // Google Places Autocomplete for location field
  useEffect(() => {
    if (!isLoaded || !autocompleteContainerRef.current) return;
    const placesApi = window.google?.maps?.places;
    const ElementCtor = placesApi?.PlaceAutocompleteElement;
    if (!ElementCtor) return;

    const pac = new ElementCtor();
    pac.placeholder = "Search for your shop location";
    pac.style.width = "100%";
    pac.style.boxSizing = "border-box";
    pac.style.borderRadius = "4px";

    const onSelect = async (e) => {
      const place = e.detail?.place;
      if (!place || !place.fetchFields) return;
      try {
        await place.fetchFields({ fields: ["displayName", "formattedAddress", "location"] });
        const addr = place.formattedAddress || place.displayName || "";
        setLocation(addr);
      } catch (_) {
        // ignore errors
      }
    };

    pac.addEventListener("gmp-placeselect", onSelect);
    autocompleteContainerRef.current.innerHTML = "";
    autocompleteContainerRef.current.appendChild(pac);
    placeAutocompleteElRef.current = pac;

    return () => {
      pac.removeEventListener("gmp-placeselect", onSelect);
      if (placeAutocompleteElRef.current && placeAutocompleteElRef.current.parentNode) {
        placeAutocompleteElRef.current.parentNode.removeChild(placeAutocompleteElRef.current);
      }
      placeAutocompleteElRef.current = null;
    };
  }, [isLoaded]);

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

  const handleSave = async () => {
    if (!uid || !storeName.trim()) {
      setSnack({ open: true, severity: "warning", message: "Store name is required" });
      return;
    }

    setSaving(true);
    try {
      await setDoc(doc(db, "merchants", uid), {
        uid,
        storeName: storeName.trim(),
        hours,
        location,
        coverImage,
        deliveryTime: deliveryTime.trim(),
        deliveryRadiusKm: deliveryRadiusKm ? Number(deliveryRadiusKm) : null,
        deliveryRatePerKm: deliveryRatePerKm ? Number(deliveryRatePerKm) : null,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      setSnack({ open: true, severity: "success", message: "Store profile saved" });
    } catch (err) {
      console.error(err);
      setSnack({ open: true, severity: "error", message: "Failed to save" });
    }
    setSaving(false);
  };

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

                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      p: 1,
                      bgcolor: "#f5f5f5",
                      borderRadius: 1,
                      border: "1px solid #ddd",
                    }}
                  >
                    <LocationOn sx={{ color: "#666" }} />
                    <Box
                      ref={autocompleteContainerRef}
                      sx={{
                        flex: 1,
                        "& gmp-place-autocomplete": {
                          width: "100%",
                        },
                      }}
                    />
                  </Box>
                  {location && (
                    <Typography variant="caption" sx={{ color: "#666", mt: 1 }}>
                      ✓ Selected: {location}
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
