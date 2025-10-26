/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Grid,
  Paper,
  Divider,
  Toolbar,
} from "@mui/material";
import { doc, updateDoc, onSnapshot, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../firebase";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/Topbar";
import bgImage from "../../assets/bg.jpg";

const AdminProfile = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [admin, setAdmin] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [unsubscribe, setUnsubscribe] = useState(null);

  const handleToggleSidebar = () => setSidebarOpen((prev) => !prev);

  // 🔥 Real-time Firestore connection (safe + stable)
  useEffect(() => {
    const adminEmail = "johnn.onezero@gmail.com"; // TODO: replace with current admin's email from Auth
    let unsubscribeFn = null;

    const fetchAdmin = async () => {
      try {
        const q = query(collection(db, "users"), where("email", "==", adminEmail));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const adminDoc = snapshot.docs[0];
          const docRef = doc(db, "users", adminDoc.id);

          // ✅ Attach real-time listener safely
          unsubscribeFn = onSnapshot(
            docRef,
            (docSnap) => {
              if (docSnap.exists()) {
                const data = docSnap.data();
                setAdmin(data);
                setForm(data);
                setLoading(false);
              }
            },
            (error) => {
              console.error("onSnapshot error:", error);
              setLoading(false);
            }
          );

          setUnsubscribe(() => unsubscribeFn);
        } else {
          console.warn("⚠️ No admin found with that email.");
          setLoading(false);
        }
      } catch (error) {
        console.error("Error fetching admin profile:", error);
        setLoading(false);
      }
    };

    fetchAdmin();

    // ✅ Proper cleanup to prevent “Unexpected state” crash
    return () => {
      if (unsubscribeFn) {
        unsubscribeFn();
      }
    };
  }, []);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleEditToggle = async () => {
    if (isEditing && admin?.email) {
      try {
        const q = query(collection(db, "users"), where("email", "==", admin.email));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const adminDoc = snapshot.docs[0];
          const docRef = doc(db, "users", adminDoc.id);
          await updateDoc(docRef, {
            name: form.name || "",
            contactNumber: form.contactNumber || "",
            email: form.email || "",
          });
        }
      } catch (err) {
        console.error("Error updating profile:", err);
      }
    }
    setIsEditing((prev) => !prev);
  };

  if (loading) {
    return (
      <Typography variant="h6" sx={{ color: "white", textAlign: "center", mt: 10 }}>
        Loading profile...
      </Typography>
    );
  }

  if (!admin) {
    return (
      <Typography variant="h6" sx={{ color: "white", textAlign: "center", mt: 10 }}>
        No admin profile found.
      </Typography>
    );
  }

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        backgroundImage: `url(${bgImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        position: "relative",
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.55)",
          zIndex: 0,
        },
      }}
    >
      {/* ✅ Topbar */}
      <Box sx={{ position: "fixed", width: "100%", zIndex: 10 }}>
        <Topbar open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
      </Box>

      {/* ✅ Sidebar */}
      <Box sx={{ zIndex: 5 }}>
        <Sidebar open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
      </Box>

      {/* ✅ Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 4,
          mt: 8,
          color: "white",
          zIndex: 1,
          width: `calc(100% - ${sidebarOpen ? 240 : 60}px)`,
          transition: "all 0.3s ease",
          position: "relative",
        }}
      >
        <Toolbar />

        <Paper
          elevation={4}
          sx={{
            p: 4,
            background: "rgba(255, 255, 255, 0.1)",
            backdropFilter: "blur(12px)",
            borderRadius: "16px",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
          }}
        >
          <Typography variant="h4" gutterBottom>
            Admin Profile
          </Typography>
          <Typography variant="subtitle1" sx={{ mb: 3 }}>
            Manage your admin account details
          </Typography>
          <Divider sx={{ mb: 3, borderColor: "rgba(255,255,255,0.2)" }} />

          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Username"
                value={form.username || ""}
                InputProps={{
                  readOnly: true,
                  style: { color: "white" },
                }}
                InputLabelProps={{ style: { color: "white" } }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Full Name"
                value={form.name || ""}
                onChange={(e) => handleChange("name", e.target.value)}
                InputProps={{
                  readOnly: !isEditing,
                  style: { color: "white" },
                }}
                InputLabelProps={{ style: { color: "white" } }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                value={form.email || ""}
                onChange={(e) => handleChange("email", e.target.value)}
                InputProps={{
                  readOnly: !isEditing,
                  style: { color: "white" },
                }}
                InputLabelProps={{ style: { color: "white" } }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Contact Number"
                value={form.contactNumber || ""}
                onChange={(e) => handleChange("contactNumber", e.target.value)}
                InputProps={{
                  readOnly: !isEditing,
                  style: { color: "white" },
                }}
                InputLabelProps={{ style: { color: "white" } }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Role"
                value={form.role || "admin"}
                InputProps={{
                  readOnly: true,
                  style: { color: "white" },
                }}
                InputLabelProps={{ style: { color: "white" } }}
              />
            </Grid>
          </Grid>

          <Box sx={{ mt: 4, textAlign: "right" }}>
            <Button
              variant="contained"
              onClick={handleEditToggle}
              sx={{
                background: isEditing
                  ? "rgba(255, 255, 255, 0.3)"
                  : "rgba(255, 255, 255, 0.2)",
                backdropFilter: "blur(5px)",
                color: "white",
                "&:hover": {
                  background: "rgba(255, 255, 255, 0.4)",
                },
              }}
            >
              {isEditing ? "Save Changes" : "Edit Profile"}
            </Button>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
};

export default AdminProfile;