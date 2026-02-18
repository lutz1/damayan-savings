import React, { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleMap, Marker, OverlayView, useJsApiLoader } from "@react-google-maps/api";
import {
  Box,
  Button,
  Container,
  Stack,
  TextField,
  Typography,
  IconButton,
  Snackbar,
  Alert,
  useMediaQuery,
  useTheme,
  InputAdornment,
  CircularProgress,
} from "@mui/material";
import {
  ArrowBack as ArrowBackIcon,
  LocationOn as LocationOnIcon,
  Search as SearchIcon,
  MyLocation as MyLocationIcon,
} from "@mui/icons-material";
import mapImage from "../assets/map.png";

// Keep libraries array stable to avoid reloading LoadScript
const GOOGLE_MAP_LIBRARIES = ["places"];

const mapContainerStyle = {
  width: "100%",
  height: "400px",
};

const defaultCenter = {
  lat: 7.4474, // Tagum City, Davao del Norte
  lng: 125.8077,
};

const AddAddress = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);

  const [mapExpanded, setMapExpanded] = useState(false);
  const [searchMode, setSearchMode] = useState(true); // true = search, false = confirmation
  const [center, setCenter] = useState(defaultCenter);
  const [markerPosition, setMarkerPosition] = useState(defaultCenter);
  const [searchAddress, setSearchAddress] = useState("");
  const [detectedAddress, setDetectedAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [snack, setSnack] = useState({ open: false, message: "", severity: "success" });
  const [markerAnimation, setMarkerAnimation] = useState(null);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.REACT_APP_GOOGLE_MAPS_API_KEY || "YOUR_API_KEY_HERE",
    libraries: GOOGLE_MAP_LIBRARIES,
  });

  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
  }, []);

  const onMarkerLoad = useCallback((marker) => {
    markerRef.current = marker;
  }, []);

  

  const triggerMarkerDrop = useCallback(() => {
    if (!(typeof window !== "undefined" && window.google && window.google.maps && window.google.maps.Animation)) return;
    setMarkerAnimation(window.google.maps.Animation.DROP);
    setTimeout(() => setMarkerAnimation(null), 700);
  }, []);

  // Reverse geocode to get address from coordinates
  const reverseGeocode = useCallback(async (lat, lng) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
      );
      if (response.ok) {
        const data = await response.json();
        return data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      }
    } catch (error) {
      console.error("Reverse geocode error:", error);
    }
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }, []);

  // Handle search address
  const handleSearchAddress = useCallback(async () => {
    if (!searchAddress.trim()) {
      setSnack({ open: true, message: "Please enter an address", severity: "warning" });
      return;
    }

    setLoading(true);
    try {
      // Use OpenStreetMap Nominatim for geocoding
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchAddress)}`
      );
      if (response.ok) {
        const data = await response.json();
        if (data.length > 0) {
          const { lat, lon, display_name } = data[0];
          const newPos = { lat: parseFloat(lat), lng: parseFloat(lon) };
          setCenter(newPos);
          setMarkerPosition(newPos);
          setDetectedAddress(display_name);
          setMapExpanded(true);
          setSearchMode(false);
          if (mapRef.current) {
            mapRef.current.panTo(newPos);
            mapRef.current.setZoom(16);
          }
          triggerMarkerDrop();
        } else {
          setSnack({ open: true, message: "Address not found", severity: "error" });
        }
      }
    } catch (error) {
      setSnack({ open: true, message: "Failed to search address", severity: "error" });
    } finally {
      setLoading(false);
    }
  }, [searchAddress, triggerMarkerDrop]);

  // Handle current location
  const handleUseCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setSnack({ open: true, message: "Geolocation not supported", severity: "error" });
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const newPos = { lat: latitude, lng: longitude };
        setCenter(newPos);
        setMarkerPosition(newPos);

        const address = await reverseGeocode(latitude, longitude);
        setDetectedAddress(address);
        setMapExpanded(true);
        setSearchMode(false);
        if (mapRef.current) {
          mapRef.current.panTo(newPos);
          mapRef.current.setZoom(16);
        }
        triggerMarkerDrop();
        setLoading(false);
      },
      (error) => {
        setSnack({
          open: true,
          message: "Failed to get your location. Please enable location access.",
          severity: "error",
        });
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [reverseGeocode, triggerMarkerDrop]);

  // Auto-locate if permission is already granted (no prompt)
  const autoLocatedRef = useRef(false);
  useEffect(() => {
    if (!isLoaded || autoLocatedRef.current) return;
    if (!("permissions" in navigator) || !navigator.permissions?.query) return;
    navigator.permissions
      .query({ name: "geolocation" })
      .then((status) => {
        if (status.state === "granted") {
          autoLocatedRef.current = true;
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const { latitude, longitude } = position.coords;
              const newPos = { lat: latitude, lng: longitude };
              setCenter(newPos);
              setMarkerPosition(newPos);
              const address = await reverseGeocode(latitude, longitude);
              setDetectedAddress(address);
              setMapExpanded(true);
              setSearchMode(false);
              if (mapRef.current) {
                mapRef.current.panTo(newPos);
                mapRef.current.setZoom(16);
              }
              triggerMarkerDrop();
            },
            () => {}
          );
        }
      })
      .catch(() => {});
  }, [isLoaded, reverseGeocode, triggerMarkerDrop]);

  // Inject pulsing CSS once
  useEffect(() => {
    if (typeof document === "undefined") return;
    const styleId = "gm-pulse-style";
    if (document.getElementById(styleId)) return;
    const css = `
      .gm-pulse-wrap { position: absolute; transform: translate(-50%, -50%); pointer-events: none; }
      .gm-pulse { position: relative; width: 16px; height: 16px; }
      .gm-pulse .dot { position: absolute; width: 10px; height: 10px; border-radius: 50%; background: #4285F4; top: 50%; left: 50%; transform: translate(-50%, -50%); box-shadow: 0 0 0 2px #ffffff, 0 0 6px rgba(0,0,0,0.3); }
      .gm-pulse .ring { position: absolute; width: 16px; height: 16px; border-radius: 50%; background: rgba(66,133,244,0.45); top: 50%; left: 50%; transform: translate(-50%, -50%); animation: gm-pulse 2s ease-out infinite; }
      @keyframes gm-pulse { 0% { transform: translate(-50%, -50%) scale(0.6); opacity: 0.9; } 70% { transform: translate(-50%, -50%) scale(2.2); opacity: 0; } 100% { transform: translate(-50%, -50%) scale(2.2); opacity: 0; } }
    `;
    const styleEl = document.createElement("style");
    styleEl.id = styleId;
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
  }, []);

  // Google Places Autocomplete on the search input
  useEffect(() => {
    if (!isLoaded || !inputRef.current || !(window.google && window.google.maps && window.google.maps.places)) return;
    const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
      fields: ["geometry", "formatted_address", "name"],
      // Limit to the Philippines (optional). Remove or adjust as needed.
      // componentRestrictions: { country: ["ph"] },
    });
    autocompleteRef.current = ac;
    const listener = ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      if (!place || !place.geometry) return;
      const loc = place.geometry.location;
      const newPos = { lat: loc.lat(), lng: loc.lng() };
      setCenter(newPos);
      setMarkerPosition(newPos);
      setDetectedAddress(place.formatted_address || place.name || "");
      setMapExpanded(true);
      setSearchMode(false);
      if (mapRef.current) {
        mapRef.current.panTo(newPos);
        mapRef.current.setZoom(16);
      }
      triggerMarkerDrop();
    });
    return () => {
      if (listener) listener.remove();
    };
  }, [isLoaded, triggerMarkerDrop]);

  // Handle back arrow click
  const handleBackClick = useCallback(() => {
    if (mapExpanded && !searchMode) {
      // Toggle back to search mode
      setSearchMode(true);
      setMapExpanded(false);
    } else {
      // Go back to previous page
      navigate(-1);
    }
  }, [mapExpanded, searchMode, navigate]);

  // Confirm location and save
  const handleConfirmLocation = useCallback(async () => {
    setLoading(true);
    
    // Get final address from current marker position
    const address = await reverseGeocode(markerPosition.lat, markerPosition.lng);
    
    // Save to localStorage
    const savedAddresses = JSON.parse(localStorage.getItem("savedAddresses") || "[]");
    const newAddresses = [...savedAddresses, address];
    localStorage.setItem("savedAddresses", JSON.stringify(newAddresses));

    // Also save as selected delivery address
    localStorage.setItem("selectedDeliveryAddress", address);

    setSnack({
      open: true,
      message: "Location saved successfully!",
      severity: "success",
    });

    setLoading(false);
    setTimeout(() => {
      navigate(-1);
    }, 1500);
  }, [markerPosition, reverseGeocode, navigate]);

  if (!isLoaded) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#f5f5f5" }}>
      {/* Google Map - Full Width */}
      <Box sx={{ position: "relative", width: "100%", height: mapExpanded ? "60vh" : "400px", transition: "height 0.3s ease" }}>
        <GoogleMap
          mapContainerStyle={{ ...mapContainerStyle, height: mapExpanded ? "60vh" : "400px" }}
          center={center}
          zoom={16}
          onLoad={onMapLoad}
          options={{
            disableDefaultUI: false,
            zoomControl: true,
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
          }}
        >
          <Marker
            position={markerPosition}
            onLoad={onMarkerLoad}
            draggable={true}
            /* Use default Google pin for maximum compatibility */
            animation={markerAnimation || undefined}
            visible={true}
            onDragEnd={(e) => {
              const newPos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
              setMarkerPosition(newPos);
              setCenter(newPos);
              reverseGeocode(newPos.lat, newPos.lng).then(setDetectedAddress);
              if (typeof window !== "undefined" && window.google && window.google.maps && window.google.maps.Animation) {
                setMarkerAnimation(window.google.maps.Animation.BOUNCE);
                setTimeout(() => setMarkerAnimation(null), 700);
              }
            }}
            zIndex={2}
          />
          {/* Current location pulsing indicator */}
          {markerPosition && (
            <OverlayView position={markerPosition} mapPaneName="markerLayer">
              <div className="gm-pulse-wrap">
                <div className="gm-pulse">
                  <div className="ring" />
                  <div className="dot" />
                </div>
              </div>
            </OverlayView>
          )}
        </GoogleMap>

        {/* Back Arrow + Search Bar Overlay */}
        <Box
          sx={{
            position: "absolute",
            top: 16,
            left: 16,
            right: 16,
            zIndex: 10,
            display: "flex",
            gap: 1,
            alignItems: "center",
          }}
        >
          <IconButton
            onClick={handleBackClick}
            sx={{
              bgcolor: "white",
              boxShadow: 2,
              "&:hover": { bgcolor: "#f5f5f5" },
            }}
          >
            <ArrowBackIcon />
          </IconButton>

          {searchMode ? (
            <TextField
              fullWidth
              placeholder="Enter your address"
              value={searchAddress}
              onChange={(e) => setSearchAddress(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") handleSearchAddress();
              }}
              inputRef={inputRef}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={handleSearchAddress} edge="end">
                      <SearchIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{
                bgcolor: "white",
                borderRadius: 1,
                "& .MuiOutlinedInput-root": {
                  "& fieldset": { border: "none" },
                },
                boxShadow: 2,
              }}
            />
          ) : (
            <Box
              sx={{
                flex: 1,
                bgcolor: "white",
                borderRadius: 1,
                boxShadow: 2,
                p: 1.5,
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              <LocationOnIcon sx={{ color: "#e91e63" }} />
              <Typography variant="body2" sx={{ flex: 1, fontSize: isMobile ? "0.85rem" : "0.95rem" }}>
                Is this your location? See restaurants and shops in this area, and get your order delivered here.
              </Typography>
              <IconButton size="small" onClick={() => setSearchMode(true)}>
                <SearchIcon />
              </IconButton>
            </Box>
          )}
        </Box>
      </Box>

      {/* Content Below Map */}
      <Container maxWidth="sm" sx={{ py: 3 }}>
        {searchMode ? (
          <Stack spacing={3} alignItems="center">
            {/* Map Icon Placeholder */}
            <Box
              component="img"
              src={mapImage}
              alt="map"
              sx={{ width: 120, height: 120, objectFit: "contain" }}
            />

            <Typography
              variant="body1"
              textAlign="center"
              sx={{ color: "#666", maxWidth: 400, fontSize: isMobile ? "0.95rem" : "1rem" }}
            >
              Enter an address to explore restaurants around you
            </Typography>

            <Button
              fullWidth
              variant="outlined"
              startIcon={loading ? <CircularProgress size={20} /> : <MyLocationIcon />}
              onClick={handleUseCurrentLocation}
              disabled={loading}
              sx={{
                py: 1.5,
                textTransform: "none",
                fontWeight: 600,
                borderColor: "#e91e63",
                color: "#e91e63",
                "&:hover": {
                  borderColor: "#c2185b",
                  bgcolor: "#fce4ec",
                },
              }}
            >
              {loading ? "Getting location..." : "Use my current location"}
            </Button>
          </Stack>
        ) : (
          <Stack spacing={2}>
            {/* Detected Address Display */}
            <Box
              sx={{
                p: 2,
                bgcolor: "white",
                borderRadius: 1,
                boxShadow: 1,
              }}
            >
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                Selected Location
              </Typography>
              <Typography variant="body2" sx={{ color: "#666" }}>
                {detectedAddress}
              </Typography>
            </Box>

            {/* Note */}
            <Alert severity="info" sx={{ fontSize: isMobile ? "0.85rem" : "0.9rem" }}>
              <strong>Note:</strong> Your rider will deliver to the pinned location. You can edit your written
              address on the next page.
            </Alert>

            {/* Confirm Button */}
            <Button
              fullWidth
              variant="contained"
              color="primary"
              onClick={handleConfirmLocation}
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} /> : <LocationOnIcon />}
              sx={{
                py: 1.5,
                fontWeight: 600,
                textTransform: "none",
                bgcolor: "#e91e63",
                "&:hover": { bgcolor: "#c2185b" },
              }}
            >
              {loading ? "Saving..." : "Confirm Location"}
            </Button>
          </Stack>
        )}
      </Container>

      {/* Snackbar */}
      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnack({ ...snack, open: false })}
          severity={snack.severity}
          sx={{ width: "100%" }}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AddAddress;
