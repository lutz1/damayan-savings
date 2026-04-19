import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { GoogleMap, LoadScript, MarkerF } from "@react-google-maps/api";
import { auth, db, storage } from "../../firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import OperationHoursEditor from "./components/OperationHoursEditor";

const MaterialIcon = ({ name, size = 24, sx = {} }) => (
  <span
    className="material-symbols-outlined"
    style={{
      fontSize: size,
      fontVariationSettings: "'FILL' 0, 'wght' 400",
      ...sx,
    }}
  >
    {name}
  </span>
);

const isValidGoogleMapId = (value) => {
  const mapId = String(value || "").trim();
  if (!mapId) return false;
  if (mapId === "your_real_map_id_here") return false;
  if (mapId === "YOUR_GOOGLE_MAPS_MAP_ID_HERE") return false;
  return mapId.length >= 8;
};

const MerchantStoreSettings = () => {
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const geocodeRequestRef = useRef(0);
  const googleMapsMapId = import.meta.env.REACT_APP_GOOGLE_MAPS_MAP_ID;
  const useAdvancedMarker = isValidGoogleMapId(googleMapsMapId);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [merchantId, setMerchantId] = useState("");
  const [storeData, setStoreData] = useState({
    storeName: "",
    storeDescription: "",
    address: "",
    phone: "",
    city: "",
    email: "",
    open: false,
    storeBannerImage: "",
    storeLogo: "",
    latitude: 14.5994,
    longitude: 120.9842,
    preparationTime: "",
    category: "",
    operationHours: {
      monday: { open: "09:00", close: "18:00", closed: false },
      tuesday: { open: "09:00", close: "18:00", closed: false },
      wednesday: { open: "09:00", close: "18:00", closed: false },
      thursday: { open: "09:00", close: "18:00", closed: false },
      friday: { open: "09:00", close: "18:00", closed: false },
      saturday: { open: "10:00", close: "17:00", closed: false },
      sunday: { open: "10:00", close: "17:00", closed: true },
    },
  });
  const [mapCenter, setMapCenter] = useState({ lat: 14.5994, lng: 120.9842 });
  const [snack, setSnack] = useState({ open: false, severity: "success", message: "" });
  const [geocodingError, setGeocodingError] = useState("");
  const [mapLoaded, setMapLoaded] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate("/login", { replace: true });
        return;
      }

      try {
        const userRef = doc(db, "users", user.uid);
        // Use onSnapshot for real-time updates instead of one-time getDoc
        const unsubscribeSnapshot = onSnapshot(
          userRef,
          (userSnap) => {
            if (!userSnap.exists()) {
              console.warn("User document does not exist. Creating with defaults...");
              setLoading(false);
              return;
            }

            const userData = userSnap.data();
            const latitude = userData.latitude || 14.5994;
            const longitude = userData.longitude || 120.9842;

            setMerchantId(user.uid);
            setStoreData({
              storeName: userData.storeName || "",
              storeDescription: userData.storeDescription || "",
              address: userData.address || "",
              phone: userData.phone || userData.contactNumber || "",
              city: userData.city || "",
              email: userData.email || "",
              open: userData.open || false,
              storeBannerImage: userData.storeBannerImage || "",
              storeLogo: userData.storeLogo || "",
              latitude,
              longitude,
              preparationTime: userData.preparationTime || "",
              category: userData.category || "",
              operationHours: userData.operationHours || {
                monday: { open: "09:00", close: "18:00", closed: false },
                tuesday: { open: "09:00", close: "18:00", closed: false },
                wednesday: { open: "09:00", close: "18:00", closed: false },
                thursday: { open: "09:00", close: "18:00", closed: false },
                friday: { open: "09:00", close: "18:00", closed: false },
                saturday: { open: "10:00", close: "17:00", closed: false },
                sunday: { open: "10:00", close: "17:00", closed: true },
              },
            });
            setMapCenter({ lat: latitude, lng: longitude });
            setLoading(false);
          },
          (err) => {
            console.error("Failed to load store settings:", err?.message || err, err?.code || "");
            console.warn("User UID:", user.uid);
            setSnack({ 
              open: true, 
              severity: "error", 
              message: `Failed to load store settings: ${err?.code === "permission-denied" ? "Permission denied - check Firestore rules" : err?.message || "Unknown error"}` 
            });
            setLoading(false);
          }
        );

        return () => unsubscribeSnapshot();
      } catch (err) {
        console.error("Failed to setup listener:", err);
        setSnack({ open: true, severity: "error", message: "Failed to setup listener" });
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  // Initialize AdvancedMarkerElement when map and Google are loaded.
  useEffect(() => {
    if (!useAdvancedMarker || !mapRef.current || !mapLoaded || !window.google) return;

    const initializeMarker = async () => {
      try {
        const { AdvancedMarkerElement } = await window.google.maps.importLibrary("marker");

        const markerContent = document.createElement("div");
        markerContent.innerHTML = `
          <div style="
            width: 36px;
            height: 36px;
            background-color: #2b7cee;
            border: 3px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: move;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          ">
            <div style="
              width: 8px;
              height: 8px;
              background-color: white;
              border-radius: 50%;
            "></div>
          </div>
        `;

        if (markerRef.current) {
          markerRef.current.map = null;
        }

        const marker = new AdvancedMarkerElement({
          map: mapRef.current,
          position: mapCenter,
          content: markerContent,
          title: "Drag to set store location",
          gmpDraggable: true,
        });

        marker.addListener("dragend", () => {
          const position = marker.position;
          if (position) {
            const lat = Number(position.lat);
            const lng = Number(position.lng);
            setStoreData((prev) => ({ ...prev, latitude: lat, longitude: lng }));
            setMapCenter({ lat, lng });
            reverseGeocodeCoordinates(lat, lng);
          }
        });

        markerRef.current = marker;
      } catch (err) {
        console.warn("Failed to initialize advanced marker:", err);
      }
    };

    initializeMarker().catch((err) => {
      console.error("Failed to initialize marker:", err);
    });

    return () => {
      if (markerRef.current) {
        markerRef.current.map = null;
      }
    };
  }, [mapLoaded, mapCenter, useAdvancedMarker]);

  const handleChange = (field) => (e) => {
    const value = field === "open" ? e.target.checked : e.target.value;
    setStoreData((prev) => ({ ...prev, [field]: value }));

    // Auto-geocode when address changes
    if (field === "address" && value) {
      geocodeAddress(value);
    }
  };

  const handleOperationHourChange = (day, field, value) => {
    setStoreData((prev) => ({
      ...prev,
      operationHours: {
        ...prev.operationHours,
        [day]: {
          ...prev.operationHours[day],
          [field]: value,
        },
      },
    }));
  };

  const toggleDayStatus = (day) => {
    setStoreData((prev) => ({
      ...prev,
      operationHours: {
        ...prev.operationHours,
        [day]: {
          ...prev.operationHours[day],
          closed: !prev.operationHours[day].closed,
        },
      },
    }));
  };

  const handleLocationSelect = (selectedLocation) => {
    if (selectedLocation) {
      setStoreData((prev) => ({
        ...prev,
        address: selectedLocation.address || prev.address,
        latitude: selectedLocation.latitude || prev.latitude,
        longitude: selectedLocation.longitude || prev.longitude,
      }));
      setMapCenter({ 
        lat: selectedLocation.latitude || storeData.latitude, 
        lng: selectedLocation.longitude || storeData.longitude 
      });
    }
  };

  const geocodeAddress = async (addressString) => {
    const requestId = ++geocodeRequestRef.current;
    try {
      setGeocodingError("");
      const normalizedAddress = `${String(addressString || "").trim()}, Philippines`;
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(normalizedAddress)}&components=country:PH&region=ph&key=${import.meta.env.REACT_APP_GOOGLE_MAPS_API_KEY}`
      );
      const data = await response.json();

      // Ignore stale results when user is typing quickly.
      if (requestId !== geocodeRequestRef.current) return;

      if (data.status === "OK" && data.results && data.results.length > 0) {
        const location = data.results[0].geometry.location;
        setStoreData((prev) => ({
          ...prev,
          latitude: location.lat,
          longitude: location.lng,
        }));
        setMapCenter({ lat: location.lat, lng: location.lng });
        if (mapRef.current?.panTo) {
          mapRef.current.panTo({ lat: location.lat, lng: location.lng });
        }
      } else {
        setGeocodingError("Address not found. Please adjust and try again.");
      }
    } catch (err) {
      console.error("Geocoding error:", err);
      setGeocodingError("Failed to geocode address");
    }
  };

  const handleMarkerDragEnd = (e) => {
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setStoreData((prev) => ({
      ...prev,
      latitude: lat,
      longitude: lng,
    }));
    setMapCenter({ lat, lng });

    // Reverse geocode to update address
    reverseGeocodeCoordinates(lat, lng);
  };

  const reverseGeocodeCoordinates = async (lat, lng) => {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${import.meta.env.REACT_APP_GOOGLE_MAPS_API_KEY}`
      );
      const data = await response.json();

      if (data.results && data.results.length > 0) {
        const address = data.results[0].formatted_address;
        setStoreData((prev) => ({
          ...prev,
          address,
        }));
      }
    } catch (err) {
      console.error("Reverse geocoding error:", err);
    }
  };

  const handleSave = async () => {
    if (!merchantId) return;

    try {
      setSaving(true);
      const userRef = doc(db, "users", merchantId);
      await updateDoc(userRef, {
        storeName: storeData.storeName,
        storeDescription: storeData.storeDescription,
        address: storeData.address,
        phone: storeData.phone,
        city: storeData.city,
        email: storeData.email,
        open: storeData.open,
        storeBannerImage: storeData.storeBannerImage,
        storeLogo: storeData.storeLogo,
        latitude: storeData.latitude,
        longitude: storeData.longitude,
        preparationTime: storeData.preparationTime,
        category: storeData.category,
        operationHours: storeData.operationHours,
        updatedAt: new Date().toISOString(),
      });

      setSnack({ open: true, severity: "success", message: "Store settings updated successfully" });
      setTimeout(() => navigate("/merchant/profile"), 1500);
    } catch (err) {
      console.error("Failed to save store settings:", err?.message || err);
      setSnack({ open: true, severity: "error", message: `Failed to save store settings: ${err?.message || "Unknown error"}` });
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (type, file) => {
    if (!file || !merchantId) return;

    try {
      if (type === "banner") setBannerUploading(true);
      if (type === "logo") setLogoUploading(true);

      const fileName = `merchant-${type}-${Date.now()}_${file.name}`;
      const fileRef = ref(storage, `stores/${merchantId}/${fileName}`);

      await uploadBytes(fileRef, file);
      const url = await getDownloadURL(fileRef);

      setStoreData((prev) => ({
        ...prev,
        [type === "banner" ? "storeBannerImage" : "storeLogo"]: url,
      }));

      setSnack({
        open: true,
        severity: "success",
        message: `${type === "banner" ? "Banner" : "Logo"} uploaded successfully`,
      });
    } catch (err) {
      console.error(`Failed to upload ${type}:`, err);
      setSnack({
        open: true,
        severity: "error",
        message: `Failed to upload ${type}`,
      });
    } finally {
      if (type === "banner") setBannerUploading(false);
      if (type === "logo") setLogoUploading(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "#f6f7f8", pb: 20, paddingTop: "env(safe-area-inset-top, 0)" }}>
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          bgcolor: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid #e2e8f0",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <IconButton size="small" onClick={() => navigate("/merchant/profile")}>
            <MaterialIcon name="arrow_back" size={22} />
          </IconButton>
          <Typography sx={{ fontSize: "1.1rem", fontWeight: 700, color: "#0f172a" }}>
            My Store
          </Typography>
        </Box>
        <Button
          onClick={handleSave}
          disabled={saving}
          sx={{
            textTransform: "none",
            fontWeight: 700,
            bgcolor: "#2b7cee",
            color: "#fff",
            px: 3,
            py: 0.75,
            borderRadius: "20px",
            fontSize: "0.85rem",
            "&:hover": { bgcolor: "#1e5ab3" },
            "&:disabled": { opacity: 0.6 },
          }}
        >
          {saving ? "Saving..." : "Save"}
        </Button>
      </Paper>

      {/* Banner & Logo Section */}
      <Box sx={{ bgcolor: "#fff", borderBottom: "1px solid #e2e8f0" }}>
        {/* Banner */}
        <Box
          component="label"
          sx={{
            position: "relative",
            width: "100%",
            height: 180,
            bgcolor: "#e2e8f0",
            overflow: "hidden",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            "&:hover .banner-overlay": { opacity: 1 },
          }}
        >
          {storeData.storeBannerImage ? (
            <img
              src={storeData.storeBannerImage}
              alt="Store banner"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                opacity: 0.85,
              }}
            />
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", color: "#64748b" }}>
              <MaterialIcon name="image" size={40} />
              <Typography sx={{ fontSize: "0.75rem", mt: 1 }}>Add Banner</Typography>
            </Box>
          )}
          {bannerUploading && (
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                bgcolor: "rgba(0,0,0,0.5)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                zIndex: 10,
              }}
            >
              <CircularProgress sx={{ color: "#fff", mb: 1 }} />
              <Typography sx={{ fontSize: "0.75rem", fontWeight: 600 }}>Uploading Banner...</Typography>
            </Box>
          )}
          <Box
            className="banner-overlay"
            sx={{
              position: "absolute",
              inset: 0,
              bgcolor: "rgba(0,0,0,0.3)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              opacity: bannerUploading ? 0 : 0,
              transition: "opacity 200ms",
            }}
          >
            <MaterialIcon name="photo_camera" size={32} />
            <Typography sx={{ fontSize: "0.75rem", mt: 1 }}>Change Banner</Typography>
          </Box>
          <input
            hidden
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageUpload("banner", file);
            }}
            disabled={bannerUploading}
          />
        </Box>

        {/* Logo */}
        <Box sx={{ px: 4, pb: 4, pt: -6, position: "relative", display: "flex", alignItems: "flex-end", gap: 2 }}>
          <Box
            component="label"
            sx={{
              position: "relative",
              mt: -12,
              width: 96,
              height: 96,
              borderRadius: "50%",
              border: "4px solid #fff",
              bgcolor: "#e2e8f0",
              overflow: "hidden",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              "&:hover .logo-overlay": { opacity: 1 },
            }}
          >
            {storeData.storeLogo ? (
              <img
                src={storeData.storeLogo}
                alt="Store logo"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            ) : (
              <MaterialIcon name="store" size={40} />
            )}
            {logoUploading && (
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  bgcolor: "rgba(0,0,0,0.5)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  zIndex: 10,
                  borderRadius: "50%",
                }}
              >
                <CircularProgress size={32} sx={{ color: "#fff" }} />
              </Box>
            )}
            <Box
              className="logo-overlay"
              sx={{
                position: "absolute",
                inset: 0,
                bgcolor: "rgba(0,0,0,0.4)",
                display: logoUploading ? "none" : "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: 0,
                transition: "opacity 200ms",
              }}
            >
              <MaterialIcon name="edit" size={24} sx={{ color: "#fff" }} />
            </Box>
            <input
              hidden
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageUpload("logo", file);
              }}
              disabled={logoUploading}
            />
          </Box>
          <Box>
            <Typography sx={{ fontSize: "1.1rem", fontWeight: 700, color: "#0f172a" }}>
              {storeData.storeName || "Your Store"}
            </Typography>
            <Typography sx={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 500 }}>
              Store ID: #{merchantId.slice(-6).toUpperCase()}
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Content */}
      <Container maxWidth="sm" sx={{ pt: 4, pb: 4 }}>
        <Stack spacing={4}>
          {/* Store Information */}
          <Box>
            <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#2b7cee", mb: 2 }}>
              Store Information
            </Typography>
            <Stack spacing={3}>
              <Box>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", mb: 0.75 }}>
                  Store Name
                </Typography>
                <TextField
                  fullWidth
                  placeholder="Enter store name"
                  value={storeData.storeName}
                  onChange={handleChange("storeName")}
                  size="small"
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      bgcolor: "#fff",
                      borderRadius: "12px",
                      "& fieldset": { borderColor: "#cbd5e1" },
                      "&:hover fieldset": { borderColor: "#94a3b8" },
                      "&.Mui-focused fieldset": { borderColor: "#2b7cee", borderWidth: 2 },
                    },
                  }}
                />
              </Box>

              <Box>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", mb: 0.75 }}>
                  Store Description
                </Typography>
                <TextField
                  fullWidth
                  placeholder="Describe your store and services"
                  value={storeData.storeDescription}
                  onChange={handleChange("storeDescription")}
                  size="small"
                  multiline
                  rows={3}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      bgcolor: "#fff",
                      borderRadius: "12px",
                      "& fieldset": { borderColor: "#cbd5e1" },
                      "&:hover fieldset": { borderColor: "#94a3b8" },
                      "&.Mui-focused fieldset": { borderColor: "#2b7cee", borderWidth: 2 },
                    },
                  }}
                />
              </Box>

              {/* Store Details */}
              <Box>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", mb: 0.75 }}>
                  Preparation Time
                </Typography>
                <TextField
                  fullWidth
                  placeholder="e.g., 15-20 min"
                  value={storeData.preparationTime}
                  onChange={handleChange("preparationTime")}
                  size="small"
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      bgcolor: "#fff",
                      borderRadius: "12px",
                      "& fieldset": { borderColor: "#cbd5e1" },
                      "&:hover fieldset": { borderColor: "#94a3b8" },
                      "&.Mui-focused fieldset": { borderColor: "#2b7cee", borderWidth: 2 },
                    },
                  }}
                />
              </Box>

              <Box>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", mb: 0.75 }}>
                  Category
                </Typography>
                <TextField
                  fullWidth
                  placeholder="e.g., Restaurant, Food"
                  value={storeData.category}
                  onChange={handleChange("category")}
                  size="small"
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      bgcolor: "#fff",
                      borderRadius: "12px",
                      "& fieldset": { borderColor: "#cbd5e1" },
                      "&:hover fieldset": { borderColor: "#94a3b8" },
                      "&.Mui-focused fieldset": { borderColor: "#2b7cee", borderWidth: 2 },
                    },
                  }}
                />
              </Box>

              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                <Box>
                  <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", mb: 0.75 }}>
                    Phone
                  </Typography>
                  <TextField
                    fullWidth
                    placeholder="+63 9xx xxx xxxx"
                    value={storeData.phone}
                    onChange={handleChange("phone")}
                    size="small"
                    type="tel"
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        bgcolor: "#fff",
                        borderRadius: "12px",
                        "& fieldset": { borderColor: "#cbd5e1" },
                        "&:hover fieldset": { borderColor: "#94a3b8" },
                        "&.Mui-focused fieldset": { borderColor: "#2b7cee", borderWidth: 2 },
                      },
                    }}
                  />
                </Box>

                <Box>
                  <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", mb: 0.75 }}>
                    Email
                  </Typography>
                  <TextField
                    fullWidth
                    placeholder="store@example.com"
                    value={storeData.email}
                    onChange={handleChange("email")}
                    size="small"
                    type="email"
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        bgcolor: "#fff",
                        borderRadius: "12px",
                        "& fieldset": { borderColor: "#cbd5e1" },
                        "&:hover fieldset": { borderColor: "#94a3b8" },
                        "&.Mui-focused fieldset": { borderColor: "#2b7cee", borderWidth: 2 },
                      },
                    }}
                  />
                </Box>
              </Box>
            </Stack>
          </Box>

          {/* Store Location */}
          <Box>
            <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#2b7cee", mb: 2 }}>
              Store Location
            </Typography>

            <Stack spacing={2}>
              <Box>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", mb: 0.75 }}>
                  Address
                </Typography>
                <TextField
                  fullWidth
                  placeholder="Street address"
                  value={storeData.address}
                  onChange={handleChange("address")}
                  size="small"
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      bgcolor: "#fff",
                      borderRadius: "12px",
                      "& fieldset": { borderColor: "#cbd5e1" },
                      "&:hover fieldset": { borderColor: "#94a3b8" },
                      "&.Mui-focused fieldset": { borderColor: "#2b7cee", borderWidth: 2 },
                    },
                  }}
                />
              </Box>

              {geocodingError && (
                <Alert severity="warning" sx={{ borderRadius: "12px" }}>
                  {geocodingError}
                </Alert>
              )}

              <Paper sx={{ overflow: "hidden", borderRadius: "12px", border: "1px solid #e2e8f0", height: 240 }}>
                <LoadScript googleMapsApiKey={import.meta.env.REACT_APP_GOOGLE_MAPS_API_KEY || ""}>
                  <GoogleMap
                    mapContainerStyle={{ width: "100%", height: "100%" }}
                    center={mapCenter}
                    zoom={15}
                    ref={mapRef}
                    mapId={useAdvancedMarker ? googleMapsMapId : undefined}
                    onLoad={(map) => {
                      mapRef.current = map;
                      setMapLoaded(true);
                    }}
                  >
                    {!useAdvancedMarker && (
                      <MarkerF
                        position={mapCenter}
                        draggable
                        onDragEnd={handleMarkerDragEnd}
                        title="Drag to set store location"
                      />
                    )}
                  </GoogleMap>
                </LoadScript>
              </Paper>

              <Box sx={{ p: 2, bgcolor: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                <Typography sx={{ fontSize: "0.8rem", color: "#475569", mb: 1 }}>
                  <strong>Latitude:</strong> {storeData.latitude.toFixed(6)}
                </Typography>
                <Typography sx={{ fontSize: "0.8rem", color: "#475569" }}>
                  <strong>Longitude:</strong> {storeData.longitude.toFixed(6)}
                </Typography>
              </Box>
            </Stack>
          </Box>

          {/* Operation Hours */}
          <Box>
            <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#2b7cee", mb: 2 }}>
              Operation Hours
            </Typography>
            <OperationHoursEditor
              operationHours={storeData.operationHours}
              onUpdate={handleOperationHourChange}
            />
          </Box>

          {/* Store Status */}
          <Box
            sx={{
              p: 2,
              bgcolor: "#fff",
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Box>
              <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: "#0f172a" }}>
                Store Status
              </Typography>
              <Typography sx={{ fontSize: "0.75rem", color: "#64748b", mt: 0.25 }}>
                {storeData.open ? "Currently Online" : "Currently Offline"}
              </Typography>
            </Box>
            <Box
              component="label"
              sx={{
                position: "relative",
                display: "inline-flex",
                width: 56,
                height: 28,
                bgcolor: storeData.open ? "#d1fae5" : "#f3f4f6",
                borderRadius: "14px",
                cursor: "pointer",
                transition: "background-color 200ms",
              }}
            >
              <input
                type="checkbox"
                checked={storeData.open}
                onChange={handleChange("open")}
                style={{
                  display: "none",
                }}
              />
              <Box
                sx={{
                  position: "absolute",
                  width: 24,
                  height: 24,
                  bgcolor: storeData.open ? "#10b981" : "#9ca3af",
                  borderRadius: "50%",
                  top: 2,
                  left: storeData.open ? 30 : 2,
                  transition: "left 200ms",
                }}
              />
            </Box>
          </Box>
        </Stack>
      </Container>

      {/* Snackbar */}
      <Snackbar
        open={snack.open}
        autoHideDuration={3500}
        onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snack.severity} variant="filled">
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default MerchantStoreSettings;
