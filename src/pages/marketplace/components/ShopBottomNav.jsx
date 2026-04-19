import React from "react";
import { useNavigate } from "react-router-dom";
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

const ShopBottomNav = ({ value, onChange, cartCount = 0, activeTab = "food" }) => {
  const navigate = useNavigate();

  const handleNavigation = (item) => {
    if (item.action === "navigate") {
      navigate(item.path);
    } else {
      onChange?.(item.value);
    }
  };

  const navItems = [
    { label: "Food", value: "food", icon: "restaurant", action: "change" },
    { label: "Grocery", value: "grocery", icon: "shopping_basket", action: "change" },
    { label: "Market", value: "cart", icon: "storefront", action: "change" },
    { label: "Account", value: "account", icon: "account_circle", action: "change" },
  ];

  return (
    <Paper
      elevation={0}
      sx={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        borderTop: "1px solid",
        borderColor: "#d1fae5",
        bgcolor: "rgba(255, 255, 255, 0.98)",
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
          px: 1.5,
          pt: 1.5,
          pb: 2.5,
        }}
      >
        {navItems.map((item) => {
          const isActive = item.action === "navigate" ? activeTab === item.value : value === item.value;
          return (
            <Box
              key={item.value}
              onClick={() => handleNavigation(item)}
              sx={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 0.5,
                color: isActive ? "#0f766e" : "#cbd5e1",
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
};

export default ShopBottomNav;
