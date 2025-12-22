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
  Paper,
  CircularProgress,
} from "@mui/material";
import { motion } from "framer-motion";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../../firebase";
import Topbar from "../../components/Topbar";
import AppBottomNav from "../../components/AppBottomNav";
import bgImage from "../../assets/bg.jpg";

const AdminTransferTransaction = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const handleToggleSidebar = () => setSidebarOpen((prev) => !prev);

  // 🔥 Fetch passive transfers (used for Total Passive Income)
  useEffect(() => {
    const q = query(collection(db, "passiveTransfers"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const txns = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setTransactions(txns);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 💰 Compute total collected fee (1%)
  const totalFee = transactions.reduce((sum, t) => sum + (t.fee || 0), 0);

  return (
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
          backgroundColor: "rgba(0, 0, 0, 0.25)",
          zIndex: 0,
        },
      }}
    >
      {/* 🔝 Topbar */}
      <Box sx={{ position: "fixed", width: "100%", zIndex: 10 }}>
        <Topbar open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
      </Box>

      {/* 🧭 Sidebar */}
      <Box sx={{ zIndex: 5 }}>
        <AppBottomNav open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
      </Box>

      {/* 🧩 Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 4,
          mt: 0,
          color: "white",
          zIndex: 1,
          width: `calc(100% - ${sidebarOpen ? 240 : 60}px)`,
          transition: "all 0.3s ease",
          position: "relative",
        }}
      >
        <Toolbar />

        {/* Header */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mb: 3 }}>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              textShadow: "1px 1px 3px rgba(0,0,0,0.4)",
            }}
          >
            💸 Passive Transfer Transactions
          </Typography>

          {/* Display total collected 1% fee */}
          <Card
            sx={{
              background: "rgba(255,255,255,0.12)",
              backdropFilter: "blur(10px)",
              borderRadius: "16px",
              p: 2,
              color: "white",
              maxWidth: 400,
            }}
          >
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Total Collected Fee (1%):
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: "bold", color: "#00e676" }}>
                ₱{totalFee.toFixed(2)}
              </Typography>
            </CardContent>
          </Card>
        </Box>

        {/* 📋 Transaction Table */}
        <Card
          sx={{
            background: "rgba(255,255,255,0.12)",
            backdropFilter: "blur(12px)",
            borderRadius: "20px",
            boxShadow: "0 6px 25px rgba(0,0,0,0.25)",
            overflow: "hidden",
          }}
        >
          <CardContent>
            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
                <CircularProgress sx={{ color: "white" }} />
              </Box>
            ) : transactions.length === 0 ? (
              <Typography align="center" sx={{ color: "rgba(255,255,255,0.7)", py: 3 }}>
                No passive transfer records found.
              </Typography>
            ) : (
              <TableContainer
                component={Paper}
                sx={{
                  background: "transparent",
                  color: "white",
                  overflowX: "auto",
                }}
              >
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>User ID</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>Amount</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>Fee (1%)</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>Net Amount</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>Date</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {transactions.map((txn) => (
                      <motion.tr
                        key={txn.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <TableCell sx={{ color: "white" }}>{txn.userId || "—"}</TableCell>
                        <TableCell sx={{ color: "white" }}>₱{txn.amount?.toFixed(2) || "0.00"}</TableCell>
                        <TableCell sx={{ color: "#00e676" }}>₱{txn.fee?.toFixed(2) || "0.00"}</TableCell>
                        <TableCell sx={{ color: "white" }}>₱{txn.netAmount?.toFixed(2) || "0.00"}</TableCell>
                        <TableCell sx={{ color: "white" }}>
                          {txn.createdAt
                            ? new Date(txn.createdAt).toLocaleString()
                            : "—"}
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
    </Box>
  );
};

export default AdminTransferTransaction;