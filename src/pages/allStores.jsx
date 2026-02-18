import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Card,
  CardMedia,
  Stack,
  Typography,
  Container,
  IconButton,
  AppBar,
  Toolbar,
} from "@mui/material";
import {
  ArrowBack as ArrowBackIcon,
  FavoriteBorder as FavoriteBorderIcon,
  AccessTime as AccessTimeIcon,
  Timer as TimerIcon,
  LocalShipping as LocalShippingIcon,
  LocationOn as LocationOnIcon,
} from "@mui/icons-material";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import ShopBottomNav from "../components/ShopBottomNav";

export default function AllStoresPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [merchants, setMerchants] = useState([]);
  const [isExiting, setIsExiting] = useState(false);

  const handleBack = () => {
    setIsExiting(true);
    setTimeout(() => navigate(-1), 300);
  };

  useEffect(() => {
    const loadMerchants = async () => {
      try {
        const productsSnap = await getDocs(
          query(collection(db, "products"), where("status", "==", "active"))
        );

        const approvedProducts = productsSnap.docs.filter((d) => {
          const approvalStatus = (d.data().approvalStatus || "").toString().toUpperCase();
          return approvalStatus === "APPROVED";
        });

        const merchantIds = [...new Set(approvedProducts.map((d) => d.data().merchantId).filter(Boolean))];

        const merchantData = await Promise.all(
          merchantIds.map(async (id) => {
            const merchantSnap = await getDoc(doc(db, "merchants", id));
            return merchantSnap.exists() ? { id, ...merchantSnap.data() } : null;
          })
        );

        setMerchants(merchantData.filter(Boolean));
      } catch (err) {
        console.error("Error loading merchants:", err);
      } finally {
        setLoading(false);
      }
    };

    loadMerchants();
  }, []);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#f5f5f5",
        pb: 12,
        pt: 8,
        animation: isExiting ? "slideOutRight 0.3s ease-out forwards" : "slideInRight 0.3s ease-out",
        "@keyframes slideInRight": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        "@keyframes slideOutRight": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(100%)" },
        },
      }}
    >
      <AppBar
        position="fixed"
        sx={{
          bgcolor: "#fff",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          zIndex: 1100,
        }}
      >
        <Toolbar>
          <IconButton edge="start" onClick={handleBack} sx={{ color: "#333" }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 2, color: "#333", fontWeight: 600 }}>
            All Stores
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="sm" sx={{ pt: 10 }}>
        {loading ? (
          <Typography variant="body1" sx={{ textAlign: "center", py: 4 }}>
            Loading stores...
          </Typography>
        ) : merchants.length === 0 ? (
          <Typography variant="body1" sx={{ textAlign: "center", py: 4 }}>
            No stores available
          </Typography>
        ) : (
          <Stack spacing={2}>
            {merchants.map((merchant) => (
              <Box key={merchant.id}>
                <Card sx={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)", overflow: "hidden", borderRadius: 2 }}>
                  <Box sx={{ position: "relative", height: 180, bgcolor: "#eee" }}>
                    <CardMedia
                      component="img"
                      image={merchant.coverImage || "/icons/icon-192x192.png"}
                      alt="Store cover"
                      sx={{ height: "100%", width: "100%", objectFit: "cover" }}
                    />
                    <IconButton
                      size="small"
                      sx={{
                        position: "absolute",
                        top: 12,
                        right: 12,
                        bgcolor: "rgba(255,255,255,0.95)",
                        "&:hover": { bgcolor: "#fff" },
                      }}
                      aria-label="favorite"
                    >
                      <FavoriteBorderIcon sx={{ color: "#d32f2f" }} />
                    </IconButton>
                  </Box>
                </Card>
                <Stack spacing={1} sx={{ mt: 2, px: 1 }}>
                  <Typography variant="h6" fontWeight="bold">
                    {merchant.storeName || "Shop"}
                  </Typography>
                  {merchant.hours && (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <AccessTimeIcon sx={{ fontSize: 18, color: "#90a4ae" }} />
                      <Typography variant="body2" color="#607d8b">
                        Hours: {merchant.hours}
                      </Typography>
                    </Stack>
                  )}
                  {merchant.deliveryTime && (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <TimerIcon sx={{ fontSize: 18, color: "#90a4ae" }} />
                      <Typography variant="body2" color="#607d8b">
                        Delivery time: {merchant.deliveryTime}
                      </Typography>
                    </Stack>
                  )}
                  {(merchant.deliveryRadiusKm || merchant.deliveryRatePerKm) && (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <LocalShippingIcon sx={{ fontSize: 18, color: "#90a4ae" }} />
                      <Typography variant="body2" color="#607d8b">
                        Delivery fee: {merchant.deliveryRatePerKm ? `₱${merchant.deliveryRatePerKm}/km` : "-"}
                        {merchant.deliveryRadiusKm ? ` within ${merchant.deliveryRadiusKm} km` : ""}
                      </Typography>
                    </Stack>
                  )}
                  {merchant.location && (
                    <Stack direction="row" spacing={1} alignItems="flex-start">
                      <LocationOnIcon sx={{ fontSize: 18, color: "#90a4ae", mt: 0.25 }} />
                      <Typography variant="body2" color="#607d8b" sx={{ flex: 1 }}>
                        {merchant.location}
                      </Typography>
                    </Stack>
                  )}
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </Container>

      <ShopBottomNav
        value="food"
        onChange={(value) => {
          if (value === "food" || value === "grocery" || value === "leisure") {
            setIsExiting(true);
            setTimeout(() => navigate("/shop"), 300);
          } else if (value === "account") {
            navigate("/login");
          }
        }}
        cartCount={0}
      />
    </Box>
  );
}
