// src/components/BottomNav.jsx
import React from "react";
import {
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  Box,
} from "@mui/material";
import { useNavigate, useLocation } from "react-router-dom";

// Material Symbols Icon Component
const MaterialIcon = ({ name, filled = false }) => (
  <span
    className="material-symbols-outlined"
    style={{
      fontSize: 24,
      fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400`
    }}
  >
    {name}
  </span>
);

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { label: 'Dashboard', value: '/merchant/dashboard', icon: 'dashboard' },
    { label: 'Orders', value: '/merchant/orders', icon: 'receipt_long' },
    { label: 'Products', value: '/merchant/products', icon: 'inventory' },
    { label: 'My Store', value: '/merchant/store-profile', icon: 'storefront' },
    { label: 'Account', value: '/merchant/profile', icon: 'account_circle' },
  ];

  return (
    <Paper
      elevation={0}
      sx={{
        position: "fixed",
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '600px',
        borderTop: '1px solid',
        borderColor: 'divider',
        bgcolor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(12px)',
        zIndex: 1000,
        pb: 'env(safe-area-inset-bottom, 0px)'
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          px: 1,
          pt: 1.5,
          pb: 3
        }}
      >
        {navItems.map((item) => {
          const isActive = location.pathname === item.value || 
                          (item.value === '/merchant/dashboard' && location.pathname === '/merchant');
          
          return (
            <Box
              key={item.value}
              onClick={() => navigate(item.value)}
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0.5,
                cursor: 'pointer',
                color: isActive ? '#2b7cee' : '#94a3b8',
                transition: 'color 0.2s',
                '&:hover': { color: '#2b7cee' }
              }}
            >
              <MaterialIcon name={item.icon} filled={isActive} />
              <Box
                component="span"
                sx={{
                  fontSize: '0.625rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
              >
                {item.label}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
};

export default BottomNav;