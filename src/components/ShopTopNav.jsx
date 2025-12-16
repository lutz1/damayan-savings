import React from "react";
import {
  Box,
  Container,
  Stack,
  Typography,
  TextField,
  IconButton,
} from "@mui/material";
import {
  Search as SearchIcon,
  LocationOn,
  Favorite,
} from "@mui/icons-material";
import AdvertisementBanner from "./AdvertisementBanner";

const TOP_NAV_COLOR = "#e91e63"; // Foodpanda-inspired pink

export default function ShopTopNav({
  search,
  onSearchChange,
  headerHidden,
  locationText,
  locationSubtext,
  adHidden,
  onLocationClick,
}) {
  return (
    <Box
      sx={{
        position: "sticky",
        top: 0,
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
              opacity: headerHidden ? 0 : 1,
              maxHeight: headerHidden ? 0 : 48,
              transition: "opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), margin 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              mb: headerHidden ? 0 : 0.5,
              willChange: "opacity, max-height, margin",
            }}
          >
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
            <IconButton size="small" sx={{ color: "white" }} aria-label="favorite">
              <Favorite />
            </IconButton>
          </Stack>

          <TextField
            fullWidth
            placeholder="Search products..."
            value={search}
            onChange={onSearchChange}
            InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: "#607d8b" }} /> }}
            sx={{ bgcolor: "white", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", borderRadius: 1 }}
          />

          <AdvertisementBanner hidden={adHidden} />
        </Stack>
      </Container>
    </Box>
  );
}
