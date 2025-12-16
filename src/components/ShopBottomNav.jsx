import React from "react";
import {
  Badge,
  BottomNavigation,
  BottomNavigationAction,
  Paper,
} from "@mui/material";
import {
  AccountCircle,
  LocalGroceryStore,
  RestaurantMenu,
  ShoppingCart,
  Weekend,
} from "@mui/icons-material";

const ShopBottomNav = ({ value, onChange, cartCount = 0 }) => (
  <Paper
    elevation={10}
    sx={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      overflow: "hidden",
      height: 80,
      zIndex: 1000,
    }}
  >
    <BottomNavigation
      showLabels
      value={value}
      onChange={(_, newValue) => onChange?.(newValue)}
      sx={{
        height: "100%",
        "& .MuiBottomNavigationAction-root": {
          minWidth: 70,
          paddingTop: 5,
          paddingBottom: 8,
        },
        "& .MuiBottomNavigationAction-label": {
          fontSize: "0.85rem",
        },
      }}
    >
      <BottomNavigationAction
        label="Food"
        value="food"
        icon={<RestaurantMenu />}
      />

      <BottomNavigationAction
        label="Grocery"
        value="grocery"
        icon={<LocalGroceryStore />}
      />

      <BottomNavigationAction
        label="Leisure"
        value="leisure"
        icon={<Weekend />}
      />

      <BottomNavigationAction
        label="Carts"
        value="cart"
        icon={
          <Badge color="error" badgeContent={cartCount} max={99}>
            <ShoppingCart />
          </Badge>
        }
      />

      <BottomNavigationAction
        label="Account"
        value="account"
        icon={<AccountCircle />}
      />
    </BottomNavigation>
  </Paper>
);

export default ShopBottomNav;
