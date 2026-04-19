import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Container,
  Stack,
  Typography,
  TextField,
  IconButton,
  InputAdornment,
  Tooltip,
  Badge,
  Dialog,
} from "@mui/material";
import {
  Search as SearchIcon,
  LocationOn,
  Notifications as NotificationsIcon,
  ArrowBack,
  KeyboardVoice as VoiceIcon,
  ShoppingCart,
  Favorite as FavoriteIcon,
} from "@mui/icons-material";
import AdvertisementBanner from "../../../components/AdvertisementBanner";
import ShopLocationDialog from "./ShopLocationDialog";

const TOP_NAV_COLOR = "#1e67da"; // Blue theme (matches ShopLocationDialog)

// Extract City and Province from full address
// Format: "Barangay, City, Province" -> "City, Province"
// or "Macopa, Visayan Village, Tagum, Davao del Norte" -> "Tagum, Davao del Norte"
const extractCityProvince = (fullAddress) => {
  if (!fullAddress || typeof fullAddress !== "string") return fullAddress;
  
  const parts = fullAddress.split(",").map(p => p.trim());
  
  // If we have at least 3 parts, take the last 2 (City and Province)
  if (parts.length >= 3) {
    return parts.slice(-2).join(", ");
  }
  
  // Otherwise return the full address
  return fullAddress;
};

export default function ShopTopNav({
  search,
  onSearchChange,
  headerHidden,
  locationText,
  locationSubtext,
  adHidden,
  onLocationClick,
  onBackClick,
  onVoiceError,
  cartCount = 0,
  onCartClick,
  favoriteStores = [],
}) {
  const navigate = useNavigate();
  const [listening, setListening] = useState(false);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const recognitionRef = useRef(null);
  const retryCountRef = useRef(0);
  const maxRetries = 2;

  const ensureRecognition = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    if (!recognitionRef.current) {
      const rec = new SR();
      rec.lang = "en-US";
      rec.interimResults = true;
      rec.continuous = false;
      rec.maxAlternatives = 1;
      recognitionRef.current = rec;
    }
    return recognitionRef.current;
  };

  const startListening = (retry = false) => {
    const rec = ensureRecognition();
    if (!rec) {
      const msg = "Voice search is not supported in your browser.";
      onVoiceError?.(msg);
      console.warn(msg);
      return;
    }

    rec.onstart = () => {
      setListening(true);
      console.log(`🎤 Listening started... (attempt ${retryCountRef.current + 1})`);
    };

    rec.onresult = (e) => {
      let transcript = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          transcript += e.results[i][0].transcript + " ";
        }
      }
      transcript = transcript.trim();
      if (transcript) {
        console.log("📝 Transcript:", transcript);
        retryCountRef.current = 0;
        onSearchChange({ target: { value: transcript } });
        setListening(false);
      }
    };

    rec.onerror = (e) => {
      console.error(`⚠️ Voice error: ${e.error}`);
      
      if (e.error === "no-speech" && retryCountRef.current < maxRetries) {
        retryCountRef.current += 1;
        console.log(`🔄 Retrying... (${retryCountRef.current}/${maxRetries})`);
        onVoiceError?.(`No speech detected. Retrying... (${retryCountRef.current}/${maxRetries})`);
        setTimeout(() => startListening(true), 500);
        return;
      }

      const errorMessages = {
        "network": "Network error. Check your internet connection.",
        "no-speech": "No speech detected. Please speak louder or closer to your microphone.",
        "audio-capture": "Microphone not found or permission denied.",
        "not-allowed": "Microphone permission denied. Please allow access in browser settings.",
      };

      const msg = errorMessages[e.error] || `Voice error: ${e.error}. Try again.`;
      onVoiceError?.(msg);
      setListening(false);
      retryCountRef.current = 0;
    };

    rec.onend = () => {
      setListening(false);
      console.log("🎤 Listening ended");
    };

    try {
      rec.start();
    } catch (err) {
      console.error("Failed to start recognition:", err);
      onVoiceError?.(`Failed to start mic: ${err.message}`);
      setListening(false);
      retryCountRef.current = 0;
    }
  };

  const handleVoiceClick = () => {
    if (listening) {
      const rec = ensureRecognition();
      if (rec) rec.abort();
      setListening(false);
      retryCountRef.current = 0;
      return;
    }
    
    retryCountRef.current = 0;
    startListening();
  };

  const handleLocationDialogClose = () => {
    setLocationDialogOpen(false);
  };

  const handleSelectAddress = (address) => {
    setLocationDialogOpen(false);
    if (onLocationClick) {
      onLocationClick(address);
    }
  };

  const handleLocationClick = () => {
    setLocationDialogOpen(true);
  };

  return (
    <Box
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 120,
        background: "linear-gradient(180deg, #1e67da 0%, #1357c4 100%)",
        boxShadow: "0 4px 12px rgba(19, 87, 196, 0.2)",
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
      }}
    >
      <Container maxWidth="sm" sx={{ pt: 1.5, pb: 1 }}>
        <Stack spacing={1.25}>
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{
              overflow: "hidden",
              maxHeight: headerHidden ? 0 : 48,
              mb: headerHidden ? 0 : 0.5,
              opacity: headerHidden ? 0 : 1,
              transform: headerHidden ? "translateY(-6px)" : "translateY(0)",
              transition: "opacity 200ms ease, transform 200ms ease, max-height 200ms ease, margin 200ms ease",
              willChange: "opacity, transform, max-height, margin",
              pointerEvents: headerHidden ? "none" : "auto",
            }}
          >
            <IconButton size="small" sx={{ color: "#ffffff" }} onClick={onBackClick} aria-label="back">
              <ArrowBack />
            </IconButton>
            <LocationOn sx={{ opacity: 0.9, color: "#ffffff" }} />
            <Box
              sx={{
                lineHeight: 1,
                cursor: "pointer",
                flex: 1,
                transition: "opacity 0.2s ease",
                "&:hover": { opacity: 0.8 },
                minWidth: 0,
              }}
              onClick={handleLocationClick}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 700, whiteSpace: "nowrap", color: "#ffffff" }}>
                Deliver to
              </Typography>
              <Typography variant="caption" sx={{ display: "block", whiteSpace: "nowrap", opacity: 0.9, color: "#ffffff", overflow: "hidden", textOverflow: "ellipsis" }}>
                {extractCityProvince(locationSubtext)}
              </Typography>
            </Box>

            <Box sx={{ flex: 1 }} />
            <Tooltip title="My Favorites">
              <IconButton 
                size="small" 
                sx={{ 
                  color: "#ffff",
                  transition: "transform 0.2s ease, color 0.2s ease",
                  "&:hover": {
                    color: "#c0392b",
                    transform: "scale(1.15)"
                  },
                  "&:active": {
                    animation: "pulse 0.6s ease-out"
                  },
                  "@keyframes pulse": {
                    "0%": {
                      transform: "scale(1)"
                    },
                    "50%": {
                      transform: "scale(1.3)"
                    },
                    "100%": {
                      transform: "scale(1)"
                    }
                  }
                }} 
                aria-label="favorites"
                onClick={() => {
                  navigate('/marketplace/favorites');
                }}
              >
                <FavoriteIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
          </Stack>

          <TextField
            fullWidth
            placeholder="Search products..."
            value={search}
            onChange={onSearchChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: "#8e8e93" }} />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <Tooltip title={listening ? "Listening…" : "Voice search"}>
                    <IconButton
                      onClick={handleVoiceClick}
                      aria-label="voice search"
                      edge="end"
                      size="small"
                      sx={{
                        p: 0.5,
                        transition: "all 0.2s ease",
                      }}
                    >
                      <VoiceIcon 
                        sx={{ 
                          color: listening ? "#d32f2f" : "#8e8e93",
                          fontSize: 22,
                        }} 
                      />
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              ),
            }}
            sx={{
              bgcolor: "#ffffff",
              borderRadius: 2.5,
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              "& .MuiOutlinedInput-root": {
                borderRadius: 2.5,
                fontSize: "15px",
                fontWeight: 400,
                color: "#000000",
                bgcolor: "#ffffff",
                transition: "all 0.2s ease",
                "& fieldset": {
                  border: "none",
                },
                "&:hover": {
                  bgcolor: "#f8fafb",
                },
                "&.Mui-focused": {
                  bgcolor: "#ffffff",
                  boxShadow: "0 0 0 2px rgba(30, 103, 218, 0.15)",
                  "& .MuiInputAdornment-root .MuiSvgIcon-root": {
                    color: "#1e67da",
                  },
                },
              },
              "& .MuiOutlinedInput-input": {
                padding: "10px 12px",
                "&::placeholder": {
                  color: "#8e8e93",
                  opacity: 1,
                  fontWeight: 400,
                },
              },
            }}
          />

          <AdvertisementBanner hidden={true} />
        </Stack>
      </Container>

      <ShopLocationDialog
        open={locationDialogOpen}
        onClose={handleLocationDialogClose}
        savedAddresses={[]}
        onSelectAddress={handleSelectAddress}
      />


    </Box>
  );
}
