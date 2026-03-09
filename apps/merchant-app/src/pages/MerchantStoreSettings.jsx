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
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { GoogleMap, LoadScript, MarkerF } from "@react-google-maps/api";
import { createFirebaseClients } from "../../../../shared/firebase/firebaseClient";

const { auth, db } = createFirebaseClients("MerchantApp");

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
  const [merchantId, setMerchantId] = useState("");
  const [storeData, setStoreData] = useState({
    storeName: "",
    storeDescription: "",
    address: "",
    phone: "",
    city: "",
    open: false,
    latitude: 14.5994, // Default to Manila, Philippines
    longitude: 120.9842,
  });
  const [mapCenter, setMapCenter] = useState({ lat: 14.5994, lng: 120.9842 });
  const [snack, setSnack] = useState({ open: false, severity: "success", message: "" });
  const [geocodingError, setGeocodingError] = useState("");
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate("/login", { replace: true });
        return;
      }

      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          console.error("User not found");
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
          open: userData.open || false,
          latitude,
          longitude,
        });
        setMapCenter({ lat: latitude, lng: longitude });
      } catch (err) {
        console.error("Failed to load store settings:", err);
        setSnack({ open: true, severity: "error", message: "Failed to load store settings" });
      } finally {
        setLoading(false);
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

    // Auto-geocode when address or city changes
    if ((field === "address" || field === "city") && value) {
      const fullAddress = field === "address" ? `${value}, ${storeData.city}` : `${storeData.address}, ${value}`;
      geocodeAddress(fullAddress);
    }
  };

  const geocodeAddress = async (addressString) => {
    const requestId = ++geocodeRequestRef.current;
    try {
      setGeocodingError("");
      const cityHint = String(storeData.city || "").trim().toLowerCase();
      const normalizedAddress = `${String(addressString || "").trim()}, Philippines`;
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(normalizedAddress)}&components=country:PH&region=ph&key=${import.meta.env.REACT_APP_GOOGLE_MAPS_API_KEY}`
      );
      const data = await response.json();

      // Ignore stale results when user is typing quickly.
      if (requestId !== geocodeRequestRef.current) return;

      if (data.status === "OK" && data.results && data.results.length > 0) {
        const preferredResult =
          cityHint.length > 0
            ? data.results.find((result) =>
                String(result.formatted_address || "").toLowerCase().includes(cityHint)
              ) || data.results[0]
            : data.results[0];

        const location = preferredResult.geometry.location;
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
        open: storeData.open,
        latitude: storeData.latitude,
        longitude: storeData.longitude,
        updatedAt: new Date().toISOString(),
      });

      setSnack({ open: true, severity: "success", message: "Store settings updated successfully" });
      setTimeout(() => navigate("/profile"), 1500);
    } catch (err) {
      console.error("Failed to save store settings:", err);
      setSnack({ open: true, severity: "error", message: "Failed to save store settings" });
    } finally {
      setSaving(false);
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
    <Box sx={{ minHeight: "100dvh", bgcolor: "#f6f7f8", pb: 16, paddingTop: "env(safe-area-inset-top, 0)" }}>
      <Paper
        elevation={0}
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          bgcolor: "rgba(255, 255, 255, 0.85)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid #eef2f7",
        }}
      >
        <Box sx={{ px: 2, py: 2, display: "flex", alignItems: "center", gap: 2 }}>
          <IconButton
            onClick={() => navigate("/profile")}
            sx={{ width: 40, height: 40, bgcolor: "#f8fafc", color: "#475569" }}
          >
            <MaterialIcon name="arrow_back" size={22} />
          </IconButton>
          <Typography sx={{ fontSize: "1.25rem", fontWeight: 700, color: "#0f172a" }}>
            Store Settings
          </Typography>
        </Box>
      </Paper>

      <Container maxWidth="sm" sx={{ pt: 3 }}>
        <Stack spacing={3}>
          <Box>
            <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: "#334155", mb: 1 }}>
              Store Name
            </Typography>
            <TextField
              fullWidth
              placeholder="Enter your store name"
              value={storeData.storeName}
              onChange={handleChange("storeName")}
              size="small"
              sx={{
                "& .MuiOutlinedInput-root": {
                  bgcolor: "#fff",
                  "& fieldset": { borderColor: "#cbd5e1" },
                  "&:hover fieldset": { borderColor: "#94a3b8" },
                  "&.Mui-focused fieldset": { borderColor: "#2b7cee" },
                },
              }}
            />
          </Box>

          <Box>
            <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: "#334155", mb: 1 }}>
              Store Description
            </Typography>
            <TextField
              fullWidth
              placeholder="Describe your store business and services"
              value={storeData.storeDescription}
              onChange={handleChange("storeDescription")}
              size="small"
              multiline
              rows={4}
              sx={{
                "& .MuiOutlinedInput-root": {
                  bgcolor: "#fff",
                  "& fieldset": { borderColor: "#cbd5e1" },
                  "&:hover fieldset": { borderColor: "#94a3b8" },
                  "&.Mui-focused fieldset": { borderColor: "#2b7cee" },
                },
              }}
            />
          </Box>

          <Box>
            <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: "#334155", mb: 1 }}>
              Address
            </Typography>
            <TextField
              fullWidth
              placeholder="Store address (drag pin on map to adjust)"
              value={storeData.address}
              onChange={handleChange("address")}
              size="small"
              sx={{
                "& .MuiOutlinedInput-root": {
                  bgcolor: "#fff",
                  "& fieldset": { borderColor: "#cbd5e1" },
                  "&:hover fieldset": { borderColor: "#94a3b8" },
                  "&.Mui-focused fieldset": { borderColor: "#2b7cee" },
                },
              }}
            />
            {geocodingError && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                {geocodingError}
              </Alert>
            )}
          </Box>

          <Box>
            <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: "#334155", mb: 1 }}>
              Store Location (Drag pin to exact location)
            </Typography>
            <Paper sx={{ overflow: "hidden", borderRadius: 1, border: "1px solid #cbd5e1" }}>
              <LoadScript googleMapsApiKey={import.meta.env.REACT_APP_GOOGLE_MAPS_API_KEY || ""}>
                <GoogleMap
                  mapContainerStyle={{ width: "100%", height: "300px" }}
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
            <Box sx={{ mt: 1, p: 1.5, bgcolor: "#f8fafc", borderRadius: 1, border: "1px solid #cbd5e1" }}>
              <Typography sx={{ fontSize: "0.85rem", color: "#475569" }}>
                <strong>Latitude:</strong> {storeData.latitude.toFixed(6)}
              </Typography>
              <Typography sx={{ fontSize: "0.85rem", color: "#475569", mt: 0.5 }}>
                <strong>Longitude:</strong> {storeData.longitude.toFixed(6)}
              </Typography>
            </Box>
          </Box>

          <Box>
            <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: "#334155", mb: 1 }}>
              City
            </Typography>
            <TextField
              fullWidth
              placeholder="City"
              value={storeData.city}
              onChange={handleChange("city")}
              size="small"
              sx={{
                "& .MuiOutlinedInput-root": {
                  bgcolor: "#fff",
                  "& fieldset": { borderColor: "#cbd5e1" },
                  "&:hover fieldset": { borderColor: "#94a3b8" },
                  "&.Mui-focused fieldset": { borderColor: "#2b7cee" },
                },
              }}
            />
          </Box>

          <Box>
            <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: "#334155", mb: 1 }}>
              Phone Number
            </Typography>
            <TextField
              fullWidth
              placeholder="Contact phone number"
              value={storeData.phone}
              onChange={handleChange("phone")}
              size="small"
              sx={{
                "& .MuiOutlinedInput-root": {
                  bgcolor: "#fff",
                  "& fieldset": { borderColor: "#cbd5e1" },
                  "&:hover fieldset": { borderColor: "#94a3b8" },
                  "&.Mui-focused fieldset": { borderColor: "#2b7cee" },
                },
              }}
            />
          </Box>

          <Box
            sx={{
              p: 2,
              bgcolor: "#fff",
              borderRadius: 1,
              border: "1px solid #cbd5e1",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Typography sx={{ fontSize: "0.95rem", fontWeight: 600, color: "#334155" }}>
              Store Open
            </Typography>
            <input
              type="checkbox"
              checked={storeData.open}
              onChange={handleChange("open")}
              style={{
                width: 24,
                height: 24,
                cursor: "pointer",
              }}
            />
          </Box>

          <Stack direction="row" spacing={1.5} sx={{ mt: 3 }}>
            <Button
              variant="outlined"
              onClick={() => navigate("/profile")}
              sx={{
                flex: 1,
                textTransform: "none",
                fontWeight: 600,
                color: "#475569",
                borderColor: "#cbd5e1",
              }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving}
              sx={{
                flex: 1,
                textTransform: "none",
                fontWeight: 600,
                bgcolor: "#2b7cee",
                "&:hover": { bgcolor: "#1e5ab3" },
              }}
            >
              {saving ? <CircularProgress size={20} sx={{ color: "white" }} /> : "Save Changes"}
            </Button>
          </Stack>
        </Stack>
      </Container>

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
