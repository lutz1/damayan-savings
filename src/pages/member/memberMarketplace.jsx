import React, { useEffect, useMemo, useState } from "react";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import StorefrontIcon from "@mui/icons-material/Storefront";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import { useNavigate } from "react-router-dom";
import MemberBottomNav from "../../components/MemberBottomNav";
import {
  memberPageTopInset,
  memberStickyHeaderInset,
  memberShellBackground,
  memberHeroBackground,
  memberGlassPanelSx,
  memberSoftPanelSx,
} from "./memberLayout";

const memberPalette = {
  navy: "#0b1f5e",
  royal: "#173a8a",
  gold: "#d4af37",
  surface: "#f7f9fc",
};

const getMarketplaceUrl = () => {
  if (window.location.hostname === "localhost") {
    return "http://localhost:3001/shop?embedded=member";
  }

  const origin = window.location.origin;
  return `${origin}/damayan-savings/user/shop?embedded=member`;
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
        background: memberShellBackground,
        pt: memberPageTopInset,
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
            background: memberHeroBackground,
            borderBottom: "1px solid rgba(148, 190, 255, 0.16)",
            backdropFilter: "blur(18px)",
            position: "sticky",
            top: 0,
            pt: memberStickyHeaderInset,
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
              ...memberGlassPanelSx,
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
              ...memberSoftPanelSx,
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
                  background: "linear-gradient(180deg, rgba(6,19,46,0.95) 0%, rgba(10,29,69,0.96) 100%)",
                  zIndex: 1,
                }}
              >
                <CircularProgress sx={{ color: "#8ac7ff" }} />
                <Typography sx={{ fontSize: 13, color: "#f8fbff", fontWeight: 700 }}>
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