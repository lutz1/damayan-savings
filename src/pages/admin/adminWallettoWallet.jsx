import React, { useEffect, useState } from "react";
import {
  Box,
  Toolbar,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Button,
  Stack,
  Snackbar,
  Alert,
  useMediaQuery,
} from "@mui/material";
import { motion } from "framer-motion";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  doc,
  getDocs,
  where,
  getDoc,
} from "firebase/firestore";
import { db } from "../../firebase";
import Topbar from "../../components/Topbar";
import Sidebar from "../../components/Sidebar";
import bgImage from "../../assets/bg.jpg";
import { useTheme } from "@mui/material/styles";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip as RechartsTooltip,
} from "recharts";

const COLORS = ["#4FC3F7", "#81C784", "#FFB74D", "#E57373"];

const AdminWalletToWallet = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    totalPending: 0,
    totalApproved: 0,
    totalRejected: 0,
    totalAmount: 0,
  });
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const handleToggleSidebar = () => setSidebarOpen((prev) => !prev);

  // ✅ Fetch transfer requests in real-time
  useEffect(() => {
    const q = query(collection(db, "transferFunds"), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      const totalPending = data.filter((t) => t.status === "Pending").length;
      const totalApproved = data.filter((t) => t.status === "Approved").length;
      const totalRejected = data.filter((t) => t.status === "Rejected").length;
      const totalAmount = data.reduce((sum, t) => sum + (t.amount || 0), 0);

      setTransfers(data);
      setSummary({ totalPending, totalApproved, totalRejected, totalAmount });
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // ✅ Approve or Reject transfer request
  const handleAction = async (id, status) => {
    try {
      const transferRef = doc(db, "transferFunds", id);
      const transferSnap = await getDoc(transferRef);

      if (!transferSnap.exists()) throw new Error("Transfer not found.");
      const transfer = transferSnap.data();

      if (status === "Approved") {
        // Get sender document
        const senderQuery = query(
          collection(db, "users"),
          where("email", "==", transfer.senderEmail)
        );
        const senderSnapshot = await getDocs(senderQuery);

        if (senderSnapshot.empty) throw new Error("Sender not found.");
        const senderDoc = senderSnapshot.docs[0];
        const senderData = senderDoc.data();
        const senderRef = doc(db, "users", senderDoc.id);

        if (senderData.eWallet < transfer.amount)
          throw new Error("Sender has insufficient balance.");

        // Deduct from sender
        await updateDoc(senderRef, {
          eWallet: senderData.eWallet - transfer.amount,
        });

        // Get recipient document
        const recipientQuery = query(
          collection(db, "users"),
          where("username", "==", transfer.recipientUsername)
        );
        const recipientSnapshot = await getDocs(recipientQuery);

        if (recipientSnapshot.empty) throw new Error("Recipient not found.");
        const recipientDoc = recipientSnapshot.docs[0];
        const recipientData = recipientDoc.data();
        const recipientRef = doc(db, "users", recipientDoc.id);

        // Credit recipient net amount
        await updateDoc(recipientRef, {
          eWallet: (recipientData.eWallet || 0) + transfer.netAmount,
        });

        // Mark transfer as Approved
        await updateDoc(transferRef, { status: "Approved" });
      } else {
        // Just mark as rejected
        await updateDoc(transferRef, { status: "Rejected" });
      }

      setSnackbar({
        open: true,
        message: `Transfer ${status}`,
        severity: status === "Approved" ? "success" : "error",
      });
    } catch (err) {
      console.error("Error updating transfer:", err);
      setSnackbar({
        open: true,
        message: err.message || "Failed to update transfer.",
        severity: "error",
      });
    }
  };

  const chartData = [
    { name: "Pending", value: summary.totalPending },
    { name: "Approved", value: summary.totalApproved },
    { name: "Rejected", value: summary.totalRejected },
  ];

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
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
          backgroundColor: "rgba(0,0,0,0.25)",
          zIndex: 0,
        },
      }}
    >
      <Box sx={{ position: "fixed", width: "100%", zIndex: 10 }}>
        <Topbar open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
      </Box>

      {!isMobile && (
        <Box sx={{ zIndex: 5 }}>
          <Sidebar open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
        </Box>
      )}

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: isMobile ? 1 : 3,
          mt: 8,
          color: "white",
          zIndex: 1,
          width: "100%",
          overflowX: "hidden",
        }}
      >
        <Toolbar />
        <Typography
          variant={isMobile ? "h6" : "h5"}
          sx={{
            mb: 2,
            fontWeight: 700,
            textShadow: "1px 1px 3px rgba(0,0,0,0.4)",
            textAlign: isMobile ? "center" : "left",
          }}
        >
          💳 Wallet-to-Wallet Transfer Requests
        </Typography>

        {/* 📊 Summary */}
        <Card
          sx={{
            background: "rgba(255,255,255,0.12)",
            backdropFilter: "blur(12px)",
            borderRadius: "16px",
            mb: 3,
          }}
        >
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              📊 Transfer Summary
            </Typography>
            <Typography sx={{ mt: 1 }}>
              Total Amount Transferred:{" "}
              <b>
                ₱{summary.totalAmount.toLocaleString("en-PH", {
                  minimumFractionDigits: 2,
                })}
              </b>
            </Typography>

            <Box sx={{ width: "100%", height: 250, mt: 2 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={(entry) => `${entry.name}: ${entry.value}`}
                  >
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Legend />
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>

        {/* 📜 Table */}
        <Card
          sx={{
            background: "rgba(255,255,255,0.12)",
            backdropFilter: "blur(12px)",
            borderRadius: "16px",
            boxShadow: "0 6px 25px rgba(0,0,0,0.25)",
            width: "100%",
            overflowX: "auto",
          }}
        >
          <CardContent sx={{ p: 1 }}>
            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
                <CircularProgress sx={{ color: "white" }} />
              </Box>
            ) : transfers.length === 0 ? (
              <Typography
                align="center"
                sx={{ color: "rgba(255,255,255,0.7)", py: 3 }}
              >
                No transfer requests found.
              </Typography>
            ) : (
              <TableContainer>
                <Table size={isMobile ? "small" : "medium"}>
                  <TableHead>
                    <TableRow>
                      {[
                        "Sender",
                        "Recipient",
                        "Amount",
                        "Charge (2%)",
                        "Net Amount",
                        "Status",
                        "Date",
                        "Actions",
                      ].map((head) => (
                        <TableCell
                          key={head}
                          sx={{ color: "white", fontWeight: "bold" }}
                        >
                          {head}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {transfers.map((t) => (
                      <motion.tr
                        key={t.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <TableCell sx={{ color: "white" }}>{t.senderName}</TableCell>
                        <TableCell sx={{ color: "white" }}>{t.recipientUsername}</TableCell>
                        <TableCell sx={{ color: "white" }}>
                          ₱{t.amount?.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell sx={{ color: "white" }}>
                          ₱{t.charge?.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell sx={{ color: "white" }}>
                          ₱{t.netAmount?.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell
                          sx={{
                            color:
                              t.status === "Approved"
                                ? "#81C784"
                                : t.status === "Rejected"
                                ? "#E57373"
                                : "#FFB74D",
                            fontWeight: 600,
                          }}
                        >
                          {t.status}
                        </TableCell>
                        <TableCell sx={{ color: "white" }}>
                          {t.createdAt
                            ? new Date(t.createdAt.seconds * 1000).toLocaleString("en-PH")
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {t.status === "Pending" ? (
                            <Stack direction="row" spacing={1}>
                              <Button
                                size="small"
                                variant="contained"
                                sx={{
                                  bgcolor: "#81C784",
                                  color: "#000",
                                  fontWeight: 600,
                                  "&:hover": { bgcolor: "#66BB6A" },
                                }}
                                onClick={() => handleAction(t.id, "Approved")}
                              >
                                Approve
                              </Button>
                              <Button
                                size="small"
                                variant="contained"
                                sx={{
                                  bgcolor: "#E57373",
                                  color: "#000",
                                  fontWeight: 600,
                                  "&:hover": { bgcolor: "#EF5350" },
                                }}
                                onClick={() => handleAction(t.id, "Rejected")}
                              >
                                Reject
                              </Button>
                            </Stack>
                          ) : (
                            <Typography
                              variant="body2"
                              sx={{ color: "rgba(255,255,255,0.6)" }}
                            >
                              No actions
                            </Typography>
                          )}
                        </TableCell>
                      </motion.tr>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      </Box>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AdminWalletToWallet;