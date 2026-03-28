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

  const activeColor = memberPalette.navy;
  const inactiveColor = "#8b95a5";

  const isActive = (path) => location.pathname === path;

  return (
    <Box
      sx={{
        position: "fixed",
        bottom: 0,
        left: 0,
        width: "100%",
        backgroundColor: "rgba(255,255,255,0.88)",
        backdropFilter: "blur(8px)",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        boxShadow: "0 -8px 22px rgba(25,28,30,0.08)",
        py: 1,
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
            "&:hover": { color: activeColor },
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
            "&:hover": { color: activeColor },
          }}
        >
          <ReceiptLongIcon sx={{ fontSize: 22 }} />
          <Typography sx={{ fontSize: 10, fontWeight: 700, lineHeight: 1 }}>PAYBACK</Typography>
        </Button>

        <Button
          sx={{
            minWidth: 0,
            color: "#fff",
            mt: -2.5,
            display: "flex",
            flexDirection: "column",
            gap: 0.7,
          }}
        >
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              backgroundColor: memberPalette.gold,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 10px 18px rgba(212,175,55,0.35)",
            }}
          >
            <QrCodeScannerIcon sx={{ fontSize: 28 }} />
          </Box>
          <Typography sx={{ fontSize: 10, fontWeight: 700, color: inactiveColor, lineHeight: 1 }}>
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
            "&:hover": { color: activeColor },
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
            "&:hover": { color: activeColor },
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
