import React, { useState, useEffect } from "react";
import { Box, Typography, Dialog, DialogContent, DialogActions, Button } from "@mui/material";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "../../firebase";
import ShopPage from "../marketplace/ShopPage";
import ShopLocationDialog from "../marketplace/components/ShopLocationDialog";
import {
  memberShellBackground,
} from "./memberLayout";

const MemberMarketplace = () => {
  const [shopPageLoaded, setShopPageLoaded] = useState(false);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [userHasAddress, setUserHasAddress] = useState(false);
  const [addressCheckDone, setAddressCheckDone] = useState(false);
  const [showAddressConfirmedDialog, setShowAddressConfirmedDialog] = useState(false);

  // Check if user has a delivery address saved in Firebase
  useEffect(() => {
    const checkSavedAddress = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          setAddressCheckDone(true);
          return;
        }

        const userRef = doc(db, "users", user.uid);
        const userData = await getDoc(userRef);
        
        if (userData.exists()) {
          const deliveryAddress = userData.data()?.deliveryAddress;
          setUserHasAddress(!!deliveryAddress);
        }
      } catch (error) {
        console.error("Error checking saved address:", error);
      } finally {
        setAddressCheckDone(true);
      }
    };

    if (shopPageLoaded) {
      checkSavedAddress();
    }
  }, [shopPageLoaded]);

  const handleLocationDialogClose = () => {
    setLocationDialogOpen(false);
  };

  const handleSelectAddress = async ({ address, cityProvince, location }) => {
    try {
      const user = auth.currentUser;
      if (!user) {
        console.error("No user logged in - auth.currentUser is null");
        return false;
      }

      console.log("Saving address for user:", user.uid);

      // Save to Firebase Firestore
      const userRef = doc(db, "users", user.uid);
      const locationPayload = {
        deliveryAddress: address,
        deliveryAddressCityProvince: cityProvince,
        deliveryAddressLocation: location || null,
        deliveryAddressUpdatedAt: new Date().toISOString(),
      };

      const userShopLocationRef = doc(db, "usershoplocation", user.uid);

      console.log("Writing to both users and usershoplocation collections...");
      await Promise.all([
        setDoc(userRef, locationPayload, { merge: true }),
        setDoc(userShopLocationRef, {
          ...locationPayload,
          userId: user.uid,
          source: "member_marketplace",
        }, { merge: true }),
      ]);

      console.log("✓ Address saved successfully!");
      setUserHasAddress(true);
      setLocationDialogOpen(false);
      setShowAddressConfirmedDialog(true);
      return true;
    } catch (error) {
      console.error("✗ Error saving address to Firebase:", error);
      console.error("Error code:", error.code);
      console.error("Error message:", error.message);
      return false;
    }
  };

  const handleShopPageLoaded = () => {
    setShopPageLoaded(true);
  };

  useEffect(() => {
    if (!shopPageLoaded || !addressCheckDone) return;

    if (!userHasAddress) {
      setLocationDialogOpen(true);
      return;
    }

    setLocationDialogOpen(false);
  }, [shopPageLoaded, addressCheckDone, userHasAddress]);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: memberShellBackground,
        pt: 0,
        pb: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box sx={{ maxWidth: 460, mx: "auto", width: "100%", flex: 1 }}>
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

        {shopPageLoaded && (
          <Box sx={{ px: 0, minHeight: "100vh" }}>
            <ShopPage
              isEmbedded={true}
              onLoaded={handleShopPageLoaded}
              onRequestLocationPicker={() => setLocationDialogOpen(true)}
            />
          </Box>
        )}

        <ShopLocationDialog
          open={locationDialogOpen}
          onClose={handleLocationDialogClose}
          savedAddresses={[]}
          onSelectAddress={handleSelectAddress}
        />

        <Dialog
          open={showAddressConfirmedDialog}
          onClose={() => setShowAddressConfirmedDialog(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogContent sx={{ pt: 3, pb: 2, textAlign: "center" }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
              Address Confirmed ✓
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Your delivery address has been saved successfully.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ p: 2, pt: 0 }}>
            <Button
              onClick={() => setShowAddressConfirmedDialog(false)}
              variant="contained"
              sx={{ textTransform: "none", width: "100%" }}
            >
              Continue
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
};

export default MemberMarketplace;