// src/pages/merchant/merchantProfile.jsx
import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Avatar,
  Button,
  Divider,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import BottomNav from "../../components/BottomNav";

const MerchantProfile = () => {
  const navigate = useNavigate();
  const [merchantId, setMerchantId] = useState(
    localStorage.getItem("uid") || null
  );

  const [merchantData, setMerchantData] = useState(null);

  /* ======================
     LOAD MERCHANT DATA
  ====================== */
useEffect(() => {
  if (!merchantId) return;

  const loadMerchant = async () => {
    try {
      const snap = await getDoc(doc(db, "users", merchantId));
      console.log("User doc:", snap.data());
      if (snap.exists()) {
        setMerchantData(snap.data());
      } else {
        console.warn("No merchant found for UID:", merchantId);
      }
    } catch (err) {
      console.error("Failed to load merchant data:", err);
    }
  };

  loadMerchant();
}, [merchantId]);

  // If there's no UID in localStorage, wait for auth state to provide it
  useEffect(() => {
    if (merchantId) return;
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setMerchantId(user.uid);
        try {
          localStorage.setItem("uid", user.uid);
        } catch (e) {
          /* ignore storage errors */
        }
      }
    });
    return unsub;
  }, [merchantId]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.warn("Sign out failed, continuing to clear storage", err);
    }

    try {
      localStorage.clear();
    } catch (e) {
      /* ignore storage errors */
    }

    navigate("/login");
  };

  if (!merchantData) {
    return (
      <Box sx={{ textAlign: "center", mt: 5 }}>
        Loading merchant info...
      </Box>
    );
  }

  const { merchantProfile, name, email, contactNumber, address, status } =
    merchantData;

  return (
    <Box sx={{ pb: 10, px: 2, pt: 2, minHeight: "100vh", bgcolor: "#f5f5f5" }}>
      <Typography variant="h5" fontWeight="bold" mb={2}>
        {merchantProfile?.merchantName || "Merchant"} Profile
      </Typography>

      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ display: "flex", alignItems: "center" }}>
          <Avatar sx={{ width: 64, height: 64, mr: 2 }}>
            {merchantProfile?.merchantName?.[0] || "M"}
          </Avatar>
          <Box>
            <Typography variant="h6">
              {merchantProfile?.merchantName || "Merchant Name"}
            </Typography>
            <Typography variant="body2" color="gray">
              {status?.toUpperCase() || "ACTIVE"}
            </Typography>
          </Box>
        </CardContent>
      </Card>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" color="gray">
            Owner Name
          </Typography>
          <Typography variant="body1" mb={1}>
            {name}
          </Typography>

          <Typography variant="subtitle2" color="gray">
            Email
          </Typography>
          <Typography variant="body1" mb={1}>
            {email}
          </Typography>

          <Typography variant="subtitle2" color="gray">
            Contact Number
          </Typography>
          <Typography variant="body1" mb={1}>
            {contactNumber}
          </Typography>

          <Typography variant="subtitle2" color="gray">
            Address
          </Typography>
          <Typography variant="body1">{address}</Typography>
        </CardContent>
      </Card>

      <Button
        variant="contained"
        color="primary"
        fullWidth
        sx={{ mb: 1 }}
        onClick={() => alert("Edit Profile clicked!")}
      >
        Edit Profile
      </Button>

      <Button
        variant="outlined"
        color="error"
        fullWidth
        onClick={handleLogout}
      >
        Logout
      </Button>

      <Divider sx={{ my: 2 }} />

      <BottomNav />
    </Box>
  );
};

export default MerchantProfile;