import React from "react";
import {
  Card,
  CardContent,
  Stack,
  Typography,
  Avatar,
} from "@mui/material";

export default function AdvertisementBanner({ hidden = false }) {
  return (
    <Card
      sx={{
        mb: 2,
        borderRadius: 2,
        boxShadow: "0 12px 24px rgba(0,0,0,0.08)",
        background: "linear-gradient(135deg, #ffeaf3 0%, #fff4f8 50%, #fff8fb 100%)",
        opacity: hidden ? 0 : 1,
        maxHeight: hidden ? 0 : 200,
        marginBottom: hidden ? 0 : 2,
        overflow: "hidden",
        transform: hidden ? "translateY(-10px)" : "translateY(0)",
        transition: "opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), margin 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        willChange: "opacity, transform, max-height, margin",
      }}
    >
      <CardContent>
        <Stack direction="row" spacing={2} alignItems="center">
          <Avatar sx={{ bgcolor: "#e91e63", width: 44, height: 44 }}>★</Avatar>
          <Stack spacing={0.5}>
            <Typography variant="subtitle1" fontWeight={700} color="#ad1457">
              Discover deals near you
            </Typography>
            <Typography variant="body2" color="#c2185b">
              Fresh picks updated daily. Tap to explore.
            </Typography>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
