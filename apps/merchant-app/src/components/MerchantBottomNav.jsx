import React from "react";
import { Box, Button, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";

const navItems = [
  { key: "dashboard", label: "Home", path: "/dashboard", icon: "home" },
  { key: "orders", label: "Orders", path: "/orders", icon: "receipt_long" },
  { key: "products", label: "Products", path: "/products", icon: "inventory_2" },
  { key: "vouchers", label: "Vouchers", path: "/vouchers", icon: "card_giftcard" },
  { key: "profile", label: "Profile", path: "/profile", icon: "person" },
];

const MaterialIcon = ({ name, size = 22, filled = false }) => (
  <span
    className="material-symbols-outlined"
    style={{
      fontSize: size,
      fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 500`,
      lineHeight: 1,
    }}
  >
    {name}
  </span>
);

export default function MerchantBottomNav({ activePath }) {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        position: "fixed",
        left: "50%",
        transform: "translateX(-50%)",
        bottom: 0,
        width: "100%",
        maxWidth: 600,
        bgcolor: "rgba(255,255,255,0.96)",
        borderTop: "1px solid #e2e8f0",
        px: 1,
        pt: 1,
        pb: 2,
        zIndex: 30,
        backdropFilter: "blur(10px)",
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-around" }}>
        {navItems.map((item) => {
          const active = activePath === item.path;
          return (
            <Button
              key={item.key}
              onClick={() => navigate(item.path)}
              sx={{
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                gap: 0.35,
                color: active ? "#2b7cee" : "#94a3b8",
                fontWeight: active ? 800 : 600,
                textTransform: "none",
              }}
            >
              <MaterialIcon name={item.icon} size={24} filled={active} />
              <Typography sx={{ fontSize: 10, fontWeight: active ? 800 : 600, lineHeight: 1.2 }}>
                {item.label}
              </Typography>
            </Button>
          );
        })}
      </Box>
    </Box>
  );
}
