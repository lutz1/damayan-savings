import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Paper,
  Avatar,
  Button,
  IconButton,
  Stack,
  Container,
  LinearProgress,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Alert,
  Snackbar,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db, auth, storage } from "../../firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { onAuthStateChanged, signOut } from "firebase/auth";
import BottomNav from "../../components/BottomNav";

const MaterialIcon = ({ name, size = 24, filled = false }) => (
  <span
    className="material-symbols-outlined"
    style={{
      fontSize: `${size}px`,
      fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400`
    }}
  >
    {name}
  </span>
);

const MerchantProfile = () => {
  const navigate = useNavigate();
  const [merchantId, setMerchantId] = useState(
    localStorage.getItem("uid") || null
  );

  const [merchantData, setMerchantData] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [snack, setSnack] = useState({
    open: false,
    severity: "success",
    message: "",
  });

  useEffect(() => {
    if (!merchantId) return;

    const loadMerchant = async () => {
      try {
        const snap = await getDoc(doc(db, "users", merchantId));
        if (snap.exists()) {
          const data = snap.data();
          setMerchantData(data);
          setAttachments(data.attachments || []);
        }
      } catch (err) {
        console.error("Failed to load merchant data:", err);
      }
    };

    loadMerchant();
  }, [merchantId]);

  useEffect(() => {
    if (merchantId) return;
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        setMerchantId(user.uid);
        try {
          localStorage.setItem("uid", user.uid);
        } catch (e) {
          
        }
      }
    });
    return unsub;
  }, [merchantId]);

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const storageRef = ref(
          storage,
          `merchant-documents/${merchantId}/${Date.now()}_${file.name}`
        );
        await uploadBytes(storageRef, file);
        const url = await getDownloadURL(storageRef);
        return {
          name: file.name,
          url,
          uploadedAt: new Date().toISOString(),
          size: file.size,
          type: file.type,
        };
      });

      const newAttachments = await Promise.all(uploadPromises);
      const updatedAttachments = [...attachments, ...newAttachments];

      await updateDoc(doc(db, "users", merchantId), {
        attachments: updatedAttachments,
      });

      setAttachments(updatedAttachments);
      setSnack({
        open: true,
        severity: "success",
        message: `${newAttachments.length} file(s) uploaded successfully`,
      });
    } catch (err) {
      console.error("Upload failed:", err);
      setSnack({
        open: true,
        severity: "error",
        message: "Failed to upload files",
      });
    }

    setUploading(false);
    e.target.value = null;
  };

  const handleDeleteAttachment = async (index) => {
    if (!window.confirm("Are you sure you want to delete this attachment?")) return;

    try {
      const attachment = attachments[index];
      
      try {
        const fileRef = ref(storage, attachment.url);
        await deleteObject(fileRef);
      } catch (err) {
        console.warn("Failed to delete from storage:", err);
      }

      const updatedAttachments = attachments.filter((_, i) => i !== index);
      await updateDoc(doc(db, "users", merchantId), {
        attachments: updatedAttachments,
      });

      setAttachments(updatedAttachments);
      setSnack({
        open: true,
        severity: "success",
        message: "Attachment deleted",
      });
    } catch (err) {
      console.error("Delete failed:", err);
      setSnack({
        open: true,
        severity: "error",
        message: "Failed to delete attachment",
      });
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.warn("Sign out failed, continuing to clear storage", err);
    }

    try {
      localStorage.removeItem('locationCompleted');
      localStorage.removeItem('userRole');
      localStorage.removeItem('uid');
      localStorage.clear();
    } catch (e) {
      
    }

    navigate("/login");
  };

  if (!merchantData) {
    return (
      <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <LinearProgress sx={{ width: "60%" }} />
      </Box>
    );
  }

  const displayName = merchantData?.merchantProfile?.merchantName || merchantData?.name || "Merchant";
  const displayEmail = merchantData?.email || "No email";
  const avatarUrl = merchantData?.profileImage || merchantData?.photoURL || merchantData?.merchantProfile?.logo || "";

  const menuItems = [
    { key: "personal", icon: "person", title: "Personal Information", subtitle: merchantData?.contactNumber || displayEmail },
    { key: "payouts", icon: "account_balance", title: "Bank Account / Payouts", subtitle: "Manage payout details" },
    { key: "store", icon: "store", title: "Store Settings", subtitle: merchantData?.address || "Manage store profile", onClick: () => navigate("/merchant/store-profile") },
    { key: "security", icon: "shield", title: "Security & Password", subtitle: "Update account security" },
    { key: "help", icon: "help", title: "Help Center", subtitle: "Support and FAQs" },
  ];

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#f6f7f8", pb: 16 }}>
      <Paper
        elevation={0}
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          bgcolor: "rgba(255, 255, 255, 0.85)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid #eef2f7",
        }}
      >
        <Box sx={{ px: 2, py: 2, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography sx={{ fontSize: "1.25rem", fontWeight: 700, color: "#0f172a" }}>
            Account
          </Typography>
          <IconButton
            sx={{
              width: 40,
              height: 40,
              bgcolor: "#f8fafc",
              color: "#475569",
              "&:hover": { bgcolor: "#e2e8f0", color: "#2b7cee" },
            }}
          >
            <MaterialIcon name="notifications" size={22} />
          </IconButton>
        </Box>
      </Paper>

      <Container maxWidth="sm" sx={{ pt: 2 }}>
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 2.5 }}>
          <Box sx={{ position: "relative", mb: 1.5 }}>
            <Avatar
              src={avatarUrl}
              sx={{ width: 96, height: 96, border: "4px solid #fff", boxShadow: "0 8px 24px rgba(15, 23, 42, 0.12)" }}
            >
              {displayName?.[0] || "M"}
            </Avatar>
            <Box
              component="button"
              type="button"
              sx={{
                position: "absolute",
                right: -4,
                bottom: -4,
                width: 32,
                height: 32,
                borderRadius: "50%",
                border: "2px solid #fff",
                bgcolor: "#2b7cee",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                p: 0,
              }}
            >
              <MaterialIcon name="edit" size={16} />
            </Box>
          </Box>
          <Typography sx={{ fontSize: "1.25rem", fontWeight: 700, color: "#0f172a" }}>
            {displayName}
          </Typography>
          <Typography sx={{ fontSize: "0.875rem", color: "#64748b", fontWeight: 500 }}>
            Store Manager • {merchantData?.storeName || displayName}
          </Typography>
        </Box>

        <Paper elevation={0} sx={{ borderRadius: 3, p: 0.75, bgcolor: "transparent", mb: 2 }}>
          <List disablePadding>
            {menuItems.map((item) => (
              <ListItemButton
                key={item.key}
                onClick={item.onClick}
                sx={{
                  borderRadius: 2,
                  bgcolor: "#f8fafc",
                  mb: 1,
                  py: 1.2,
                  "&:hover": { bgcolor: "#f1f5f9" },
                }}
              >
                <ListItemIcon sx={{ minWidth: 44 }}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 2,
                      bgcolor: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 1px 2px rgba(15,23,42,0.08)",
                      color: "#475569",
                    }}
                  >
                    <MaterialIcon name={item.icon} size={20} />
                  </Box>
                </ListItemIcon>
                <ListItemText
                  primary={item.title}
                  secondary={item.subtitle}
                  primaryTypographyProps={{ fontWeight: 700, color: "#334155", fontSize: "0.95rem" }}
                  secondaryTypographyProps={{ color: "#94a3b8", fontSize: "0.75rem" }}
                />
                <MaterialIcon name="chevron_right" size={20} />
              </ListItemButton>
            ))}
          </List>
        </Paper>

        <Paper elevation={0} sx={{ borderRadius: 3, p: 2, mb: 2 }}>
          <Typography sx={{ fontSize: "0.9rem", fontWeight: 700, color: "#334155", mb: 1.5 }}>
            Company Documents
          </Typography>
          <Button
            component="label"
            fullWidth
            disabled={uploading}
            sx={{
              mb: 1.5,
              bgcolor: "#eef4ff",
              color: "#2b7cee",
              fontWeight: 700,
              textTransform: "none",
              borderRadius: 2,
              "&:hover": { bgcolor: "#e2edff" },
            }}
            startIcon={<MaterialIcon name={uploading ? "hourglass_top" : "attach_file"} size={18} />}
          >
            {uploading ? "Uploading..." : "Upload Attachments"}
            <input
              hidden
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={handleFileUpload}
            />
          </Button>

          {attachments.length === 0 ? (
            <Typography sx={{ textAlign: "center", color: "#94a3b8", py: 1, fontSize: "0.8rem" }}>
              No documents uploaded yet
            </Typography>
          ) : (
            <Stack spacing={1}>
              {attachments.map((file, index) => (
                <Box
                  key={index}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    p: 1,
                    borderRadius: 2,
                    bgcolor: "#f8fafc",
                  }}
                >
                  <MaterialIcon name="description" size={20} />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {file.name}
                    </Typography>
                    <Typography sx={{ fontSize: "0.7rem", color: "#94a3b8" }}>
                      {file.size ? `${(file.size / 1024).toFixed(1)} KB` : ""}
                      {file.uploadedAt && ` • ${new Date(file.uploadedAt).toLocaleDateString()}`}
                    </Typography>
                  </Box>
                  <IconButton size="small" onClick={() => window.open(file.url, "_blank")}>
                    <MaterialIcon name="download" size={18} />
                  </IconButton>
                  <IconButton size="small" onClick={() => handleDeleteAttachment(index)}>
                    <MaterialIcon name="delete" size={18} />
                  </IconButton>
                </Box>
              ))}
            </Stack>
          )}
        </Paper>

        <Button
          fullWidth
          onClick={handleLogout}
          sx={{
            mb: 2,
            border: "2px solid #fee2e2",
            color: "#dc2626",
            fontWeight: 700,
            textTransform: "none",
            borderRadius: 2.5,
            py: 1.4,
            "&:hover": { bgcolor: "#fef2f2", borderColor: "#fecaca" },
          }}
          startIcon={<MaterialIcon name="logout" size={20} />}
        >
          Logout
        </Button>

        <Typography sx={{ textAlign: "center", fontSize: "0.65rem", letterSpacing: "0.12em", color: "#94a3b8", textTransform: "uppercase", pb: 3 }}>
          Version 2.4.0 (Build 124)
        </Typography>
      </Container>

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

      <BottomNav />
    </Box>
  );
};

export default MerchantProfile;