import React, { useEffect, useState } from "react";
import {
  Box,
  Toolbar,
  Typography,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Link,
  Fade,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../../firebase";
import { getAuth } from "firebase/auth";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/Topbar";
import bgImage from "../../assets/bg.jpg";

const AdminApprovalRequest = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const handleToggleSidebar = () => setSidebarOpen((prev) => !prev);

  // ✅ Fetch requests + payback entries
  const fetchRequests = async () => {
    setLoading(true);
    setError("");
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;

      if (!currentUser) {
        setError("User not signed in.");
        setLoading(false);
        return;
      }

      // 🔍 Verify if current user is admin
      const userDoc = await getDoc(doc(db, "users", currentUser.uid));
      const role = userDoc.exists()
        ? (userDoc.data().role || "").toLowerCase()
        : "";

      if (role !== "admin") {
        setError("Access denied: Admins only.");
        setLoading(false);
        return;
      }

      // ✅ Fetch both collections in parallel
      const [reqSnap, paybackSnap] = await Promise.all([
        getDocs(collection(db, "requests")),
        getDocs(collection(db, "paybackEntries")),
      ]);

      const reqData = reqSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        source: "requests",
        type: "Admin Request",
        userName: d.data().userName || "Unknown",
      }));

      const paybackData = paybackSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
        source: "paybackEntries",
        type: "Payback Entry",
        userName: d.data().miUsername || "Unknown Member",
      }));

      const filtered = [...reqData, ...paybackData].filter(
        (r) =>
          ["waiting for approval", "waiting", "pending"].includes(
            (r.status || "").toLowerCase()
          )
      );

      const sorted = filtered.sort((a, b) => {
        const dateA = new Date(a.date || a.createdAt || 0);
        const dateB = new Date(b.date || b.createdAt || 0);
        return dateB - dateA;
      });

      setRequests(sorted);
    } catch (error) {
      console.error("Error fetching requests:", error);
      setError(error.message || "Failed to fetch requests.");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  // ✅ Approve / Reject handler
  const handleAction = async (row, action) => {
    try {
      const docRef = doc(db, row.source, row.id);
      const newStatus = action === "approve" ? "approved" : "rejected";
      await updateDoc(docRef, { status: newStatus });
      fetchRequests();
      setSelected(null);
    } catch (error) {
      console.error("Error updating status:", error);
      setError("Failed to update status. Check Firestore permissions.");
    }
  };

  // ✅ Columns
  const columns = [
    { field: "userName", headerName: "Member", flex: 1, minWidth: 120 },
    { field: "type", headerName: "Type", flex: 1, minWidth: 120 },
    {
      field: "amount",
      headerName: "Amount (₱)",
      flex: 1,
      minWidth: 100,
      renderCell: (params) =>
        params.value
          ? parseFloat(params.value).toLocaleString("en-PH", {
              minimumFractionDigits: 2,
            })
          : "—",
    },
    {
      field: "date",
      headerName: "Date Submitted",
      flex: 1.3,
      minWidth: 180,
      sortable: true,
      valueGetter: (params) => {
        const value =
          params.row?.date ||
          params.row?.createdAt ||
          params.row?.timestamp ||
          params.row?.submittedAt;
        if (!value) return null;
        const d = new Date(value);
        return isNaN(d) ? null : d.toISOString();
      },
      renderCell: (params) => {
        if (!params?.value) return "—";
        const d = new Date(params.value);
        return d.toLocaleString("en-PH", {
          dateStyle: "medium",
          timeStyle: "short",
        });
      },
      sortComparator: (v1, v2) => new Date(v2) - new Date(v1),
    },
    {
      field: "status",
      headerName: "Status",
      flex: 0.8,
      minWidth: 100,
      renderCell: (params) => {
        const value = params.value?.toLowerCase();
        let color = "#FFEB3B";
        let bg = "rgba(255, 235, 59, 0.15)";
        if (value === "approved") {
          color = "#81C784";
          bg = "rgba(76, 175, 80, 0.2)";
        } else if (value === "rejected") {
          color = "#E57373";
          bg = "rgba(244, 67, 54, 0.2)";
        }
        return (
          <Chip
            label={params.value?.toUpperCase()}
            size="small"
            sx={{
              fontWeight: 600,
              fontSize: "0.75rem",
              borderRadius: "8px",
              px: 1,
              backgroundColor: bg,
              color,
              textShadow: "0 0 4px rgba(0,0,0,0.4)",
            }}
          />
        );
      },
    },
    {
      field: "receiptUrl",
      headerName: "Receipt",
      flex: 1,
      minWidth: 140,
      renderCell: (params) =>
        params.value ? (
          <Link
            href={params.value}
            target="_blank"
            rel="noopener"
            sx={{
              color: "#90caf9",
              textDecoration: "underline",
              "&:hover": { color: "#fff" },
            }}
          >
            View
          </Link>
        ) : (
          "—"
        ),
    },
    {
      field: "actions",
      headerName: "Actions",
      flex: 1.4,
      minWidth: 160,
      renderCell: (params) =>
        ["waiting for approval", "waiting", "pending"].includes(
          (params.row.status || "").toLowerCase()
        ) ? (
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <Button
              size="small"
              variant="contained"
              sx={{
                textTransform: "none",
                borderRadius: "10px",
                backgroundColor: "#4caf50",
                "&:hover": { backgroundColor: "#43a047" },
              }}
              onClick={() => setSelected({ ...params.row, action: "approve" })}
            >
              Approve
            </Button>
            <Button
              size="small"
              variant="contained"
              sx={{
                textTransform: "none",
                borderRadius: "10px",
                backgroundColor: "#f44336",
                "&:hover": { backgroundColor: "#e53935" },
              }}
              onClick={() => setSelected({ ...params.row, action: "reject" })}
            >
              Reject
            </Button>
          </Box>
        ) : (
          <Typography variant="body2" sx={{ color: "#aaa" }}>
            —
          </Typography>
        ),
    },
  ];

  return (
    <Fade in>
      <Box
        sx={{
          display: "flex",
          minHeight: "100vh",
          backgroundImage: `url(${bgImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          position: "relative",
          "&::before": {
            content: '""',
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.15)",
            backdropFilter: "blur(18px)",
            zIndex: 0,
          },
        }}
      >
        <Box sx={{ position: "fixed", width: "100%", zIndex: 10 }}>
          <Topbar open={sidebarOpen} />
        </Box>

        <Box sx={{ zIndex: 5 }}>
          <Sidebar open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
        </Box>

        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: { xs: 2, sm: 3, md: 4 },
            mt: 8,
            zIndex: 1,
            color: "#EAEAEA",
            width: `calc(100% - ${sidebarOpen ? 240 : 60}px)`,
            transition: "all 0.3s ease",
            position: "relative",
          }}
        >
          <Toolbar />
          <Typography
            variant="h5"
            sx={{
              mb: 3,
              fontWeight: 700,
              fontSize: isMobile ? "1.25rem" : "1.5rem",
              textShadow: "0 2px 6px rgba(0,0,0,0.8)",
            }}
          >
            🕓 Waiting for Approval
          </Typography>

          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", height: "60vh" }}>
              <CircularProgress sx={{ color: "#fff" }} />
            </Box>
          ) : error ? (
            <Typography align="center" color="error" sx={{ mt: 10 }}>
              {error}
            </Typography>
          ) : requests.length === 0 ? (
            <Typography align="center" sx={{ mt: 10, opacity: 0.8 }}>
              No requests waiting for approval 🎉
            </Typography>
          ) : (
            <Box
              sx={{
                height: isMobile ? 420 : 540,
                bgcolor: "rgba(25,25,25,0.7)",
                borderRadius: 4,
                backdropFilter: "blur(25px)",
                p: { xs: 1, sm: 2 },
                boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
                overflowX: "auto",
              }}
            >
              <DataGrid
                rows={requests}
                columns={columns}
                getRowId={(row) => `${row.source}_${row.id}`}
                disableRowSelectionOnClick
                density={isMobile ? "compact" : "standard"}
                sx={{
                  color: "#111",
                  border: "none",
                  "& .MuiDataGrid-columnHeaders": {
                    backgroundColor: "rgba(40,40,40,0.9)",
                    color: "#fff",
                    fontWeight: 600,
                  },
                  "& .MuiDataGrid-row:hover": {
                    backgroundColor: "rgba(255,255,255,0.08)",
                  },
                }}
              />
            </Box>
          )}
        </Box>

        <Dialog
          open={Boolean(selected)}
          onClose={() => setSelected(null)}
          PaperProps={{
            sx: {
              borderRadius: 3,
              backgroundColor: "rgba(25,25,25,0.95)",
              color: "#fff",
              backdropFilter: "blur(20px)",
            },
          }}
        >
          <DialogTitle sx={{ fontWeight: 600 }}>
            {selected?.action === "approve"
              ? "Approve Request"
              : "Reject Request"}
          </DialogTitle>
          <DialogContent dividers>
            <Typography>
              Are you sure you want to <b>{selected?.action}</b> this{" "}
              <b>{selected?.type || "request"}</b> from{" "}
              <b>{selected?.userName}</b> for ₱
              {parseFloat(selected?.amount || 0).toLocaleString("en-PH", {
                minimumFractionDigits: 2,
              })}
              ?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSelected(null)}>Cancel</Button>
            <Button
              variant="contained"
              color={selected?.action === "approve" ? "success" : "error"}
              onClick={() =>
                handleAction(selected, selected?.action === "approve" ? "approve" : "reject")
              }
            >
              Confirm
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Fade>
  );
};

export default AdminApprovalRequest;