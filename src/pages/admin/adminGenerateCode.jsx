import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Button,
  Paper,
  CircularProgress,
  Grid,
  Divider,
  Toolbar,
} from "@mui/material";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
  deleteDoc,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../firebase";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/Topbar";
import bgImage from "../../assets/bg.jpg"; // ✅ background image

// ✅ Toggle dummy mode (no Firebase connection needed)
const USE_DUMMY_DATA = true;

// ✅ Helper to generate unique 8-char alphanumeric codes
const generateRandomCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({ length: 8 }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join("");
};

const AdminGenerateCode = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [processing, setProcessing] = useState(null);

  const handleToggleSidebar = () => setSidebarOpen((prev) => !prev);

  // ✅ Fetch pending code requests (dummy or real)
  useEffect(() => {
    const fetchRequests = async () => {
      if (USE_DUMMY_DATA) {
        // 💡 Dummy pending requests
        setTimeout(() => {
          setRequests([
            { id: "1", role: "Marketing Director (MD)", requestedBy: "John Doe" },
            { id: "2", role: "Marketing Supervisor (MS)", requestedBy: "Jane Smith" },
            { id: "3", role: "Agent", requestedBy: "Alex Lee" },
          ]);
          setLoading(false);
        }, 800);
        return;
      }

      try {
        const q = query(collection(db, "codeRequests"), where("status", "==", "pending"));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setRequests(data);
      } catch (error) {
        console.error("Error fetching code requests:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
  }, []);

  // ✅ Generate and store a code for a specific request
  const handleGenerateCode = async (req) => {
    setProcessing(req.id);
    try {
      const code = generateRandomCode();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours validity

      if (USE_DUMMY_DATA) {
        // 🧪 Just simulate generation
        await new Promise((res) => setTimeout(res, 1200));
        alert(`✅ Dummy code for ${req.role} generated: ${code}`);
        setRequests((prev) => prev.filter((r) => r.id !== req.id));
        setProcessing(null);
        return;
      }

      // 🧩 Firestore operations (real mode)
      await addDoc(collection(db, "generatedCodes"), {
        role: req.role,
        code,
        createdAt: serverTimestamp(),
        expiresAt,
        used: false,
      });

      await updateDoc(doc(db, "codeRequests", req.id), {
        status: "completed",
        generatedCode: code,
      });

      setRequests((prev) => prev.filter((r) => r.id !== req.id));
      alert(`✅ Code for ${req.role} generated: ${code}`);
    } catch (error) {
      console.error("Error generating code:", error);
    } finally {
      setProcessing(null);
    }
  };

  // ✅ Cleanup expired codes (only runs if Firestore connected)
  const cleanupExpiredCodes = async () => {
    if (USE_DUMMY_DATA) return;
    try {
      const now = new Date();
      const q = query(collection(db, "generatedCodes"));
      const snapshot = await getDocs(q);

      snapshot.forEach(async (docSnap) => {
        const data = docSnap.data();
        if (data.expiresAt && data.expiresAt.toDate() < now) {
          await deleteDoc(doc(db, "generatedCodes", docSnap.id));
        }
      });
    } catch (error) {
      console.error("Error cleaning up expired codes:", error);
    }
  };

  useEffect(() => {
    cleanupExpiredCodes();
  }, []);

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
          backgroundColor: "rgba(0, 0, 0, 0.1)",
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

        <Box
          sx={{
            p: 4,
            color: "white",
            backdropFilter: "blur(12px)",
            background: "rgba(255, 255, 255, 0.1)",
            borderRadius: "16px",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
          }}
        >
          <Typography variant="h4" gutterBottom>
            Generate Access Codes
          </Typography>
          <Typography variant="subtitle1" sx={{ mb: 2 }}>
            Handle pending code requests for marketing roles.
          </Typography>

          <Divider sx={{ mb: 3, borderColor: "rgba(255,255,255,0.2)" }} />

          {loading ? (
            <CircularProgress color="inherit" />
          ) : requests.length === 0 ? (
            <Typography>No pending code requests.</Typography>
          ) : (
            <Grid container spacing={2}>
              {requests.map((req) => (
                <Grid item xs={12} sm={6} md={4} key={req.id}>
                  <Paper
                    elevation={3}
                    sx={{
                      p: 2,
                      background: "rgba(255, 255, 255, 0.15)",
                      color: "white",
                      backdropFilter: "blur(10px)",
                      borderRadius: "12px",
                      textAlign: "center",
                    }}
                  >
                    <Typography variant="h6">{req.role}</Typography>
                    <Typography variant="body2" sx={{ mb: 2 }}>
                      Requested by: {req.requestedBy || "Unknown"}
                    </Typography>
                    <Button
                      variant="contained"
                      onClick={() => handleGenerateCode(req)}
                      disabled={processing === req.id}
                      sx={{
                        mt: 1,
                        background: "rgba(255,255,255,0.2)",
                        backdropFilter: "blur(5px)",
                        "&:hover": { background: "rgba(255,255,255,0.3)" },
                      }}
                    >
                      {processing === req.id ? "Generating..." : "Generate Code"}
                    </Button>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default AdminGenerateCode;