import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { Dialog, useMediaQuery, useTheme, Box, Button, Typography, TextField, IconButton, CircularProgress } from "@mui/material";
import { GoogleMap, useJsApiLoader } from "@react-google-maps/api";
import { getRoadDistance, extractCoordinates, calculateCustomerDeliveryFee } from "../../../lib/deliveryPricing";
import SearchIcon from "@mui/icons-material/Search";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import HomeIcon from "@mui/icons-material/Home";
import WorkIcon from "@mui/icons-material/Work";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import HistoryIcon from "@mui/icons-material/History";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";

const RECENT_SEARCHES_KEY = "shopRecentLocationSearches";

const getCityProvinceFromAddress = (address) => {
  if (!address) return "";
  const parts = address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[parts.length - 2]}, ${parts[parts.length - 1]}`;
  }

  return parts[0] || "";
};

const ShopLocationDialog = ({
  open,
  onClose,
  savedAddresses = [],
  onSelectAddress,
  merchants = {},
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [searchTerm, setSearchTerm] = useState("");
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mapLoadError, setMapLoadError] = useState("");
  const [mapRetryNonce, setMapRetryNonce] = useState(0);
  const [recentSearches, setRecentSearches] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const mapRef = useRef(null);
  const pulseTimerRef = useRef(null);
  const searchDebounceRef = useRef(null);
  const searchRequestRef = useRef(0);
  const [zoomLevel, setZoomLevel] = useState(15);
  const [nearbyStores, setNearbyStores] = useState([]);
  const [calculatingStores, setCalculatingStores] = useState(false);

  const googleMapsApiKey =
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY || import.meta.env.REACT_APP_GOOGLE_MAPS_API_KEY || "";

  const { isLoaded: isGoogleMapsLoaded } = useJsApiLoader({
    id: "user-app-shop-map",
    googleMapsApiKey,
  });

  const pushRecentSearch = useCallback(
    (address) => {
      if (!address) return;

      const deduped = [
        address,
        ...recentSearches.filter((entry) => entry.toLowerCase() !== address.toLowerCase()),
      ].slice(0, 8);

      setRecentSearches(deduped);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(deduped));
    },
    [recentSearches]
  );

  const calculateNearbyStores = useCallback(
    async (lat, lng) => {
      if (!merchants || Object.keys(merchants).length === 0) {
        setNearbyStores([]);
        return;
      }

      setCalculatingStores(true);
      const storesData = [];

      try {
        for (const [storeId, storeData] of Object.entries(merchants)) {
          try {
            const storeCoords = extractCoordinates(storeData);
            if (!storeCoords) continue;

            const distance = await getRoadDistance(lat, lng, storeCoords.lat, storeCoords.lng);

            if (distance && distance <= 8) {
              const fee = calculateCustomerDeliveryFee(distance);
              storesData.push({
                id: storeId,
                name: storeData.storeName || storeData.businessName || "Store",
                distance: Math.round((distance + Number.EPSILON) * 10) / 10,
                fee,
                logo: storeData.storeLogo || storeData.businessLogo,
              });
            }
          } catch (error) {
            console.error(`Error calculating distance for store ${storeId}:`, error);
          }
        }

        storesData.sort((a, b) => a.distance - b.distance);
        setNearbyStores(storesData);
      } finally {
        setCalculatingStores(false);
      }
    },
    [merchants]
  );

  const reverseGeocode = useCallback(
    async (lat, lng, saveToRecent = true) => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
        );

        if (!response.ok) {
          throw new Error("Failed reverse geocoding");
        }

        const data = await response.json();
        const city =
          data.address?.city ||
          data.address?.town ||
          data.address?.municipality ||
          data.address?.county ||
          "Location";
        const province = data.address?.state || data.address?.province || "";
        const cityProvince = province ? `${city}, ${province}` : city;

        const fullAddress =
          data.display_name ||
          [data.address?.road, data.address?.suburb, cityProvince].filter(Boolean).join(", ");

        setSelectedAddress(fullAddress);
        if (saveToRecent) {
          pushRecentSearch(fullAddress);
        }
        return fullAddress;
      } catch (error) {
        console.error("Reverse geocoding error:", error);
        const fallbackAddress = `Lat: ${lat.toFixed(5)}, Lon: ${lng.toFixed(5)}`;
        setSelectedAddress(fallbackAddress);
        return fallbackAddress;
      }
    },
    [pushRecentSearch]
  );

  useEffect(() => {
    if (!open) return;

    try {
      const cached = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || "[]");
      setRecentSearches(Array.isArray(cached) ? cached : []);
    } catch {
      setRecentSearches([]);
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      if (pulseTimerRef.current) {
        window.clearInterval(pulseTimerRef.current);
        pulseTimerRef.current = null;
      }

      mapRef.current = null;
    } else {
      setMapLoadError("");
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (pulseTimerRef.current) {
        window.clearInterval(pulseTimerRef.current);
      }
      if (searchDebounceRef.current) {
        window.clearTimeout(searchDebounceRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const previousAuthFailureHandler = window.gm_authFailure;

    window.gm_authFailure = () => {
      setMapLoadError("Google Maps key/auth failed (invalid key, referrer restriction, or billing). Please check Google Maps API settings.");
      if (typeof previousAuthFailureHandler === "function") {
        previousAuthFailureHandler();
      }
    };

    return () => {
      window.gm_authFailure = previousAuthFailureHandler;
    };
  }, []);

  useEffect(() => {
    if (!selectedLocation || !googleMapsApiKey || mapLoadError) return;
    if (window.google?.maps) return;

    const timeoutId = window.setTimeout(() => {
      if (!window.google?.maps) {
        console.error("❌ Google Maps API failed to load within 8 seconds");
        setMapLoadError("Map failed to load (possible network issue). Tap to retry.");
      }
    }, 8000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [selectedLocation, googleMapsApiKey, mapRetryNonce, mapLoadError]);

  const handleRetryMapLoad = () => {
    setMapLoadError("");
    setMapRetryNonce((prev) => prev + 1);
    if (mapRef.current && window.google?.maps?.event) {
      window.google.maps.event.clearInstanceListeners(mapRef.current);
    }
    mapRef.current = null;
  };

  useEffect(() => {
    if (mapRef.current && selectedLocation) {
      mapRef.current.panTo(selectedLocation);
    }
  }, [selectedLocation]);

  const handleMapClick = useCallback(
    async (event) => {
      if (!event?.latLng) return;
      const lat = event.latLng.lat();
      const lng = event.latLng.lng();
      setSelectedLocation({ lat, lng });
      await reverseGeocode(lat, lng);
    },
    [reverseGeocode]
  );

  const handleMapDragEnd = useCallback(
    async () => {
      const center = mapRef.current?.getCenter?.();
      if (!center) return;

      const lat = center.lat();
      const lng = center.lng();
    
      setSelectedLocation({ lat, lng });
      await reverseGeocode(lat, lng);
    },
    [reverseGeocode]
  );

  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setZoom(zoomLevel);
    }
  }, [zoomLevel]);

  const filteredSavedAddresses = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return savedAddresses;

    return savedAddresses.filter((address) => (address || "").toLowerCase().includes(term));
  }, [savedAddresses, searchTerm]);

  const filteredRecentSearches = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return recentSearches;

    return recentSearches.filter((entry) => (entry || "").toLowerCase().includes(term));
  }, [recentSearches, searchTerm]);

  const handleSelectAddressLocal = async (address) => {
    const cityProvince = getCityProvinceFromAddress(address);
    pushRecentSearch(address);
    setSelectedAddress(address);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&q=${encodeURIComponent(address)}`
      );

      if (response.ok) {
        const results = await response.json();
        if (results.length > 0) {
          const firstResult = results[0];
          const lat = Number(firstResult.lat);
          const lng = Number(firstResult.lon);
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            setSelectedLocation({ lat, lng });
          }
        }
      }
    } catch (error) {
      console.warn("Error geocoding recent search address:", error);
    }
  };

  const handleSearchAddress = async () => {
    const query = searchTerm.trim();
    if (!query) return;

    setSearchLoading(true);
    setLocationError("");

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&q=${encodeURIComponent(query)}`
      );

      if (!response.ok) {
        throw new Error("Address search failed");
      }

      const results = await response.json();
      if (!Array.isArray(results) || results.length === 0) {
        setSearchSuggestions([]);
        setShowSuggestions(false);
        setLocationError("No location found. Try a more specific address.");
        return;
      }

      const normalized = results
        .map((entry) => ({
          name: entry.display_name,
          lat: Number(entry.lat),
          lng: Number(entry.lon),
        }))
        .filter((entry) => Number.isFinite(entry.lat) && Number.isFinite(entry.lng));

      setSearchSuggestions(normalized);
      setShowSuggestions(true);

      const topResult = normalized[0];
      const lat = Number(topResult?.lat);
      const lng = Number(topResult?.lng);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        setLocationError("Invalid location returned. Please try another address.");
        return;
      }

      setSelectedLocation({ lat, lng });
      setZoomLevel(17);
      await reverseGeocode(lat, lng);

      if (mapRef.current) {
        mapRef.current.panTo({ lat, lng });
        mapRef.current.setZoom(17);
      }
    } catch (error) {
      console.error("Address search error:", error);
      setLocationError("Unable to search this address right now. Please try again.");
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSuggestionSelect = (suggestion) => {
    if (!suggestion) return;

    setSearchTerm(suggestion.name);
    setSelectedAddress(suggestion.name);
    setSelectedLocation({ lat: suggestion.lat, lng: suggestion.lng });
    setZoomLevel(17);
    setShowSuggestions(false);
    pushRecentSearch(suggestion.name);
    calculateNearbyStores(suggestion.lat, suggestion.lng);

    if (mapRef.current) {
      mapRef.current.panTo({ lat: suggestion.lat, lng: suggestion.lng });
      mapRef.current.setZoom(17);
    }
  };

  useEffect(() => {
    const term = searchTerm.trim();
    if (!term || term.length < 3) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      if (searchDebounceRef.current) {
        window.clearTimeout(searchDebounceRef.current);
      }
      return;
    }

    if (searchDebounceRef.current) {
      window.clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = window.setTimeout(async () => {
      const requestId = searchRequestRef.current + 1;
      searchRequestRef.current = requestId;

      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&q=${encodeURIComponent(term)}`
        );

        if (!response.ok) {
          return;
        }

        const results = await response.json();
        if (requestId !== searchRequestRef.current) {
          return;
        }

        const normalized = (Array.isArray(results) ? results : [])
          .map((entry) => ({
            name: entry.display_name,
            lat: Number(entry.lat),
            lng: Number(entry.lon),
          }))
          .filter((entry) => Number.isFinite(entry.lat) && Number.isFinite(entry.lng));

        setSearchSuggestions(normalized);
        setShowSuggestions(normalized.length > 0);

        if (normalized.length > 0) {
          const top = normalized[0];
          setSelectedLocation({ lat: top.lat, lng: top.lng });
          setSelectedAddress(top.name);
          if (mapRef.current) {
            mapRef.current.panTo({ lat: top.lat, lng: top.lng });
          }
        }
      } catch (error) {
        console.error("Suggestion fetch error:", error);
      }
    }, 360);
  }, [searchTerm]);

  const handleConfirmAddress = async () => {
    if (selectedAddress) {
      const cityProvince = getCityProvinceFromAddress(selectedAddress);
      const result = await onSelectAddress({
        address: selectedAddress,
        cityProvince,
        coordinates: selectedLocation || null,
      });

      if (result !== false) {
        onClose();
      } else {
        setLocationError("Unable to save address right now. Please try again.");
      }
    }
  };

  const handleZoomIn = () => {
    const newZoom = Math.min(zoomLevel + 1, 21);
    setZoomLevel(newZoom);
    if (mapRef.current) {
      mapRef.current.setZoom(newZoom);
    }
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(zoomLevel - 1, 1);
    setZoomLevel(newZoom);
    if (mapRef.current) {
      mapRef.current.setZoom(newZoom);
    }
  };

  const handleMapRecenter = () => {
    if (mapRef.current && selectedLocation) {
      mapRef.current.panTo(selectedLocation);
      mapRef.current.setZoom(16);
      setZoomLevel(16);
    }
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
          setSelectedLocation({ lat: latitude, lng: longitude });

          await reverseGeocode(latitude, longitude);
          await calculateNearbyStores(latitude, longitude);
          setLocationError("");

          if (mapRef.current) {
            mapRef.current.panTo({ lat: latitude, lng: longitude });
            mapRef.current.setZoom(16);
            setZoomLevel(16);
          }
        } catch (error) {
          const { latitude, longitude } = position.coords;
          setSelectedLocation({ lat: latitude, lng: longitude });
          setSelectedAddress(`Lat: ${latitude.toFixed(5)}, Lon: ${longitude.toFixed(5)}`);
          await calculateNearbyStores(latitude, longitude);

          if (mapRef.current) {
            mapRef.current.panTo({ lat: latitude, lng: longitude });
            mapRef.current.setZoom(16);
            setZoomLevel(16);
          }
        } finally {
          setLocationLoading(false);
        }
      },
      (error) => {
        setLocationLoading(false);
        let errorMsg = "";

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMsg = "Location permission denied. Please enable location in settings.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMsg = "Location unavailable. Please check your GPS.";
            break;
          case error.TIMEOUT:
            errorMsg = "Location request timed out. Please try again.";
            break;
          default:
            errorMsg = "Unable to get your location. Check HTTPS & permissions.";
        }

        setLocationError(errorMsg);
        console.error("Geolocation error:", error);
      },
      {
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 0,
      }
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={isMobile}
      fullWidth
      maxWidth="sm"
      TransitionProps={{
        timeout: { enter: 300, exit: 200 },
      }}
      sx={{
        "& .MuiDialog-paper": {
          animation: isMobile ? "slideInUp 0.3s ease-out" : undefined,
        },
        "@keyframes slideInUp": {
          from: {
            transform: "translateY(100%)",
            opacity: 0,
          },
          to: {
            transform: "translateY(0)",
            opacity: 1,
          },
        },
      }}
      PaperProps={{
        sx: {
          m: 0,
          borderRadius: isMobile ? 0 : 2,
          height: isMobile ? "100dvh" : "95vh",
          backgroundColor: "#ffffff",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          backgroundColor: "#ffffff",
        }}
      >
        <Box
          sx={{
            background: "linear-gradient(180deg, #1e67da 0%, #1357c4 100%)",
            pt: isMobile ? `max(1rem, env(safe-area-inset-top))` : 1.5,
            pb: 1.5,
            px: 2,
            position: "relative",
            zIndex: 10,
            boxShadow: "0 4px 12px rgba(19, 87, 196, 0.2)",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", mb: 1.5 }}>
            <IconButton
              onClick={onClose}
              sx={{
                color: "#ffffff",
                p: 0.75,
                mr: 1.5,
                "&:hover": { backgroundColor: "rgba(255, 255, 255, 0.1)" },
              }}
            >
              <ArrowBackIosNewIcon sx={{ fontSize: 20 }} />
            </IconButton>
            <Typography sx={{ color: "#ffffff", fontSize: "1.05rem", fontWeight: 700, flex: 1 }}>
              Delivery Address
            </Typography>
          </Box>

          <Box
            sx={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              backgroundColor: "#ffffff",
              borderRadius: "0.75rem",
              px: 1.5,
              py: 1,
              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
              border: "1px solid rgba(0, 0, 0, 0.05)",
              mb: 1.5,
            }}
          >
            <IconButton
              onClick={handleSearchAddress}
              disabled={searchLoading || !searchTerm.trim()}
              sx={{ color: searchLoading ? "#1e67da" : "#999", mr: 0.5, p: 0.5 }}
            >
              {searchLoading ? (
                <CircularProgress size={18} sx={{ color: "#1e67da" }} />
              ) : (
                <SearchIcon sx={{ fontSize: 20 }} />
              )}
            </IconButton>
            <TextField
              placeholder="Search for address or building"
              fullWidth
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => {
                if (searchSuggestions.length > 0) {
                  setShowSuggestions(true);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSearchAddress();
                }
              }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  border: "none",
                  padding: 0,
                  "& fieldset": { border: "none" },
                  "& input::placeholder": { color: "#999", opacity: 0.7 },
                },
                "& input": { fontSize: "0.95rem", padding: 0 },
              }}
            />

            {showSuggestions && searchSuggestions.length > 0 && (
              <Box
                sx={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  left: 0,
                  right: 0,
                  maxHeight: "220px",
                  overflowY: "auto",
                  borderRadius: "0.75rem",
                  border: "1px solid rgba(30, 103, 218, 0.25)",
                  backgroundColor: "#ffffff",
                  boxShadow: "0 10px 24px rgba(19, 87, 196, 0.18)",
                  zIndex: 30,
                }}
              >
                {searchSuggestions.map((suggestion, index) => (
                  <Button
                    key={`${suggestion.name}-${index}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSuggestionSelect(suggestion);
                    }}
                    fullWidth
                    sx={{
                      justifyContent: "flex-start",
                      textTransform: "none",
                      color: "#1f3f75",
                      px: 1.2,
                      py: 1,
                      borderRadius: 0,
                      borderBottom: index === searchSuggestions.length - 1 ? "none" : "1px solid #eef3ff",
                      backgroundColor: index === 0 ? "rgba(30, 103, 218, 0.07)" : "#ffffff",
                      "&:hover": {
                        backgroundColor: "rgba(30, 103, 218, 0.12)",
                      },
                    }}
                  >
                    <LocationOnIcon sx={{ fontSize: 18, color: "#1e67da", mr: 1 }} />
                    <Typography
                      sx={{
                        fontSize: "0.84rem",
                        textAlign: "left",
                        lineHeight: 1.3,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {suggestion.name}
                    </Typography>
                  </Button>
                ))}
              </Box>
            )}
          </Box>
        </Box>

        <Box sx={{ px: 2, pt: 1.5, pb: 1 }}>
          <Button
            onClick={handleGetCurrentLocation}
            disabled={locationLoading}
            fullWidth
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(180deg, #1e67da 0%, #1357c4 100%)",
              color: "#ffffff",
              py: 1.2,
              px: 2,
              borderRadius: "0.75rem",
              fontWeight: 600,
              fontSize: "0.95rem",
              border: "1px solid #1555c4",
              textTransform: "none",
              transition: "all 0.2s",
              boxShadow: selectedLocation
                ? "0 6px 16px rgba(19, 87, 196, 0.35)"
                : "0 4px 12px rgba(19, 87, 196, 0.25)",
              "&:hover": {
                background: "linear-gradient(180deg, #1b5fc8 0%, #0f4fb7 100%)",
              },
              "&:disabled": {
                background: "linear-gradient(180deg, #8fb3eb 0%, #7aa3e5 100%)",
                color: "#f7fbff",
                opacity: 0.75,
              },
            }}
          >
            {locationLoading ? (
              <>
                <CircularProgress size={18} sx={{ mr: 1.5, color: "inherit" }} />
                Getting location...
              </>
            ) : selectedLocation ? (
              <>
                <CheckCircleIcon sx={{ mr: 1.5, fontSize: 20 }} />
                Use current location
              </>
            ) : (
              <>
                <MyLocationIcon sx={{ mr: 1.5, fontSize: 20 }} />
                Use current location
              </>
            )}
          </Button>
        </Box>

        {locationError && (
          <Box
            sx={{
              mx: 2,
              p: 1.5,
              backgroundColor: "#fee",
              border: "1px solid #fcc",
              borderRadius: "0.75rem",
              color: "#c33",
              fontSize: "0.85rem",
            }}
          >
            {locationError}
          </Box>
        )}

        {selectedLocation && !googleMapsApiKey && (
          <Box
            sx={{
              mx: 2,
              my: 1.5,
              p: 1.5,
              borderRadius: "0.75rem",
              border: "1px solid rgba(30, 103, 218, 0.2)",
              backgroundColor: "#f5f9ff",
              color: "#1e3a8a",
              fontSize: "0.85rem",
              lineHeight: 1.45,
            }}
          >
            Google Maps is disabled because the API key is missing. Set VITE_GOOGLE_MAPS_API_KEY in your build environment.
          </Box>
        )}

        {selectedLocation && googleMapsApiKey && (
          <Box
            sx={{
              position: "relative",
              mx: 2,
              my: 1.5,
              borderRadius: "0.75rem",
              overflow: "hidden",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              touchAction: "manipulation",
              pointerEvents: "auto",
            }}
          >
            <Box
              sx={{
                width: "100%",
                height: isMobile ? "42dvh" : "360px",
                minHeight: isMobile ? "340px" : "320px",
                borderRadius: "0.75rem",
                pointerEvents: "auto",
                touchAction: "manipulation",
                position: "relative",
                backgroundColor: "#eef5ff",
                cursor: "grab",
              }}
            >
              {isGoogleMapsLoaded ? (
                <>
                  <GoogleMap
                    mapContainerStyle={{ width: "100%", height: "100%" }}
                    center={selectedLocation}
                    zoom={zoomLevel}
                    onLoad={(map) => {
                      mapRef.current = map;
                    }}
                    onUnmount={() => {
                      mapRef.current = null;
                    }}
                    onClick={handleMapClick}
                    onDragEnd={handleMapDragEnd}
                    options={{
                      disableDefaultUI: false,
                      zoomControl: false,
                      fullscreenControl: false,
                      streetViewControl: false,
                      mapTypeControl: false,
                      scaleControl: true,
                      gestureHandling: "greedy",
                      draggableCursor: "grab",
                      draggingCursor: "grabbing",
                    }}
                  />
                  <Box
                    sx={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -100%)",
                      zIndex: 6,
                      pointerEvents: "none",
                      filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.3))",
                    }}
                  >
                    <LocationOnIcon sx={{ fontSize: 58, color: "#1e67da" }} />
                    <Box
                      sx={{
                        position: "absolute",
                        top: 22,
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: 14,
                        height: 14,
                        borderRadius: "50%",
                        backgroundColor: "#ffffff",
                        border: "3px solid #1e67da",
                      }}
                    />
                  </Box>
                </>
              ) : (
                <Box
                  sx={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 1,
                    color: "#1e67da",
                    background: "linear-gradient(180deg, rgba(30, 103, 218, 0.08) 0%, rgba(30, 103, 218, 0.03) 100%)",
                  }}
                >
                  <CircularProgress size={28} sx={{ color: "#1e67da" }} />
                  <Typography sx={{ fontSize: "0.85rem", fontWeight: 600 }}>
                    Loading Google Map...
                  </Typography>
                </Box>
              )}
            </Box>

            <Box
              sx={{
                position: "absolute",
                right: 12,
                top: 12,
                display: "flex",
                flexDirection: "column",
                gap: 1,
                zIndex: 5,
                pointerEvents: "auto",
              }}
            >
              <Button
                onClick={handleZoomIn}
                sx={{
                  minWidth: 40,
                  width: 40,
                  height: 40,
                  p: 0,
                  backgroundColor: "#ffffff",
                  border: "1px solid rgba(30, 103, 218, 0.25)",
                  borderRadius: "0.5rem",
                  boxShadow: "0 3px 8px rgba(19, 87, 196, 0.15)",
                  "&:hover": { backgroundColor: "#f0f6ff" },
                }}
              >
                <AddIcon sx={{ fontSize: 20, color: "#1e67da" }} />
              </Button>
              <Button
                onClick={handleZoomOut}
                sx={{
                  minWidth: 40,
                  width: 40,
                  height: 40,
                  p: 0,
                  backgroundColor: "#ffffff",
                  border: "1px solid rgba(30, 103, 218, 0.25)",
                  borderRadius: "0.5rem",
                  boxShadow: "0 3px 8px rgba(19, 87, 196, 0.15)",
                  "&:hover": { backgroundColor: "#f0f6ff" },
                }}
              >
                <RemoveIcon sx={{ fontSize: 20, color: "#1e67da" }} />
              </Button>
              <Button
                onClick={handleMapRecenter}
                sx={{
                  minWidth: 40,
                  width: 40,
                  height: 40,
                  p: 0,
                  backgroundColor: "#1e67da",
                  border: "1px solid #1e67da",
                  borderRadius: "0.5rem",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  "&:hover": { backgroundColor: "#1555c4" },
                }}
              >
                <MyLocationIcon sx={{ fontSize: 20, color: "#fff" }} />
              </Button>
            </Box>

            <Box
              sx={{
                position: "absolute",
                top: 12,
                left: 12,
                right: 50,
                backgroundColor: "rgba(19, 87, 196, 0.85)",
                color: "#fff",
                px: 1.5,
                py: 1,
                borderRadius: "0.5rem",
                fontSize: "0.75rem",
                textAlign: "center",
                zIndex: 4,
                pointerEvents: "none",
              }}
            >
              Drag the map to adjust location
            </Box>

            {mapLoadError && (
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  backgroundColor: "rgba(255, 245, 245, 0.93)",
                  border: "1px solid rgba(220, 38, 38, 0.25)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                  px: 2,
                  zIndex: 9,
                  pointerEvents: "auto",
                }}
              >
                <Typography sx={{ fontSize: "0.85rem", color: "#9f1239", lineHeight: 1.45, textAlign: "center", mb: 1.2 }}>
                  {mapLoadError}
                </Typography>
                <Button
                  onClick={handleRetryMapLoad}
                  sx={{
                    background: "linear-gradient(180deg, #1e67da 0%, #1357c4 100%)",
                    color: "#fff",
                    borderRadius: "0.65rem",
                    textTransform: "none",
                    fontWeight: 700,
                    fontSize: "0.88rem",
                    border: "1px solid #1555c4",
                    px: 2,
                    py: 0.85,
                    "&:hover": {
                      background: "linear-gradient(180deg, #1b5fc8 0%, #0f4fb7 100%)",
                    },
                  }}
                >
                  Tap to retry map
                </Button>
              </Box>
            )}

            <Box
              sx={{
                position: "absolute",
                left: 12,
                bottom: 12,
                backgroundColor: "rgba(255,255,255,0.92)",
                color: "#1e67da",
                px: 1.25,
                py: 0.75,
                borderRadius: "0.5rem",
                fontSize: "0.78rem",
                fontWeight: 700,
                lineHeight: 1.2,
                boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                zIndex: 4,
                pointerEvents: "none",
              }}
            >
              Center: {selectedLocation.lat.toFixed(5)}, {selectedLocation.lng.toFixed(5)}
            </Box>
          </Box>
        )}

        <Box
          sx={{
            flex: selectedLocation ? "0 0 auto" : 1,
            px: 2,
            pb: 1,
            overflowY: selectedLocation ? "visible" : "auto",
            backgroundColor: "#ffffff",
          }}
        >
          {selectedLocation && selectedAddress && (
            <Box
              sx={{
                backgroundColor: "#f5f9ff",
                border: "1px solid rgba(30, 103, 218, 0.2)",
                borderRadius: "0.75rem",
                p: 1.25,
                mb: 1,
              }}
            >
              <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "#1e67da", mb: 0.4 }}>
                Selected Center Address
              </Typography>
              <Typography sx={{ fontSize: "0.85rem", color: "#2b2b2b" }}>
                {selectedAddress}
              </Typography>
            </Box>
          )}

          {!selectedLocation && (
            <>
              <Typography
                sx={{
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  color: "#333",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  mb: 0.5,
                  mt: 1,
                }}
              >
                Saved Addresses
              </Typography>
              <Typography sx={{ fontSize: "0.75rem", color: "#999", mb: 1.5 }}>
                Select a frequent delivery spot
              </Typography>
            </>
          )}

          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {filteredSavedAddresses.length === 0 ? (
              !selectedLocation && (
                <Typography sx={{ fontSize: "0.85rem", color: "#999" }}>
                  No saved addresses yet
                </Typography>
              )
            ) : (
              filteredSavedAddresses.map((address, index) => {
                const icons = [HomeIcon, WorkIcon, LocationOnIcon];
                const labels = ["Home", "Work", `Address ${index + 1}`];
                const IconComponent = icons[index % icons.length];
                const label = labels[index] || `Address ${index + 1}`;
                const isSelected = selectedAddress === address;

                return (
                  <Button
                    key={`${address}-${index}`}
                    onClick={() => handleSelectAddressLocal(address)}
                    fullWidth
                    sx={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "flex-start",
                      backgroundColor: isSelected ? "rgba(30, 103, 218, 0.08)" : "#f5f9ff",
                      p: 1.5,
                      borderRadius: "0.75rem",
                      border: isSelected ? "1px solid #1e67da" : "1px solid rgba(30, 103, 218, 0.1)",
                      textTransform: "none",
                      color: "#000",
                      transition: "all 0.2s",
                      "&:hover": {
                        backgroundColor: "#eef5ff",
                        borderColor: "rgba(30, 103, 218, 0.3)",
                      },
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: isSelected ? "rgba(30, 103, 218, 0.15)" : "rgba(30, 103, 218, 0.08)",
                        borderRadius: "50%",
                        width: 40,
                        height: 40,
                        mr: 2,
                        flexShrink: 0,
                      }}
                    >
                      <IconComponent sx={{ color: "#1e67da", fontSize: 20 }} />
                    </Box>
                    <Box sx={{ textAlign: "left", flex: 1 }}>
                      <Typography sx={{ fontWeight: 600, fontSize: "0.9rem", mb: 0.25 }}>
                        {label}
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: "0.8rem",
                          color: "#666",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                        }}
                      >
                        {address}
                      </Typography>
                    </Box>
                  </Button>
                );
              })
            )}
          </Box>

          {filteredRecentSearches.length > 0 && !selectedLocation && (
            <Box sx={{ mt: 2 }}>
              <Typography
                sx={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: "#999",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  mb: 1,
                }}
              >
                Recent Searches
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.8 }}>
                {filteredRecentSearches.map((entry, index) => (
                  <Button
                    key={`${entry}-${index}`}
                    onClick={() => handleSelectAddressLocal(entry)}
                    fullWidth
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-start",
                      textTransform: "none",
                      color: "#666",
                      p: 1,
                      "&:hover": {
                        backgroundColor: "transparent",
                        color: "#1e67da",
                      },
                    }}
                  >
                    <HistoryIcon sx={{ mr: 2, fontSize: 18, color: "#999" }} />
                    <Typography sx={{ fontSize: "0.9rem", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {entry}
                    </Typography>
                  </Button>
                ))}
              </Box>
            </Box>
          )}
        </Box>

        <Box
          sx={{
            px: 2,
            py: 1.5,
            pb: `calc(1.5rem + env(safe-area-inset-bottom))`,
            backgroundColor: "#ffffff",
            borderTop: "1px solid #e0e0e0",
            boxShadow: "0 -2px 8px rgba(0,0,0,0.05)",
          }}
        >
          <Button
            onClick={handleConfirmAddress}
            disabled={!selectedAddress}
            fullWidth
            sx={{
              background: selectedAddress
                ? "linear-gradient(180deg, #1e67da 0%, #1357c4 100%)"
                : "linear-gradient(180deg, #b8cde8 0%, #a9c2e4 100%)",
              color: "#ffffff",
              py: 1.5,
              px: 2,
              borderRadius: "9999px",
              fontWeight: 700,
              fontSize: "1rem",
              border: selectedAddress ? "1px solid #1555c4" : "1px solid #9eb8dc",
              boxShadow: selectedAddress ? "0 6px 16px rgba(19, 87, 196, 0.3)" : "none",
              textTransform: "none",
              transition: "all 0.2s",
              "&:hover": {
                background: selectedAddress
                  ? "linear-gradient(180deg, #1b5fc8 0%, #0f4fb7 100%)"
                  : "linear-gradient(180deg, #b8cde8 0%, #a9c2e4 100%)",
              },
              "&:disabled": {
                opacity: 0.85,
                cursor: "not-allowed",
              },
            }}
          >
            Confirm Address
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
};

export default ShopLocationDialog;
