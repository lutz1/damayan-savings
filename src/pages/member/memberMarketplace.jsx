import React, { useEffect, useMemo, useState } from "react";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import StorefrontIcon from "@mui/icons-material/Storefront";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import { useNavigate } from "react-router-dom";
import MemberBottomNav from "../../components/MemberBottomNav";

const memberPalette = {
  navy: "#0b1f5e",
  royal: "#173a8a",
  gold: "#d4af37",
  surface: "#f7f9fc",
};

const getMarketplaceUrl = () => {
  if (window.location.hostname === "localhost") {
    return "http://localhost:3001/shop";
  }

  const origin = window.location.origin;
  return `${origin}/damayan-savings/user/shop`;
};

const MemberMarketplace = () => {
  const navigate = useNavigate();
  const [frameLoaded, setFrameLoaded] = useState(false);
  const marketplaceUrl = useMemo(() => getMarketplaceUrl(), []);

  useEffect(() => {
    setFrameLoaded(false);
  }, [marketplaceUrl]);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #0b1f5e 0%, #173a8a 22%, #f4f7fb 22%, #f7f9fc 100%)",
        pb: 11,
      }}
    >
      <Box sx={{ maxWidth: 460, mx: "auto" }}>
        <Box
          sx={{
            minHeight: 70,
            px: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            color: "#fff",
            background: "linear-gradient(135deg, #0b1f5e 0%, #173a8a 55%, #d4af37 100%)",
            position: "sticky",
            top: 0,
            zIndex: 5,
          }}
        >
          <Button
            onClick={() => navigate("/member/dashboard")}
            sx={{ minWidth: 40, color: "#fff", p: 0.5 }}
          >
            <ArrowBackIosNewIcon />
          </Button>
          <Typography sx={{ fontSize: 18, fontWeight: 800, letterSpacing: 0.2 }}>
            Market Place
          </Typography>
          <Button
            onClick={() => window.open(marketplaceUrl, "_blank", "noopener,noreferrer")}
            sx={{ minWidth: 40, color: "#fff", p: 0.5 }}
          >
            <OpenInNewIcon />
          </Button>
        </Box>

        <Box sx={{ px: 2, pt: 2, pb: 1.5 }}>
          <Box
            sx={{
              borderRadius: 3,
              p: 2,
              color: "#fff",
              background: "linear-gradient(135deg, rgba(11,31,94,0.96) 0%, rgba(23,58,138,0.94) 58%, rgba(212,175,55,0.88) 100%)",
              boxShadow: "0 18px 40px rgba(11,31,94,0.24)",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.2, mb: 1 }}>
              <Box
                sx={{
                  width: 42,
                  height: 42,
                  borderRadius: 2,
                  backgroundColor: "rgba(255,255,255,0.16)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <StorefrontIcon sx={{ color: "#fff" }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.8)", letterSpacing: 1 }}>
                  USER APP
                </Typography>
                <Typography sx={{ fontSize: 22, fontWeight: 800, lineHeight: 1.05 }}>
                  ShopPage
                </Typography>
              </Box>
            </Box>
            <Typography sx={{ fontSize: 13, color: "rgba(255,255,255,0.92)", lineHeight: 1.5 }}>
              Browse the live marketplace below. If the embedded shop does not load, open it in a new tab.
            </Typography>
          </Box>
        </Box>

        <Box sx={{ px: 2 }}>
          <Box
            sx={{
              position: "relative",
              minHeight: 640,
              borderRadius: 3,
              overflow: "hidden",
              border: "1px solid rgba(11,31,94,0.08)",
              backgroundColor: memberPalette.surface,
              boxShadow: "0 14px 34px rgba(11,31,94,0.12)",
            }}
          >
            {!frameLoaded && (
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 1.5,
                  backgroundColor: "rgba(247,249,252,0.96)",
                  zIndex: 1,
                }}
              >
                <CircularProgress sx={{ color: memberPalette.royal }} />
                <Typography sx={{ fontSize: 13, color: memberPalette.navy, fontWeight: 700 }}>
                  Loading marketplace...
                </Typography>
              </Box>
            )}

            <Box
              component="iframe"
              src={marketplaceUrl}
              title="Market Place"
              onLoad={() => setFrameLoaded(true)}
              sx={{
                width: "100%",
                minHeight: 640,
                border: 0,
                display: "block",
                backgroundColor: "#fff",
              }}
            />
          </Box>
        </Box>
      </Box>

      <MemberBottomNav />
    </Box>
  );
};

export default MemberMarketplace;