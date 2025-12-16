import React, { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
  CircularProgress,
  Alert,
} from "@mui/material";
import { LocationOn as LocationOnIcon, Check as CheckIcon, Add as AddIcon } from "@mui/icons-material";

const ShopLocationDialog = ({
  open,
  onClose,
  savedAddresses,
  onSelectAddress,
  onAddAddress,
}) => {
  const navigate = useNavigate();
  const [currentLocationData, setCurrentLocationData] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [selectedCoords, setSelectedCoords] = useState(null);
  const mapContainerRef = useRef(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  // Platform/permission helpers
  const isIOS = React.useMemo(() => {
    if (typeof window === "undefined") return false;
    const ua = window.navigator.userAgent;
    const isAppleTouch = ua.includes("Mac") && "ontouchend" in window;
    return /iPad|iPhone|iPod/.test(ua) || isAppleTouch;
  }, []);
  const [geoPermission, setGeoPermission] = useState(null); // granted | prompt | denied | null

  React.useEffect(() => {
    let unsub;
    try {
      if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions
          .query({ name: "geolocation" })
          .then((res) => {
            setGeoPermission(res.state);
            res.onchange = () => setGeoPermission(res.state);
            unsub = () => (res.onchange = null);
          })
          .catch(() => {});
      }
    } catch {}
    return () => {
      if (unsub) unsub();
    };
  }, []);

  const handleAddNewAddress = () => {
    navigate("/shop/add-address");
    onClose();
  };

  const handleGetCurrentLocation = () => {
    setLocationLoading(true);
    setLocationError("");

    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      setLocationLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          setSelectedCoords({ lat: latitude, lng: longitude });

          // Try to reverse geocode using a free service
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );

          if (response.ok) {
            const data = await response.json();
            const fullAddress = data.address?.road
              ? `${data.address.road}, ${data.address.city || data.address.county || ""}`
              : data.display_name;

            // Extract city and province for display
            const city = data.address?.city || data.address?.county || data.address?.town || "Location";
            const province = data.address?.state || data.address?.province || "";
            const cityProvince = province ? `${city}, ${province}` : city;

            setCurrentLocationData({ 
              address: fullAddress, 
              cityProvince,
              latitude, 
              longitude 
            });
            onSelectAddress({ address: fullAddress, cityProvince });
            setLocationLoading(false);
          } else {
            throw new Error("Failed to get address");
          }
        } catch (err) {
          // Fallback: show coordinates
          const { latitude, longitude } = position.coords;
          const coordAddress = `Lat: ${latitude.toFixed(4)}, Lon: ${longitude.toFixed(4)}`;
          setCurrentLocationData({ 
            address: coordAddress, 
            cityProvince: "Coordinates",
            latitude, 
            longitude 
          });
          onSelectAddress({ address: coordAddress, cityProvince: "Coordinates" });
          setLocationLoading(false);
        }
      },
      (error) => {
        setLocationLoading(false);
        // Don't show permission denied error - let user try again
        if (error.code === error.PERMISSION_DENIED) {
          setLocationError("Location access denied. Please tap the button again and allow access when prompted.");
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setLocationError("Location information is unavailable. Please try again.");
        } else if (error.code === error.TIMEOUT) {
          setLocationError("Location request timed out. Please try again.");
        } else {
          setLocationError("Unable to retrieve your location. Please try again.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  const initializeMap = useCallback(() => {
    if (!mapContainerRef.current || !selectedCoords) return;

    const { lat, lng } = selectedCoords;

    // Initialize map
    const map = window.L.map(mapContainerRef.current, {
      center: [lat, lng],
      zoom: 15,
      dragging: false,
      doubleClickZoom: false,
      scrollWheelZoom: false,
      touchZoom: false,
    });

    // Add OpenStreetMap tiles
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    // Add marker
    window.L.marker([lat, lng])
      .addTo(map)
      .bindPopup("Your Location")
      .openPopup();
  }, [selectedCoords]);

  // Load minimap when coordinates are available
  React.useEffect(() => {
    if (selectedCoords && mapContainerRef.current && typeof window !== "undefined") {
      // Dynamically load Leaflet library
      if (!window.L) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
        document.head.appendChild(link);

        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
        script.onload = () => {
          initializeMap();
        };
        document.head.appendChild(script);
      } else {
        initializeMap();
      }
    }
  }, [selectedCoords, initializeMap]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="100%"
      PaperProps={{
        sx: {
          position: isMobile ? "fixed" : "relative",
          bottom: isMobile ? "auto" : "auto",
          left: isMobile ? 0 : "auto",
          right: isMobile ? 0 : "auto",
          m: 0,
          width: isMobile ? "100%" : "90%",
          maxWidth: isMobile ? "100%" : "500px",
          borderRadius: isMobile ? 0 : 2,
          borderBottomLeftRadius: isMobile ? 0 : 2,
          borderBottomRightRadius: isMobile ? 0 : 2,
          maxHeight: isMobile ? "90vh" : "85vh",
          animation: isMobile ? "slideUp 0.3s ease-in-out" : "fadeIn 0.3s ease-in-out",
          "@keyframes slideUp": {
            from: {
              transform: "translateY(100%)",
            },
            to: {
              transform: "translateY(0)",
            },
          },
          "@keyframes fadeIn": {
            from: {
              opacity: 0,
            },
            to: {
              opacity: 1,
            },
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          borderBottom: "1px solid #e0e0e0",
          pb: isMobile ? 1.5 : 2,
          pt: isMobile ? 2 : 2,
          px: isMobile ? 1.5 : 2,
        }}
      >
        <Typography
          variant="subtitle1"
          fontWeight={700}
          sx={{ fontSize: isMobile ? "1.1rem" : "1.25rem" }}
        >
          Where should we deliver your order?
        </Typography>
      </DialogTitle>

      {/* Use Current Location Section */}
      <Box
        sx={{
          px: isMobile ? 1.5 : 2,
          py: isMobile ? 1.5 : 2,
          borderBottom: "1px solid #e0e0e0",
        }}
      >
        <Button
          fullWidth
          startIcon={
            locationLoading ? (
              <CircularProgress size={20} />
            ) : (
              <LocationOnIcon sx={{ color: "#e91e63" }} />
            )
          }
          onClick={handleGetCurrentLocation}
          disabled={locationLoading}
          sx={{
            justifyContent: "flex-start",
            py: isMobile ? 1.5 : 2,
            px: 2,
            textTransform: "none",
            fontSize: isMobile ? "0.95rem" : "1rem",
            color: "#333",
            backgroundColor: "#f5f5f5",
            border: "1px solid #e0e0e0",
            "&:hover": {
              backgroundColor: "#eeeeee",
              border: "1px solid #d0d0d0",
            },
            "&:disabled": {
              backgroundColor: "#f5f5f5",
              color: "#999",
            },
          }}
        >
          {locationLoading ? "Getting your location..." : "Use my current location"}
        </Button>
        {locationError && (
          <Alert severity="error" sx={{ mt: 1, fontSize: isMobile ? "0.85rem" : "0.9rem" }}>
            {locationError}
          </Alert>
        )}

          {isIOS && (geoPermission === "denied" || /denied/i.test(locationError)) && (
            <Box
              sx={{
                mt: 1.5,
                p: 1.5,
                border: "1px solid #ffe0b2",
                backgroundColor: "#fff3e0",
                borderRadius: 1,
              }}
            >
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.75, color: "#e65100" }}>
                Enable Location on iPhone
              </Typography>
              <Typography variant="caption" sx={{ display: "block", color: "#5d4037" }}>
                In Safari: tap the aA icon → Website Settings → Location → Allow. Also enable
                “Use Precise Location”. Then come back and tap Retry.
              </Typography>
              <Typography variant="caption" sx={{ display: "block", color: "#5d4037", mt: 0.5 }}>
                Or go to Settings → Privacy & Security → Location Services → Safari Websites → While Using.
              </Typography>
              {typeof window !== "undefined" && window.location?.protocol !== "https:" && (
                <Typography variant="caption" sx={{ display: "block", color: "#5d4037", mt: 0.5 }}>
                  Tip: iOS may require HTTPS for location. Use your secure preview link when testing.
                </Typography>
              )}
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Button size="small" variant="outlined" onClick={handleGetCurrentLocation}>
                  Retry
                </Button>
              </Stack>
            </Box>
          )}
      </Box>

      {/* Current Location Display with Minimap */}
      {currentLocationData && (
        <>
          <Divider sx={{ my: 0 }} />
          <Box
            sx={{
              px: isMobile ? 1.5 : 2,
              py: isMobile ? 1.5 : 2,
              borderBottom: "1px solid #e0e0e0",
            }}
          >
            {/* Minimap */}
            <Box
              ref={mapContainerRef}
              sx={{
                width: "100%",
                height: isMobile ? "250px" : "300px",
                borderRadius: 1,
                mb: 2,
                border: "1px solid #e0e0e0",
                overflow: "hidden",
              }}
            />

            {/* Current Location Label */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                py: 1.5,
                px: 1.5,
                backgroundColor: "#e8f5e9",
                borderRadius: 1,
                border: "1px solid #4caf50",
              }}
            >
              <CheckIcon sx={{ color: "#4caf50", fontSize: isMobile ? 24 : 28, flexShrink: 0 }} />
              <Box>
                <Typography
                  variant="subtitle2"
                  fontWeight={600}
                  sx={{
                    fontSize: isMobile ? "0.95rem" : "1rem",
                    color: "#2e7d32",
                  }}
                >
                  Current Location
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    fontSize: isMobile ? "0.85rem" : "0.9rem",
                    color: "#555",
                    mt: 0.5,
                    wordBreak: "break-word",
                  }}
                >
                  {currentLocationData.cityProvince}
                </Typography>
              </Box>
            </Box>

            {/* Add New Address Button */}
            <Button
              fullWidth
              startIcon={<AddIcon />}
              onClick={handleAddNewAddress}
              sx={{
                mt: 2,
                py: isMobile ? 1.5 : 2,
                textTransform: "none",
                fontSize: isMobile ? "0.95rem" : "1rem",
                fontWeight: 600,
                backgroundColor: "#f5f5f5",
                color: "#1976d2",
                border: "2px dashed #1976d2",
                "&:hover": {
                  backgroundColor: "#e3f2fd",
                  border: "2px dashed #1565c0",
                },
              }}
            >
              + Add a new address
            </Button>
          </Box>
        </>
      )}

      <DialogContent
        sx={{
          pt: isMobile ? 1.5 : 2,
          px: isMobile ? 1.5 : 2,
          overflow: "auto",
          maxHeight: isMobile ? "calc(90vh - 180px)" : "calc(85vh - 180px)",
        }}
      >
        <Stack spacing={isMobile ? 1.5 : 2}>
          {/* Saved Addresses Section */}
          {savedAddresses.length > 0 && (
            <Box>
              <Typography
                variant="subtitle2"
                fontWeight={600}
                sx={{
                  mb: isMobile ? 0.75 : 1,
                  fontSize: isMobile ? "0.9rem" : "1rem",
                }}
              >
                Your saved addresses
              </Typography>
              <Stack spacing={isMobile ? 0.75 : 1}>
                {savedAddresses.map((address, index) => (
                  <Card
                    key={index}
                    sx={{
                      p: isMobile ? 1 : 1.5,
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      border: "2px solid #e0e0e0",
                      minHeight: isMobile ? 50 : "auto",
                      display: "flex",
                      alignItems: "center",
                      "&:hover": {
                        border: "2px solid #1976d2",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                        backgroundColor: "#f5f5f5",
                      },
                      "&:active": {
                        backgroundColor: "#eeeeee",
                      },
                    }}
                    onClick={() => {
                      // Extract city and province from saved address
                      const parts = address.split(",");
                      const cityProvince = parts.slice(-2).join(",").trim() || address.split(",")[0];
                      onSelectAddress({ address, cityProvince });
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        fontSize: isMobile ? "0.9rem" : "1rem",
                        wordBreak: "break-word",
                      }}
                    >
                      {address}
                    </Typography>
                  </Card>
                ))}
              </Stack>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions
        sx={{
          borderTop: "1px solid #e0e0e0",
          pt: isMobile ? 1.5 : 2,
          px: isMobile ? 1.5 : 2,
          pb: isMobile ? 2 : 2,
          gap: isMobile ? 0.5 : 1,
        }}
      >
        <Button
          onClick={onClose}
          variant="outlined"
          sx={{
            flex: isMobile ? 1 : "auto",
            py: isMobile ? 1 : 1,
            fontSize: isMobile ? "0.85rem" : "0.9rem",
            textTransform: "none",
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ShopLocationDialog;
