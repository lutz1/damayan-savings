import React, { useState, useEffect } from "react";
import { Box, Button, Typography, CircularProgress } from "@mui/material";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import { useNavigate } from "react-router-dom";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { auth, db } from "../../firebase";
import ShopPage from "../marketplace/ShopPage";
import ShopLocationDialog from "../marketplace/components/ShopLocationDialog";
import MemberBottomNav from "../../components/MemberBottomNav";
import {
  memberPageTopInset,
  memberStickyHeaderInset,
  memberShellBackground,
  memberHeroBackground,
} from "./memberLayout";

const MemberMarketplace = () => {
  const navigate = useNavigate();
  const [shopPageLoaded, setShopPageLoaded] = useState(false);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [userHasAddress, setUserHasAddress] = useState(false);

  // Check if user has a delivery address saved in Firebase
  useEffect(() => {
    const checkSavedAddress = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const userRef = doc(db, "users", user.uid);
        const userData = await getDoc(userRef);
        
        if (userData.exists()) {
          const deliveryAddress = userData.data()?.deliveryAddress;
          setUserHasAddress(!!deliveryAddress);
        }
      } catch (error) {
        console.error("Error checking saved address:", error);
      }
    };

    if (shopPageLoaded) {
      checkSavedAddress();
    }
  }, [shopPageLoaded]);

  const handleLocationDialogClose = () => {
    setLocationDialogOpen(false);
  };

  const handleSelectAddress = async ({ address, cityProvince }) => {
    try {
      const user = auth.currentUser;
      if (!user) {
        console.error("No user logged in");
        return;
      }

      // Save to Firebase Firestore
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        deliveryAddress: address,
        deliveryAddressCityProvince: cityProvince,
        deliveryAddressUpdatedAt: new Date().toISOString(),
      });

      setUserHasAddress(true);
      setLocationDialogOpen(false);
    } catch (error) {
      console.error("Error saving address to Firebase:", error);
      // Show error toast/notification here if needed
    }
  };

  const handleShopPageLoaded = () => {
    setShopPageLoaded(true);
    // Auto-open location dialog after loading completes if no address saved
    if (!userHasAddress) {
      setLocationDialogOpen(true);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: memberShellBackground,
        pt: memberPageTopInset,
        pb: 11,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box sx={{ maxWidth: 460, mx: "auto", width: "100%", flex: 1 }}>
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
          <Box sx={{ minWidth: 40 }} />
        </Box>

        {!shopPageLoaded && (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 600,
              background: "linear-gradient(180deg, rgba(11, 31, 94, 0.2) 0%, rgba(23, 58, 138, 0.15) 100%)",
              gap: 3,
              py: 4,
              px: 2,
            }}
          >
            <Box
              sx={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 120,
                height: 120,
              }}
            >
              {/* Outer rotating ring */}
              <Box
                sx={{
                  position: "absolute",
                  width: 120,
                  height: 120,
                  borderRadius: "50%",
                  border: "3px solid transparent",
                  borderTop: "3px solid #d4af37",
                  borderRight: "3px solid #d4af37",
                  animation: "spin 2s linear infinite",
                  "@keyframes spin": {
                    "0%": { transform: "rotate(0deg)" },
                    "100%": { transform: "rotate(360deg)" },
                  },
                }}
              />

              {/* Inner counter-rotating ring */}
              <Box
                sx={{
                  position: "absolute",
                  width: 90,
                  height: 90,
                  borderRadius: "50%",
                  border: "2px solid transparent",
                  borderBottom: "2px solid #2b7cee",
                  borderLeft: "2px solid #2b7cee",
                  animation: "spin-reverse 3s linear infinite",
                  "@keyframes spin-reverse": {
                    "0%": { transform: "rotate(360deg)" },
                    "100%": { transform: "rotate(0deg)" },
                  },
                }}
              />

              {/* Center dot */}
              <Box
                sx={{
                  position: "absolute",
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #d4af37 0%, #2b7cee 100%)",
                  boxShadow: "0 0 12px rgba(212, 175, 55, 0.4), 0 0 8px rgba(43, 124, 238, 0.4)",
                }}
              />
            </Box>

            <Box sx={{ textAlign: "center" }}>
              <Typography
                sx={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: "#ffffff",
                  letterSpacing: 0.5,
                  mb: 0.8,
                  textShadow: "0 2px 8px rgba(11, 31, 94, 0.3)",
                }}
              >
                Loading Marketplace
              </Typography>
              <Typography
                sx={{
                  fontSize: 12,
                  color: "rgba(255, 255, 255, 0.85)",
                  fontWeight: 500,
                  letterSpacing: 0.2,
                  textShadow: "0 1px 4px rgba(11, 31, 94, 0.2)",
                }}
              >
                Preparing stores and products...
              </Typography>
            </Box>
          </Box>
        )}

        <Box
          sx={{
            display: shopPageLoaded ? "block" : "none",
            px: 0,
          }}
        >
          <ShopPage
            isEmbedded={true}
            onLoaded={handleShopPageLoaded}
          />
        </Box>

        <ShopLocationDialog
          open={locationDialogOpen}
          onClose={handleLocationDialogClose}
          savedAddresses={[]}
          onSelectAddress={handleSelectAddress}
        />
      </Box>

      <MemberBottomNav />
    </Box>
  );
};

export default MemberMarketplace;