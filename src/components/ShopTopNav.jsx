import React, { useState, useRef } from "react";
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
} from "@mui/material";
import {
  Search as SearchIcon,
  LocationOn,
  Notifications,
  ArrowBack,
  KeyboardVoice as VoiceIcon,
  ShoppingCart,
} from "@mui/icons-material";
import AdvertisementBanner from "./AdvertisementBanner";

const TOP_NAV_COLOR = "#435272ff";

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
}) {
  const [listening, setListening] = useState(false);
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

  return (
    <Box
      sx={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 120,
        bgcolor: TOP_NAV_COLOR,
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
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
            <IconButton size="small" sx={{ color: "white" }} onClick={onBackClick} aria-label="back">
              <ArrowBack />
            </IconButton>
            <LocationOn sx={{ opacity: 0.9, color: "white" }} />
            <Box
              sx={{
                lineHeight: 1,
                cursor: "pointer",
                flex: 1,
                transition: "opacity 0.2s ease",
                "&:hover": { opacity: 0.8 },
              }}
              onClick={onLocationClick}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 700, whiteSpace: "nowrap", color: "white" }}>
                Current Location
              </Typography>
              <Typography variant="caption" sx={{ display: "block", whiteSpace: "normal", opacity: 0.9, color: "white", overflow: "hidden", textOverflow: "ellipsis", maxLines: 1 }}>
                {locationSubtext}
              </Typography>
            </Box>

            <Box sx={{ flex: 1 }} />
            <IconButton
              size="small"
              sx={{ color: "white" }}
              aria-label="cart"
              onClick={onCartClick}
            >
              <Badge color="error" badgeContent={cartCount} max={99}>
                <ShoppingCart />
              </Badge>
            </IconButton>
            <IconButton size="small" sx={{ color: "white" }} aria-label="notifications">
              <Notifications />
            </IconButton>
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
              bgcolor: "#f2f2f7",
              borderRadius: 2.5,
              boxShadow: "none",
              "& .MuiOutlinedInput-root": {
                borderRadius: 2.5,
                fontSize: "15px",
                fontWeight: 400,
                color: "#000000",
                bgcolor: "#f2f2f7",
                transition: "all 0.2s ease",
                "& fieldset": {
                  border: "none",
                },
                "&:hover": {
                  bgcolor: "#e5e5ea",
                },
                "&.Mui-focused": {
                  bgcolor: "#ffffff",
                  boxShadow: "0 0 0 1px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.08)",
                  "& .MuiInputAdornment-root .MuiSvgIcon-root": {
                    color: "#007aff",
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

          <AdvertisementBanner hidden={adHidden} />
        </Stack>
      </Container>
    </Box>
  );
}
