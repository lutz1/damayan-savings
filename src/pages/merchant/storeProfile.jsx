import React, { useEffect, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  CardMedia,
  Stack,
  Typography,
  TextField,
  Button,
  Avatar,
  Snackbar,
  Alert,
  Container,
  IconButton,
  InputAdornment,
} from "@mui/material";
import {
  Save,
  PhotoCamera,
  Close,
  Store as StoreIcon,
  AccessTime,
  LocationOn,
} from "@mui/icons-material";
import { motion } from "framer-motion";
import MobileAppShell from "../../components/MobileAppShell";
import { auth, db, storage } from "../../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";

const motionCard = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

export default function StoreProfilePage() {
  const [uid, setUid] = useState(localStorage.getItem("uid") || null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);

  const [storeName, setStoreName] = useState("");
  const [storeDesc, setStoreDesc] = useState("");
  const [hours, setHours] = useState("");
  const [location, setLocation] = useState("");
  const [coverImage, setCoverImage] = useState("");

  const [snack, setSnack] = useState({ open: false, severity: "success", message: "" });

  // Auth bridge
  useEffect(() => {
    if (uid) return;
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) return;
      setUid(u.uid);
      try { localStorage.setItem("uid", u.uid); } catch (_) {}
    });
    return unsub;
  }, [uid]);

  // Load store profile
  useEffect(() => {
    if (!uid) return;
    setLoading(true);

    const loadStore = async () => {
      try {
        const snap = await getDoc(doc(db, "merchants", uid));
        if (snap.exists()) {
          const data = snap.data();
          setStoreName(data.storeName || "");
          setStoreDesc(data.storeDesc || "");
          setHours(data.hours || "");
          setLocation(data.location || "");
          setCoverImage(data.coverImage || "");
        }
      } catch (err) {
        console.error(err);
        setSnack({ open: true, severity: "error", message: "Failed to load store profile" });
      }
      setLoading(false);
    };

    loadStore();
  }, [uid]);

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setSnack({ open: true, severity: "warning", message: "Please select an image file" });
      return;
    }

    setImageUploading(true);

    try {
      const storageRef = ref(storage, `merchants/${uid}/cover_${Date.now()}_${file.name}`);
      const task = uploadBytesResumable(storageRef, file);

      task.on(
        "state_changed",
        () => {
          // progress tracking (optional for UI)
        },
        (err) => {
          console.error(err);
          setSnack({ open: true, severity: "error", message: "Image upload failed" });
          setImageUploading(false);
        },
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          // delete previous if exists
          if (coverImage) {
            try { await deleteObject(ref(storage, coverImage)); } catch (_) {}
          }
          setCoverImage(url);
          setSnack({ open: true, severity: "success", message: "Image uploaded" });
          setImageUploading(false);
        }
      );
    } catch (err) {
      console.error(err);
      setSnack({ open: true, severity: "error", message: "Upload error" });
      setImageUploading(false);
    }
  };

  const handleSave = async () => {
    if (!uid || !storeName.trim()) {
      setSnack({ open: true, severity: "warning", message: "Store name is required" });
      return;
    }

    setSaving(true);
    try {
      await setDoc(doc(db, "merchants", uid), {
        uid,
        storeName: storeName.trim(),
        storeDesc: storeDesc.trim(),
        hours,
        location,
        coverImage,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      setSnack({ open: true, severity: "success", message: "Store profile saved" });
    } catch (err) {
      console.error(err);
      setSnack({ open: true, severity: "error", message: "Failed to save" });
    }
    setSaving(false);
  };

  return (
    <MobileAppShell title="Store Profile">
      <Box sx={{ minHeight: "100vh", bgcolor: "#f5f5f5", pb: 2, pt: 2 }}>
        <Container maxWidth="sm" sx={{ pb: 12 }}>
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Box sx={{ mb: 3, textAlign: "center" }}>
              <Avatar
                sx={{
                  width: 64,
                  height: 64,
                  bgcolor: "#1976d2",
                  margin: "0 auto 16px",
                  boxShadow: "0 4px 12px rgba(25, 118, 210, 0.2)",
                }}
              >
                <StoreIcon sx={{ fontSize: 32 }} />
              </Avatar>
              <Typography variant="h5" fontWeight="bold" gutterBottom color="#263238">
                Your Store Profile
              </Typography>
              <Typography variant="body2" color="#546e7a">
                Customize your shop appearance and hours
              </Typography>
            </Box>
          </motion.div>

          {/* Cover Image */}
          <motion.div {...motionCard}>
            <Card sx={{ mb: 2, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
              <CardContent>
                <Stack spacing={1.5}>
                  <Typography variant="subtitle1" fontWeight={600} color="#263238">
                    📸 Store Cover Image
                  </Typography>
                  {coverImage ? (
                    <Box sx={{ position: "relative" }}>
                      <CardMedia
                        component="img"
                        image={coverImage}
                        alt="Store cover"
                        sx={{ borderRadius: 2, height: 180, objectFit: "cover" }}
                      />
                      <IconButton
                        sx={{
                          position: "absolute",
                          top: 8,
                          right: 8,
                          bgcolor: "#d32f2f",
                          color: "white",
                          "&:hover": { bgcolor: "#c62828" },
                        }}
                        onClick={async () => {
                          try {
                            await deleteObject(ref(storage, coverImage));
                            setCoverImage("");
                          } catch (e) {
                            console.error(e);
                          }
                        }}
                      >
                        <Close />
                      </IconButton>
                    </Box>
                  ) : (
                    <Button
                      component="label"
                      variant="outlined"
                      fullWidth
                      startIcon={<PhotoCamera />}
                      sx={{
                        height: 120,
                        borderStyle: "dashed",
                        borderWidth: 2,
                        borderColor: "#90caf9",
                        color: "#1976d2",
                        bgcolor: "#e3f2fd",
                        "&:hover": { borderColor: "#1976d2", bgcolor: "#bbdefb" },
                      }}
                      disabled={imageUploading}
                    >
                      {imageUploading ? "Uploading..." : "Upload Cover Image"}
                      <input hidden type="file" accept="image/*" onChange={handleImageSelect} />
                    </Button>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </motion.div>

          {/* Store Details */}
          <motion.div {...motionCard} transition={{ delay: 0.1 }}>
            <Card sx={{ mb: 2, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="subtitle1" fontWeight={600} color="#263238">
                    📝 Store Information
                  </Typography>

                  <TextField
                    label="Store Name"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    fullWidth
                    required
                    placeholder="e.g., John's Coffee Shop"
                    disabled={loading}
                  />

                  <TextField
                    label="Description"
                    multiline
                    rows={3}
                    value={storeDesc}
                    onChange={(e) => setStoreDesc(e.target.value)}
                    fullWidth
                    placeholder="Tell customers about your store..."
                    disabled={loading}
                  />

                  <TextField
                    label="Operating Hours"
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    fullWidth
                    placeholder="e.g., 8:00 AM - 6:00 PM"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <AccessTime />
                        </InputAdornment>
                      ),
                    }}
                    disabled={loading}
                  />

                  <TextField
                    label="Location / Address"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    fullWidth
                    placeholder="Your shop address"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LocationOn />
                        </InputAdornment>
                      ),
                    }}
                    disabled={loading}
                  />

                  <Button
                    variant="contained"
                    fullWidth
                    startIcon={<Save />}
                    onClick={handleSave}
                    disabled={saving || loading || imageUploading}
                    sx={{
                      py: 1.5,
                      fontWeight: 600,
                      bgcolor: "#1976d2",
                      "&:hover": { bgcolor: "#1565c0" },
                    }}
                  >
                    {saving ? "Saving..." : "Save Store Profile"}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </motion.div>
        </Container>
      </Box>

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert severity={snack.severity} variant="filled" sx={{ width: "100%" }}>
          {snack.message}
        </Alert>
      </Snackbar>
    </MobileAppShell>
  );
}
