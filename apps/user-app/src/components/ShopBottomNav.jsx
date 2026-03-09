import React from "react";
import { Badge, Box, Paper, Typography } from "@mui/material";

const MaterialIcon = ({ name, filled = false }) => (
  <span
    className="material-symbols-outlined"
    style={{
      fontSize: 22,
      fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400`,
    }}
  >
    {name}
  </span>
);

const ShopBottomNav = ({ value, onChange, cartCount = 0 }) => (
  <Paper
    elevation={0}
    sx={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      borderTop: "1px solid",
      borderColor: "#e5e7eb",
      bgcolor: "rgba(255, 255, 255, 0.95)",
      backdropFilter: "blur(10px)",
      height: 76,
      zIndex: 1000,
    }}
  >
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        px: 3,
        pt: 1.5,
        pb: 2.5,
      }}
    >
      {[
        { label: "Food", value: "food", icon: "restaurant" },
        { label: "Grocery", value: "grocery", icon: "shopping_basket" },
        { label: "Leisure", value: "leisure", icon: "weekend" },
        { label: "Market", value: "cart", icon: "storefront" },
        { label: "Account", value: "account", icon: "account_circle" },
      ].map((item) => {
        const isActive = value === item.value;
        return (
          <Box
            key={item.value}
            onClick={() => onChange?.(item.value)}
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 0.5,
              color: isActive ? "#3b4a6b" : "#94a3b8",
              cursor: "pointer",
            }}
          >
            {item.value === "cart" ? (
              <Badge color="error" badgeContent={cartCount} max={99}>
                <MaterialIcon name={item.icon} filled={isActive} />
              </Badge>
            ) : (
              <MaterialIcon name={item.icon} filled={isActive} />
            )}
            <Typography sx={{ fontSize: "0.6rem", fontWeight: isActive ? 700 : 600 }}>
              {item.label}
            </Typography>
          </Box>
        );
      })}
    </Box>
  </Paper>
);

export default ShopBottomNav;
