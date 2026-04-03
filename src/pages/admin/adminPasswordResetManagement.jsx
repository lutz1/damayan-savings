import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  Toolbar,
  Paper,
  Drawer,
  TextField,
  InputAdornment,
  Button,
  Alert,
  CircularProgress,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Chip,
  useMediaQuery,
} from "@mui/material";
import {
  Search as SearchIcon,
  LockReset as LockResetIcon,
  Password as PasswordIcon,
  Pin as PinIcon,
} from "@mui/icons-material";
import { useTheme } from "@mui/material/styles";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { auth, db } from "../../firebase";
import Topbar from "../../components/Topbar";
import AppBottomNav from "../../components/AppBottomNav";
import AdminSidebarToggle from "../../components/AdminSidebarToggle";

const CLOUD_FUNCTIONS_BASE =
  (import.meta.env.VITE_CLOUD_FUNCTIONS_BASE_URL ||
    "https://us-central1-amayan-savings.cloudfunctions.net").replace(/\/$/, "");

const formatRequestedAt = (value) => {
  if (!value) return "-";
  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
  }

  const seconds = value.seconds || value._seconds;
  if (typeof seconds === "number") {
    return new Date(seconds * 1000).toLocaleString();
  }

  return "-";
};

const AdminPasswordResetManagement = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [search, setSearch] = useState("");
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [requests, setRequests] = useState([]);
  const [processingRequestId, setProcessingRequestId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [realtimeBlocked, setRealtimeBlocked] = useState(false);
  const [authUid, setAuthUid] = useState("");
  const [authReady, setAuthReady] = useState(false);

  const currentRole = String(localStorage.getItem("userRole") || "").trim().toUpperCase();
  const isSuperAdmin = currentRole === "SUPERADMIN";

  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  const handleToggleSidebar = () => setSidebarOpen((prev) => !prev);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      setAuthUid(user?.uid || "");
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  const fetchRequestsFromFunction = useCallback(async () => {
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) return;

      const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/adminRecoveryRequestsList`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to fetch recovery requests");
      }

      const rows = Array.isArray(payload?.requests) ? payload.requests : [];
      setRequests(rows);
      setLoadingRequests(false);
      setError("");
    } catch (err) {
      setError(err?.message || "Failed to fetch recovery requests.");
      setLoadingRequests(false);
    }
  }, []);

  useEffect(() => {
    if (!authReady) {
      setLoadingRequests(true);
      return undefined;
    }

    if (!authUid) {
      setLoadingRequests(false);
      setRequests([]);
      return undefined;
    }

    setLoadingRequests(true);

    const q = query(collection(db, "accountRecoveryRequests"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        setRequests(rows);
        setLoadingRequests(false);
        setRealtimeBlocked(false);
        setError("");
      },
      (err) => {
        console.error("[adminPasswordResetManagement] realtime listener error:", err);
        setRealtimeBlocked(true);
        if (err?.code === "permission-denied") {
          setError("Realtime blocked by Firestore rules. Using fallback secure feed.");
        } else {
          setError("Realtime connection failed. Using fallback secure feed.");
        }
        fetchRequestsFromFunction();
      }
    );

    const interval = setInterval(() => {
      if (realtimeBlocked) {
        fetchRequestsFromFunction();
      }
    }, 4000);

    return () => {
      clearInterval(interval);
      unsub();
    };
  }, [authReady, authUid, fetchRequestsFromFunction, realtimeBlocked]);

  const filteredRequests = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return requests;

    return requests.filter((req) => {
      const haystack = `${req.username || ""} ${req.email || ""} ${req.role || ""} ${req.requestType || ""} ${req.status || ""}`
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [requests, search]);

  const handleProcessRequest = async (requestItem) => {
    if (!isSuperAdmin) {
      setError("Only SUPERADMIN can process recovery requests.");
      return;
    }

    const requestType = String(requestItem.requestType || "").toUpperCase();
    const requestLabel = requestType === "MPIN" ? "Reset MPIN to default 1234" : "Reset Password to default password123";
    const targetName = requestItem.username || requestItem.email || requestItem.uid || "this user";

    const confirmed = window.confirm(`${requestLabel} for ${targetName}?`);
    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      setProcessingRequestId(requestItem.id);
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Authentication required. Please login again.");

      const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/adminRecoveryRequestsProcess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          requestId: requestItem.id,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to process request");
      }

      if (requestType === "MPIN") {
        setMessage(`MPIN reset completed for ${targetName}. Default MPIN is 1234.`);
      } else {
        setMessage(`Password reset completed for ${targetName}. Default password is password123.`);
      }
    } catch (err) {
      setError(err?.message || "Failed to process request.");
    } finally {
      setProcessingRequestId(null);
    }
  };

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", backgroundColor: "#1a1a1a", position: "relative" }}>
      <Box sx={{ position: "fixed", width: "100%", zIndex: 1200 }}>
        <Topbar open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
      </Box>

      {!isMobile && (
        <Box sx={{ zIndex: 5 }}>
          <AppBottomNav open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
        </Box>
      )}

      {isMobile && (
        <>
          <AdminSidebarToggle onClick={handleToggleSidebar} />
          <Drawer
            anchor="left"
            open={sidebarOpen}
            onClose={handleToggleSidebar}
            ModalProps={{ keepMounted: true }}
            PaperProps={{ sx: { background: "transparent", boxShadow: "none" } }}
          >
            <AppBottomNav layout="sidebar" open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
          </Drawer>
        </>
      )}

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 1.2, md: 3 },
          pb: { xs: 3, md: 10 },
          width: "100%",
          color: "#fff",
          height: "100vh",
          overflowY: "auto",
        }}
      >
        <Toolbar />

        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, md: 3 },
            borderRadius: 3,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "linear-gradient(180deg, rgba(13,21,37,0.94), rgba(18,27,45,0.92))",
            mb: 2,
          }}
        >
          <Typography sx={{ fontSize: { xs: 22, md: 30 }, fontWeight: 900, lineHeight: 1.1 }}>
            Password & MPIN Reset Requests
          </Typography>
          <Typography sx={{ mt: 0.8, color: "rgba(232,240,255,0.75)", fontSize: 13 }}>
            Displays user requests from login recovery. Only SUPERADMIN can process reset actions.
          </Typography>
        </Paper>

        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, md: 2.5 },
            borderRadius: 3,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(10,16,29,0.85)",
            mb: 2,
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 1.2 }}>
            <Chip
              icon={<LockResetIcon />}
              label={isSuperAdmin ? "SUPERADMIN: Reset Enabled" : "ADMIN/CEO: View Only"}
              color={isSuperAdmin ? "success" : "warning"}
              size="small"
            />
            <Typography sx={{ fontSize: 12, color: "rgba(220,231,255,0.75)" }}>Realtime Enabled</Typography>
          </Box>

          <TextField
            fullWidth
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by user, email, role, type, status"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: "#9eb2d8" }} />
                </InputAdornment>
              ),
            }}
            sx={{
              mb: 1.5,
              "& .MuiOutlinedInput-root": {
                color: "#fff",
                borderRadius: 2,
                backgroundColor: "rgba(255,255,255,0.04)",
                "& fieldset": { borderColor: "rgba(255,255,255,0.2)" },
              },
            }}
          />

          {message ? <Alert sx={{ mb: 1.2, borderRadius: 2 }} severity="success">{message}</Alert> : null}
          {error ? <Alert sx={{ mb: 1.2, borderRadius: 2 }} severity="error">{error}</Alert> : null}

          <TableContainer sx={{ borderRadius: 2, border: "1px solid rgba(255,255,255,0.12)" }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ background: "rgba(255,255,255,0.06)" }}>
                  <TableCell sx={{ color: "#dce7ff", fontWeight: 800 }}>User</TableCell>
                  <TableCell sx={{ color: "#dce7ff", fontWeight: 800 }}>Email</TableCell>
                  <TableCell sx={{ color: "#dce7ff", fontWeight: 800 }}>Type</TableCell>
                  <TableCell sx={{ color: "#dce7ff", fontWeight: 800 }}>Requested At</TableCell>
                  <TableCell sx={{ color: "#dce7ff", fontWeight: 800 }}>Status</TableCell>
                  <TableCell sx={{ color: "#dce7ff", fontWeight: 800 }}>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loadingRequests ? (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ color: "#b5c5e8", textAlign: "center", py: 3 }}>
                      <CircularProgress size={24} sx={{ color: "#90caf9" }} />
                    </TableCell>
                  </TableRow>
                ) : filteredRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} sx={{ color: "#b5c5e8", textAlign: "center", py: 3 }}>
                      No recovery requests found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRequests.map((requestItem) => {
                    const requestType = String(requestItem.requestType || "").toUpperCase();
                    const status = String(requestItem.status || "PENDING").toUpperCase();
                    const isPending = status === "PENDING";

                    return (
                      <TableRow key={requestItem.id} hover>
                        <TableCell sx={{ color: "#ffffff" }}>
                          {requestItem.username || "-"}
                          <Typography sx={{ color: "#9eb2d8", fontSize: 11 }}>
                            {String(requestItem.role || "MEMBER").toUpperCase()}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ color: "#d6e2fb" }}>{requestItem.email || "-"}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            icon={requestType === "MPIN" ? <PinIcon /> : <PasswordIcon />}
                            label={requestType === "MPIN" ? "Forgot MPIN" : "Forgot Password"}
                            color={requestType === "MPIN" ? "secondary" : "primary"}
                          />
                        </TableCell>
                        <TableCell sx={{ color: "#d6e2fb" }}>{formatRequestedAt(requestItem.createdAt)}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={status}
                            color={isPending ? "warning" : "success"}
                            variant={isPending ? "filled" : "outlined"}
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            size="small"
                            variant="contained"
                            color="warning"
                            disabled={!isSuperAdmin || !isPending || processingRequestId === requestItem.id}
                            onClick={() => handleProcessRequest(requestItem)}
                            sx={{ textTransform: "none", fontWeight: 700 }}
                          >
                            {processingRequestId === requestItem.id
                              ? "Processing..."
                              : requestType === "MPIN"
                                ? "Reset MPIN to 1234"
                                : "Reset Password"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>
    </Box>
  );
};

export default AdminPasswordResetManagement;
