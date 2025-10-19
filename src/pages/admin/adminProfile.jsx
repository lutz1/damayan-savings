import React, { useState } from "react";
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
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/Topbar";
import bgImage from "../../assets/bg.jpg";

const AdminProfile = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  const handleToggleSidebar = () => setSidebarOpen((prev) => !prev);

  // ✅ Dummy admin data
  const [admin, setAdmin] = useState({
    name: "John Admin",
    email: "admin@example.com",
    contact: "+1 555 123 4567",
    role: "System Administrator",
    joinedDate: "January 5, 2023",
  });

  const [form, setForm] = useState({ ...admin });

  const handleEditToggle = () => {
    if (isEditing) {
      setAdmin(form);
    }
    setIsEditing((prev) => !prev);
  };

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
                label="Full Name"
                value={isEditing ? form.name : admin.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                InputProps={{
                  readOnly: !isEditing,
                  style: { color: "white" },
                }}
                InputLabelProps={{ style: { color: "white" } }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    "& fieldset": { borderColor: "rgba(255,255,255,0.3)" },
                    "&:hover fieldset": { borderColor: "white" },
                  },
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                value={isEditing ? form.email : admin.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                InputProps={{
                  readOnly: !isEditing,
                  style: { color: "white" },
                }}
                InputLabelProps={{ style: { color: "white" } }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    "& fieldset": { borderColor: "rgba(255,255,255,0.3)" },
                    "&:hover fieldset": { borderColor: "white" },
                  },
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Contact Number"
                value={isEditing ? form.contact : admin.contact}
                onChange={(e) => setForm({ ...form, contact: e.target.value })}
                InputProps={{
                  readOnly: !isEditing,
                  style: { color: "white" },
                }}
                InputLabelProps={{ style: { color: "white" } }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    "& fieldset": { borderColor: "rgba(255,255,255,0.3)" },
                    "&:hover fieldset": { borderColor: "white" },
                  },
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Role"
                value={admin.role}
                InputProps={{
                  readOnly: true,
                  style: { color: "white" },
                }}
                InputLabelProps={{ style: { color: "white" } }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    "& fieldset": { borderColor: "rgba(255,255,255,0.3)" },
                  },
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Joined Date"
                value={admin.joinedDate}
                InputProps={{
                  readOnly: true,
                  style: { color: "white" },
                }}
                InputLabelProps={{ style: { color: "white" } }}
                sx={{
                  "& .MuiOutlinedInput-root": {
                    "& fieldset": { borderColor: "rgba(255,255,255,0.3)" },
                  },
                }}
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