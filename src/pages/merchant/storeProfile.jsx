import React, { useEffect, useState } from "react";
import {
  Box,
  Paper,
  Stack,
  Typography,
  TextField,
  Button,
  IconButton,
  Snackbar,
  Alert,
  Container,
  LinearProgress,
  CircularProgress,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { auth, db, storage } from "../../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import BottomNav from "../../components/BottomNav";

const MaterialIcon = ({ name, size = 24, filled = false }) => (
  <span
    className="material-symbols-outlined"
    style={{
      fontSize: `${size}px`,
      fontVariationSettings: filled ? "'FILL' 1" : "'FILL' 0",
    }}
  >
    {name}
  </span>
);

export default function StoreProfilePage() {
  const navigate = useNavigate();
  const [merchantId, setMerchantId] = useState(localStorage.getItem("uid"));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [coverUploadProgress, setCoverUploadProgress] = useState(0);
  const [logoUploadProgress, setLogoUploadProgress] = useState(0);
  const [snack, setSnack] = useState({ open: false, severity: "success", message: "" });
  
  const [storeData, setStoreData] = useState({
    storeName: "",
    storeDescription: "",
    contactNumber: "",
    emailAddress: "",
    address: "",
    city: "",
    coverImage: "",
    logo: "",
  });

  useEffect(() => {
    if (merchantId) return;
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      setMerchantId(user.uid);
      localStorage.setItem("uid", user.uid);
    });
    return unsub;
  }, [merchantId]);

  useEffect(() => {
    if (!merchantId) return;

    const loadStoreData = async () => {
      try {
        const docSnap = await getDoc(doc(db, "users", merchantId));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setStoreData({
            storeName: data.storeName || "",
            storeDescription: data.storeDescription || "",
            contactNumber: data.phone || "",
            emailAddress: data.email || "",
            address: data.address || "",
            city: data.city || "",
            coverImage: data.coverImage || "",
            logo: data.logo || "",
          });
        }
      } catch (err) {
        console.error(err);
        setSnack({ open: true, severity: "error", message: "Failed to load store data" });
      } finally {
        setLoading(false);
      }
    };

    loadStoreData();
  }, [merchantId]);

  const handleImageUpload = async (e, imageType) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) {
      setSnack({ open: true, severity: "warning", message: "Please select a valid image" });
      return;
    }

    const isLogo = imageType === "logo";
    if (isLogo) {
      setLogoUploading(true);
      setLogoUploadProgress(0);
    } else {
      setCoverUploading(true);
      setCoverUploadProgress(0);
    }

    try {
      const storageRef = ref(storage, `users/${merchantId}/store_images/${imageType}_${Date.now()}`);
      const task = uploadBytesResumable(storageRef, file);

      task.on(
        "state_changed",
        (snapshot) => {
          const percent = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          if (isLogo) {
            setLogoUploadProgress(percent);
          } else {
            setCoverUploadProgress(percent);
          }
        },
        (err) => {
          console.error(err);
          setSnack({ open: true, severity: "error", message: "Upload failed" });
          if (isLogo) {
            setLogoUploading(false);
            setLogoUploadProgress(0);
          } else {
            setCoverUploading(false);
            setCoverUploadProgress(0);
          }
        },
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          const oldImage = storeData[imageType === "logo" ? "logo" : "coverImage"];
          
          if (oldImage) {
            try {
              const oldPath = oldImage.split("/o/")[1]?.split("?")[0];
              if (oldPath) {
                await deleteObject(ref(storage, decodeURIComponent(oldPath)));
              }
            } catch (_) {}
          }

          setStoreData((prev) => ({
            ...prev,
            [imageType === "logo" ? "logo" : "coverImage"]: url,
          }));

          if (isLogo) {
            setLogoUploading(false);
            setLogoUploadProgress(0);
          } else {
            setCoverUploading(false);
            setCoverUploadProgress(0);
          }
        }
      );
    } catch (err) {
      console.error(err);
      setSnack({ open: true, severity: "error", message: "Upload error" });
      if (isLogo) {
        setLogoUploading(false);
        setLogoUploadProgress(0);
      } else {
        setCoverUploading(false);
        setCoverUploadProgress(0);
      }
    }
  };

  const handleSubmit = async () => {
    if (!storeData.storeName.trim()) {
      setSnack({ open: true, severity: "error", message: "Store name is required" });
      return;
    }

    setSaving(true);

    try {
      await setDoc(
        doc(db, "users", merchantId),
        {
          storeName: storeData.storeName.trim(),
          storeDescription: storeData.storeDescription.trim(),
          phone: storeData.contactNumber.trim(),
          email: storeData.emailAddress.trim(),
          address: storeData.address.trim(),
          city: storeData.city.trim(),
          coverImage: storeData.coverImage,
          logo: storeData.logo,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setSnack({ open: true, severity: "success", message: "Store updated successfully!" });
    } catch (err) {
      console.error(err);
      setSnack({ open: true, severity: "error", message: "Failed to save store" });
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <LinearProgress sx={{ width: "60%" }} />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "white", pb: 28 }}>
      {/* Sticky Header */}
      <Paper
        elevation={0}
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          bgcolor: "rgba(255, 255, 255, 0.8)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid #e0e0e0",
        }}
      >
        <Box sx={{ px: 2, py: 2, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography sx={{ fontSize: "1.25rem", fontWeight: 700, color: "#0f172a" }}>
            My Store
          </Typography>
          <Button
            onClick={handleSubmit}
            disabled={saving}
            sx={{
              px: 3,
              py: 0.75,
              bgcolor: "#2b7cee",
              color: "white",
              fontWeight: 600,
              fontSize: "0.75rem",
              borderRadius: 2,
              "&:hover": { bgcolor: "#2566c8" },
            }}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </Box>
      </Paper>

      <Box sx={{ position: "relative" }}>
        {/* Cover Image */}
        <Box
          component="label"
          sx={{
            width: "100%",
            height: 192,
            bgcolor: "#e8eef7",
            position: "relative",
            overflow: "hidden",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            "&:hover": { bgcolor: "#dfe6f0" },
          }}
        >
          {storeData.coverImage ? (
            <Box
              component="img"
              src={storeData.coverImage}
              alt="Store Cover"
              sx={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.8 }}
            />
          ) : null}
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: "rgba(0, 0, 0, 0.2)",
              gap: 0.5,
              transition: "all 0.2s",
            }}
          >
            {coverUploading ? (
              <>
                <CircularProgress size={30} sx={{ color: "white" }} />
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "white" }}>
                  Uploading... {coverUploadProgress}%
                </Typography>
              </>
            ) : (
              <>
                <MaterialIcon name="photo_camera" size={32} />
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "white" }}>
                  Change Cover
                </Typography>
              </>
            )}
          </Box>
          <input hidden type="file" accept="image/*" onChange={(e) => handleImageUpload(e, "cover")} disabled={coverUploading} />
        </Box>

        {/* Store Logo & Info */}
        <Box sx={{ px: 2, pb: 3 }}>
          <Box sx={{ display: "flex", alignItems: "flex-end", gap: 2, mt: -6, mb: 2, position: "relative", zIndex: 1 }}>
            {/* Logo */}
            <Box
              component="label"
              sx={{
                position: "relative",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              {storeData.logo ? (
                <Box
                  component="img"
                  src={storeData.logo}
                  alt="Store Logo"
                  sx={{
                    width: 96,
                    height: 96,
                    borderRadius: 3,
                    border: "4px solid white",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    objectFit: "cover",
                    bgcolor: "#e8eef7",
                  }}
                />
              ) : (
                <Box
                  sx={{
                    width: 96,
                    height: 96,
                    borderRadius: 3,
                    border: "4px solid white",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    bgcolor: "#e8eef7",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <MaterialIcon name="storefront" size={48} />
                </Box>
              )}
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 3,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: "rgba(0, 0, 0, 0.3)",
                  opacity: logoUploading ? 1 : 0,
                  transition: "opacity 0.2s",
                  "&:hover": { opacity: 1 },
                }}
              >
                {logoUploading ? (
                  <Stack spacing={0.5} alignItems="center">
                    <CircularProgress size={20} sx={{ color: "white" }} />
                    <Typography sx={{ fontSize: "0.625rem", fontWeight: 700, color: "white" }}>
                      {logoUploadProgress}%
                    </Typography>
                  </Stack>
                ) : (
                  <MaterialIcon name="edit" size={20} />
                )}
              </Box>
              <input hidden type="file" accept="image/*" onChange={(e) => handleImageUpload(e, "logo")} disabled={logoUploading} />
            </Box>

            {/* Store Name & ID */}
            <Box>
              <Typography sx={{ fontSize: "1.125rem", fontWeight: 700, color: "#0f172a" }}>
                {storeData.storeName || "Your Store"}
              </Typography>
              <Typography sx={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 500 }}>
                Store ID: #{Math.random().toString(36).substr(2, 6).toUpperCase()}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      <Container maxWidth="sm">
        <Stack spacing={6} sx={{ py: 3 }}>
          {/* Store Information */}
          <Stack spacing={3}>
            <Typography sx={{ fontSize: "0.875rem", fontWeight: 700, textTransform: "uppercase", color: "#2b7cee", letterSpacing: "0.05em" }}>
              Store Information
            </Typography>

            <Box>
              <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748b", mb: 0.75 }}>
                Store Name
              </Typography>
              <TextField
                fullWidth
                value={storeData.storeName}
                onChange={(e) => setStoreData({ ...storeData, storeName: e.target.value })}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 2,
                    bgcolor: "#f8fafc",
                  },
                }}
              />
            </Box>

            <Box>
              <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748b", mb: 0.75 }}>
                Store Description
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={3}
                value={storeData.storeDescription}
                onChange={(e) => setStoreData({ ...storeData, storeDescription: e.target.value })}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 2,
                    bgcolor: "#f8fafc",
                  },
                }}
              />
            </Box>

            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
              <Box>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748b", mb: 0.75 }}>
                  Contact Number
                </Typography>
                <TextField
                  fullWidth
                  type="tel"
                  value={storeData.contactNumber}
                  onChange={(e) => setStoreData({ ...storeData, contactNumber: e.target.value })}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 2,
                      bgcolor: "#f8fafc",
                    },
                  }}
                />
              </Box>
              <Box>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748b", mb: 0.75 }}>
                  Email Address
                </Typography>
                <TextField
                  fullWidth
                  type="email"
                  value={storeData.emailAddress}
                  onChange={(e) => setStoreData({ ...storeData, emailAddress: e.target.value })}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      borderRadius: 2,
                      bgcolor: "#f8fafc",
                    },
                  }}
                />
              </Box>
            </Box>
          </Stack>

          {/* Store Location */}
          <Stack spacing={3}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Typography sx={{ fontSize: "0.875rem", fontWeight: 700, textTransform: "uppercase", color: "#2b7cee", letterSpacing: "0.05em" }}>
                Store Location
              </Typography>
              <Button
                startIcon={<MaterialIcon name="my_location" size={16} />}
                sx={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "#2b7cee",
                  textTransform: "none",
                  p: 0,
                  minWidth: "auto",
                }}
              >
                Adjust Pin
              </Button>
            </Box>

            <Box>
              <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748b", mb: 0.75 }}>
                Address
              </Typography>
              <TextField
                fullWidth
                value={storeData.address}
                onChange={(e) => setStoreData({ ...storeData, address: e.target.value })}
                placeholder="123 Market St, Financial District"
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 2,
                    bgcolor: "#f8fafc",
                  },
                }}
              />
            </Box>

            <Box>
              <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748b", mb: 0.75 }}>
                City / Region
              </Typography>
              <TextField
                fullWidth
                value={storeData.city}
                onChange={(e) => setStoreData({ ...storeData, city: e.target.value })}
                placeholder="New York"
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 2,
                    bgcolor: "#f8fafc",
                  },
                }}
              />
            </Box>

            {/* Map Placeholder */}
            <Box
              sx={{
                width: "100%",
                height: 160,
                borderRadius: 2,
                border: "1px solid #e2e8f0",
                bgcolor: "#f0f5ff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <Box
                sx={{
                  position: "absolute",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 0.5,
                }}
              >
                <Box sx={{ position: "relative" }}>
                  <Box
                    sx={{
                      position: "absolute",
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      animation: "pulse 2s infinite",
                      "@keyframes pulse": {
                        "0%, 100%": { opacity: 1 },
                        "50%": { opacity: 0.5 },
                      },
                    }}
                  />
                  <MaterialIcon name="location_on" size={48} filled sx={{ color: "#2b7cee" }} />
                </Box>
              </Box>

              {/* Location Info Card */}
              <Paper
                elevation={0}
                sx={{
                  position: "absolute",
                  bottom: 8,
                  left: 8,
                  right: 8,
                  p: 1.5,
                  bgcolor: "rgba(255, 255, 255, 0.9)",
                  backdropFilter: "blur(4px)",
                  border: "1px solid #e2e8f0",
                  borderRadius: 1.5,
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                }}
              >
                <MaterialIcon name="map" size={18} />
                <Typography sx={{ fontSize: "0.625rem", fontWeight: 600, color: "#475569", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {storeData.address || "Location pending..."}
                </Typography>
              </Paper>
            </Box>

            <Typography sx={{ fontSize: "0.75rem", color: "#94a3b8", fontStyle: "italic" }}>
              * This location is used for calculating delivery radius and routing for riders.
            </Typography>
          </Stack>
        </Stack>
      </Container>

      {/* Bottom Nav */}
      <BottomNav />

      {/* Snackbar */}
      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snack.severity} variant="filled">
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
