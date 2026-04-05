// src/components/MemberBottomNav.jsx
import React from "react";
import { Box, Button, Typography } from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";
import HomeIcon from "@mui/icons-material/Home";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import RedeemIcon from "@mui/icons-material/Redeem";
import PersonIcon from "@mui/icons-material/Person";

const memberPalette = {
  navy: "#0b1f5e",
  gold: "#d4af37",
};

const MemberBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const activeColor = "rgba(255,255,255,0.95)";
  const inactiveColor = "rgba(255,255,255,0.66)";

  const isActive = (path) => location.pathname.startsWith(path);

  const handleOpenScanToPay = () => {
    navigate("/member/dashboard", {
      state: {
        openScanToPay: true,
        fromPath: location.pathname,
        ts: Date.now(),
      },
    });
  };

  return (
    <Box
      sx={{
        position: "fixed",
        bottom: 0,
        left: 0,
        width: "100%",
        background: "linear-gradient(180deg, rgba(8,23,52,0.94) 0%, rgba(11,31,94,0.98) 100%)",
        backdropFilter: "blur(12px)",
        borderTopLeftRadius: 26,
        borderTopRightRadius: 26,
        borderTop: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "0 -12px 32px rgba(6,18,45,0.22)",
        py: 1.1,
        zIndex: 20,
      }}
    >
      <Box
        sx={{
          maxWidth: 460,
          mx: "auto",
          px: 1.5,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Button
          onClick={() => navigate("/member/dashboard")}
          sx={{
            minWidth: 0,
            color: isActive("/member/dashboard") ? activeColor : inactiveColor,
            display: "flex",
            flexDirection: "column",
            gap: 0.4,
            "&:hover": { color: activeColor, backgroundColor: "transparent" },
          }}
        >
          <HomeIcon sx={{ fontSize: 22 }} />
          <Typography sx={{ fontSize: 10, fontWeight: 700, lineHeight: 1 }}>Home</Typography>
        </Button>

        <Button
          onClick={() => navigate("/member/income/payback")}
          sx={{
            minWidth: 0,
            color: isActive("/member/income/payback") ? activeColor : inactiveColor,
            display: "flex",
            flexDirection: "column",
            gap: 0.4,
            "&:hover": { color: activeColor, backgroundColor: "transparent" },
          }}
        >
          <ReceiptLongIcon sx={{ fontSize: 22 }} />
          <Typography sx={{ fontSize: 10, fontWeight: 700, lineHeight: 1 }}>PAYBACK</Typography>
        </Button>

        <Button
          onClick={handleOpenScanToPay}
          sx={{
            minWidth: 0,
            color: "#fff",
            mt: -2.2,
            display: "flex",
            flexDirection: "column",
            gap: 0.7,
            "&:hover": { backgroundColor: "transparent" },
          }}
        >
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: "18px",
              background: `linear-gradient(145deg, ${memberPalette.gold} 0%, #e6c565 100%)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 12px 22px rgba(212,175,55,0.28)",
            }}
          >
            <QrCodeScannerIcon sx={{ fontSize: 28 }} />
          </Box>
          <Typography sx={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.72)", lineHeight: 1 }}>
            Scan
          </Typography>
        </Button>

        <Button
          onClick={() => navigate("/member/income/capital-share")}
          sx={{
            minWidth: 0,
            color: isActive("/member/income/capital-share") ? activeColor : inactiveColor,
            display: "flex",
            flexDirection: "column",
            gap: 0.4,
            "&:hover": { color: activeColor, backgroundColor: "transparent" },
          }}
        >
          <RedeemIcon sx={{ fontSize: 22 }} />
          <Typography sx={{ fontSize: 10, fontWeight: 700, lineHeight: 1 }}>CAPITAL</Typography>
        </Button>

        <Button
          onClick={() => navigate("/member/profile")}
          sx={{
            minWidth: 0,
            color: isActive("/member/profile") ? activeColor : inactiveColor,
            display: "flex",
            flexDirection: "column",
            gap: 0.4,
            "&:hover": { color: activeColor, backgroundColor: "transparent" },
          }}
        >
          <PersonIcon sx={{ fontSize: 22 }} />
          <Typography sx={{ fontSize: 10, fontWeight: 700, lineHeight: 1 }}>Profile</Typography>
        </Button>
      </Box>
    </Box>
  );
};

export default MemberBottomNav;
