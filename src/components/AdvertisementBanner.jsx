import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  Stack,
  Typography,
  Avatar,
  Box,
} from "@mui/material";

const ads = [
  {
    icon: "★",
    iconBg: "#e91e63",
    title: "Discover deals near you",
    subtitle: "Fresh picks updated daily. Tap to explore.",
    gradient: "linear-gradient(135deg, #ffeaf3 0%, #fff4f8 50%, #fff8fb 100%)",
    titleColor: "#ad1457",
    subtitleColor: "#c2185b",
  },
  {
    icon: "🎁",
    iconBg: "#ff6f00",
    title: "Special offers this week",
    subtitle: "Save up to 50% on selected items.",
    gradient: "linear-gradient(135deg, #fff3e0 0%, #fff8f0 50%, #fffaf5 100%)",
    titleColor: "#e65100",
    subtitleColor: "#f57c00",
  },
  {
    icon: "🚚",
    iconBg: "#1976d2",
    title: "Free delivery available",
    subtitle: "On orders over ₱500 in your area.",
    gradient: "linear-gradient(135deg, #e3f2fd 0%, #f0f7ff 50%, #f5f9ff 100%)",
    titleColor: "#0d47a1",
    subtitleColor: "#1565c0",
  },
  {
    icon: "⚡",
    iconBg: "#7b1fa2",
    title: "Flash sale today only",
    subtitle: "Limited time offers. Shop now!",
    gradient: "linear-gradient(135deg, #f3e5f5 0%, #f8f0fa 50%, #faf5fc 100%)",
    titleColor: "#4a148c",
    subtitleColor: "#6a1b9a",
  },
];

export default function AdvertisementBanner({ hidden = false }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (hidden || isPaused) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % ads.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [hidden, isPaused]);

  const currentAd = ads[currentIndex];

  return (
    <Card
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      sx={{
        borderRadius: 2,
        boxShadow: "0 12px 24px rgba(0,0,0,0.08)",
        background: currentAd.gradient,
        opacity: hidden ? 0 : 1,
        visibility: hidden ? "hidden" : "visible",
        maxHeight: hidden ? 0 : 160,
        mb: hidden ? 0 : 2,
        overflow: "hidden",
        transform: hidden ? "translateY(-6px)" : "translateY(0)",
        pointerEvents: hidden ? "none" : "auto",
        transition: "opacity 200ms ease, transform 200ms ease, max-height 200ms ease, margin 200ms ease, background 500ms ease",
        willChange: "opacity, transform, max-height, margin",
        position: "relative",
      }}
    >
      <CardContent>
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar sx={{ bgcolor: currentAd.iconBg, width: 44, height: 44, transition: "background-color 500ms ease" }}>
            {currentAd.icon}
          </Avatar>
          <Stack spacing={0.5} flex={1}>
            <Typography
              variant="subtitle1"
              fontWeight={700}
              color={currentAd.titleColor}
              sx={{ transition: "color 500ms ease" }}
            >
              {currentAd.title}
            </Typography>
            <Typography
              variant="body2"
              color={currentAd.subtitleColor}
              sx={{ transition: "color 500ms ease" }}
            >
              {currentAd.subtitle}
            </Typography>
          </Stack>
        </Stack>

        {/* Dot indicators */}
        <Stack
          direction="row"
          spacing={0.75}
          justifyContent="center"
          sx={{ mt: 1.5 }}
        >
          {ads.map((_, index) => (
            <Box
              key={index}
              onClick={() => setCurrentIndex(index)}
              sx={{
                width: currentIndex === index ? 20 : 8,
                height: 8,
                borderRadius: 4,
                bgcolor: currentIndex === index ? currentAd.titleColor : "rgba(0,0,0,0.15)",
                transition: "all 300ms ease",
                cursor: "pointer",
                "&:hover": {
                  bgcolor: currentIndex === index ? currentAd.titleColor : "rgba(0,0,0,0.25)",
                },
              }}
            />
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
