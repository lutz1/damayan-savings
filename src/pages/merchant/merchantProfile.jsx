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
  IconButton,
  Stack,
  CircularProgress,
  Alert,
  Snackbar,
} from "@mui/material";
import {
  AttachFile,
  Download,
  Delete as DeleteIcon,
  Description,
} from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db, auth, storage } from "../../firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { onAuthStateChanged, signOut } from "firebase/auth";
import BottomNav from "../../components/BottomNav";

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
        const data = snap.data();
        setMerchantData(data);
        setAttachments(data.attachments || []);
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
      
      // Delete from storage
      try {
        const fileRef = ref(storage, attachment.url);
        await deleteObject(fileRef);
      } catch (err) {
        console.warn("Failed to delete from storage:", err);
      }

      // Update Firestore
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
          <Typography variant="body1" mb={2}>{address}</Typography>

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" color="gray" mb={1}>
            Company Documents
          </Typography>
          
          <Button
            component="label"
            variant="outlined"
            startIcon={uploading ? <CircularProgress size={20} /> : <AttachFile />}
            disabled={uploading}
            fullWidth
            sx={{ mb: 2 }}
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
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 2 }}>
              No documents uploaded yet
            </Typography>
          ) : (
            <Stack spacing={1}>
              {attachments.map((file, index) => (
                <Card key={index} variant="outlined" sx={{ bgcolor: "#f8f9fa" }}>
                  <CardContent sx={{ py: 1.5, px: 2, "&:last-child": { pb: 1.5 } }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Stack direction="row" alignItems="center" spacing={1} flex={1}>
                        <Description color="primary" />
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography 
                            variant="body2" 
                            fontWeight={500}
                            sx={{ 
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap"
                            }}
                          >
                            {file.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {file.size ? `${(file.size / 1024).toFixed(1)} KB` : ""}
                            {file.uploadedAt && ` • ${new Date(file.uploadedAt).toLocaleDateString()}`}
                          </Typography>
                        </Box>
                      </Stack>
                      <Stack direction="row" spacing={0.5}>
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => window.open(file.url, "_blank")}
                          title="Download"
                        >
                          <Download fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteAttachment(index)}
                          title="Delete"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
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

      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
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