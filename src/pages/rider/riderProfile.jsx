import React, { useState, useEffect } from "react";
import {
  Box,
  Container,
  Paper,
  Typography,
  Card,
  CardContent,
  Button,
  Divider,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
} from "@mui/material";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db, auth } from "../../firebase";
import { useNavigate } from "react-router-dom";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import CancelIcon from "@mui/icons-material/Cancel";
import Navbar from "../../components/Navbar";

const RiderProfile = () => {
  const [riderData, setRiderData] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({});
  const [loading, setLoading] = useState(true);
  const [passwordDialog, setPasswordDialog] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    loadRiderProfile();
  }, []);

  const loadRiderProfile = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const data = userSnap.data();
        setRiderData(data);
        setEditData(data);
      }
      setLoading(false);
    } catch (error) {
      console.error("Error loading rider profile:", error);
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        name: editData.name,
        contactNumber: editData.contactNumber,
        address: editData.address,
        city: editData.city,
        updatedAt: new Date(),
      });

      setRiderData(editData);
      setEditMode(false);
      setSuccess("Profile updated successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (error) {
      console.error("Error saving profile:", error);
      setError("Failed to update profile. Please try again.");
    }
  };

  const handleEditChange = (field, value) => {
    setEditData({
      ...editData,
      [field]: value,
    });
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <Typography>Loading...</Typography>
        </Box>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <Container maxWidth="md" sx={{ py: 4 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Rider Profile
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Manage your account information
          </Typography>
        </Box>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

        {/* Profile Card */}
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Account Information
            </Typography>
            {!editMode && (
              <Button
                startIcon={<EditIcon />}
                onClick={() => setEditMode(true)}
                variant="outlined"
              >
                Edit
              </Button>
            )}
          </Box>
          <Divider sx={{ mb: 3 }} />

          {editMode ? (
            <Box>
              <TextField
                fullWidth
                label="Full Name"
                value={editData.name || ""}
                onChange={(e) => handleEditChange("name", e.target.value)}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Email"
                value={editData.email || ""}
                disabled
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Contact Number"
                value={editData.contactNumber || ""}
                onChange={(e) => handleEditChange("contactNumber", e.target.value)}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Address"
                value={editData.address || ""}
                onChange={(e) => handleEditChange("address", e.target.value)}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="City"
                value={editData.city || ""}
                onChange={(e) => handleEditChange("city", e.target.value)}
                sx={{ mb: 2 }}
              />

              <Box sx={{ display: "flex", gap: 1 }}>
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={handleSaveProfile}
                >
                  Save Changes
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<CancelIcon />}
                  onClick={() => {
                    setEditMode(false);
                    setEditData(riderData);
                  }}
                >
                  Cancel
                </Button>
              </Box>
            </Box>
          ) : (
            <Box>
              <Card sx={{ mb: 2, bgcolor: "background.default" }}>
                <CardContent>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    Full Name
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {riderData?.name || "Not provided"}
                  </Typography>
                </CardContent>
              </Card>

              <Card sx={{ mb: 2, bgcolor: "background.default" }}>
                <CardContent>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    Email
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {riderData?.email || "Not provided"}
                  </Typography>
                </CardContent>
              </Card>

              <Card sx={{ mb: 2, bgcolor: "background.default" }}>
                <CardContent>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    Contact Number
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {riderData?.contactNumber || "Not provided"}
                  </Typography>
                </CardContent>
              </Card>

              <Card sx={{ mb: 2, bgcolor: "background.default" }}>
                <CardContent>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    Address
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {riderData?.address || "Not provided"}
                  </Typography>
                </CardContent>
              </Card>

              <Card sx={{ mb: 2, bgcolor: "background.default" }}>
                <CardContent>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    City
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {riderData?.city || "Not provided"}
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          )}
        </Paper>
      </Container>
    </>
  );
};

export default RiderProfile;
