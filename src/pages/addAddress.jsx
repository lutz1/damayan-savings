import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Container,
  Stack,
  TextField,
  Typography,
  Card,
  CardContent,
  IconButton,
  Snackbar,
  Alert,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  ArrowBack as ArrowBackIcon,
  LocationOn as LocationOnIcon,
  Delete as DeleteIcon,
  Check as CheckIcon,
} from "@mui/icons-material";

const AddAddress = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [fullAddress, setFullAddress] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [phone, setPhone] = useState("");
  const [savedAddresses, setSavedAddresses] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("savedAddresses") || "[]");
    } catch {
      return [];
    }
  });
  const [snack, setSnack] = useState({ open: false, message: "", severity: "success" });

  const handleSaveAddress = () => {
    if (!fullAddress.trim() && (!street.trim() || !city.trim())) {
      setSnack({
        open: true,
        message: "Please enter a valid address",
        severity: "error",
      });
      return;
    }

    const addressToAdd = fullAddress.trim() || `${street}, ${city}${postalCode ? ", " + postalCode : ""}`;

    const newAddresses = [...savedAddresses, addressToAdd];
    localStorage.setItem("savedAddresses", JSON.stringify(newAddresses));
    setSavedAddresses(newAddresses);

    setSnack({
      open: true,
      message: "Address saved successfully!",
      severity: "success",
    });

    setTimeout(() => {
      navigate(-1); // Go back to shop
    }, 1500);
  };

  const handleDeleteAddress = (index) => {
    const newAddresses = savedAddresses.filter((_, i) => i !== index);
    localStorage.setItem("savedAddresses", JSON.stringify(newAddresses));
    setSavedAddresses(newAddresses);
    setSnack({
      open: true,
      message: "Address deleted",
      severity: "info",
    });
  };

  return (
    <Container maxWidth="sm" sx={{ py: isMobile ? 2 : 4, minHeight: "100vh" }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 3, gap: 2 }}>
        <IconButton onClick={() => navigate(-1)} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" fontWeight={700}>
          Add Delivery Address
        </Typography>
      </Box>

      {/* Address Form */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack spacing={2}>
            {/* Single Address Field (Quick Entry) */}
            <Box>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                Full Address (Quick)
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={3}
                placeholder="e.g., 123 Mabini St., Makati, Metro Manila, 1210"
                value={fullAddress}
                onChange={(e) => setFullAddress(e.target.value)}
                variant="outlined"
                size="small"
              />
              <Typography variant="caption" sx={{ color: "#999", mt: 0.5, display: "block" }}>
                Or fill in the fields below
              </Typography>
            </Box>

            <Box sx={{ borderTop: "1px solid #e0e0e0", pt: 2 }}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2 }}>
                Detailed Address (Optional)
              </Typography>

              <TextField
                fullWidth
                label="Street Address"
                placeholder="e.g., 123 Mabini Street"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                variant="outlined"
                size="small"
                sx={{ mb: 1.5 }}
              />

              <TextField
                fullWidth
                label="City / Barangay"
                placeholder="e.g., Makati"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                variant="outlined"
                size="small"
                sx={{ mb: 1.5 }}
              />

              <TextField
                fullWidth
                label="Postal Code (Optional)"
                placeholder="e.g., 1210"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                variant="outlined"
                size="small"
                sx={{ mb: 1.5 }}
              />

              <TextField
                fullWidth
                label="Phone Number (Optional)"
                placeholder="e.g., +63 912 345 6789"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                variant="outlined"
                size="small"
              />
            </Box>

            <Button
              fullWidth
              variant="contained"
              color="primary"
              onClick={handleSaveAddress}
              startIcon={<CheckIcon />}
              sx={{ py: 1.5, fontWeight: 600, textTransform: "none" }}
            >
              Save Address
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Saved Addresses List */}
      {savedAddresses.length > 0 && (
        <Box>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
            Your Saved Addresses ({savedAddresses.length})
          </Typography>

          <Stack spacing={1.5}>
            {savedAddresses.map((address, index) => (
              <Card key={index}>
                <CardContent
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    py: 1.5,
                    px: 2,
                    "&:last-child": { pb: 1.5 },
                  }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                      <LocationOnIcon sx={{ fontSize: 20, color: "#e91e63" }} />
                      <Typography variant="body2" fontWeight={600}>
                        Address {index + 1}
                      </Typography>
                    </Box>
                    <Typography
                      variant="body2"
                      sx={{
                        color: "#666",
                        wordBreak: "break-word",
                        ml: 0.5,
                      }}
                    >
                      {address}
                    </Typography>
                  </Box>
                  <IconButton
                    size="small"
                    onClick={() => handleDeleteAddress(index)}
                    sx={{ color: "#d32f2f" }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </Box>
      )}

      {/* Snackbar */}
      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnack({ ...snack, open: false })}
          severity={snack.severity}
          sx={{ width: "100%" }}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default AddAddress;
