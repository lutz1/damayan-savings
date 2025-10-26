// src/pages/admin/AdminDeposits.jsx
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  useMediaQuery,
} from "@mui/material";
import { motion } from "framer-motion";
import { collection, onSnapshot, doc, updateDoc, getDoc, query } from "firebase/firestore";
import { db } from "../../firebase";
import Topbar from "../../components/Topbar";
import Sidebar from "../../components/Sidebar";
import bgImage from "../../assets/bg.jpg";
import { useTheme } from "@mui/material/styles";
import { getAuth } from "firebase/auth";

const AdminDeposits = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeposit, setSelectedDeposit] = useState(null);
  const [remarks, setRemarks] = useState("");
  const [proofImage, setProofImage] = useState(null);
  const [salesData, setSalesData] = useState({ total: 0, revenue: 0 });
  const [userRole, setUserRole] = useState("");

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const auth = getAuth();

  const handleToggleSidebar = () => setSidebarOpen(prev => !prev);

  // Get current user role
  useEffect(() => {
    const fetchRole = async () => {
      const user = auth.currentUser;
      if (!user) return;
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) setUserRole(userDoc.data().role?.toLowerCase() || "");
    };
    fetchRole();
  }, [auth]);

  // Listen to deposits collection
  useEffect(() => {
    const q = query(collection(db, "deposits"));
    const unsubscribe = onSnapshot(q, snapshot => {
      const data = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      const sorted = data.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds);
      setDeposits(sorted);

      const approvedDeposits = sorted.filter(d => d.status?.toLowerCase() === "approved");
      const totalAmount = approvedDeposits.reduce((sum, d) => sum + Number(d.amount || 0), 0);
      const revenue = approvedDeposits.reduce((sum, d) => sum + Number(d.charge || 0), 0);

      setSalesData({ total: totalAmount, revenue });
      setLoading(false);
    }, err => {
      console.error("Error fetching deposits:", err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Approve or Reject deposit
  const handleAction = async (status) => {
    if (!selectedDeposit) return;
    const { id, userId, netAmount } = selectedDeposit; // use netAmount

    try {
      const depositRef = doc(db, "deposits", id);
      await updateDoc(depositRef, { status: status.toLowerCase(), reviewedAt: new Date(), remarks });

      if (status.toLowerCase() === "approved") {
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const currentBalance = Number(userSnap.data().eWallet || 0);
          await updateDoc(userRef, {
            eWallet: currentBalance + Number(netAmount), // ← credit netAmount
            lastUpdated: new Date(),
          });
        }
      }

      setSelectedDeposit(null);
      setRemarks("");
    } catch (err) {
      console.error("Error updating deposit:", err);
    }
  };

  const openDialog = (deposit) => {
    setSelectedDeposit(deposit);
    setRemarks("");
  };

  const closeDialog = () => {
    setSelectedDeposit(null);
    setRemarks("");
  };

  const handleViewProof = (url) => setProofImage(url);
  const closeProofDialog = () => setProofImage(null);

  const canApproveReject = ["admin", "ceo"].includes(userRole);

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
        "&::before": { content: '""', position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.25)", zIndex: 0 }
      }}
    >
      <Box sx={{ position: "fixed", width: "100%", zIndex: 10 }}>
        <Topbar open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
      </Box>
      {!isMobile && <Box sx={{ zIndex: 5 }}><Sidebar open={sidebarOpen} onToggleSidebar={handleToggleSidebar} /></Box>}

      <Box component="main" sx={{ flexGrow: 1, p: isMobile ? 1 : 3, mt: 8, color: "white", zIndex: 1, width: "100%", overflowX: "hidden" }}>
        <Toolbar />
        <Typography variant={isMobile ? "h6" : "h5"} sx={{ mb: 2, fontWeight: 700, textShadow: "1px 1px 3px rgba(0,0,0,0.4)", textAlign: isMobile ? "center" : "left" }}>
          💵 Deposits Management
        </Typography>

        {/* Sales Summary */}
        <Card sx={{ background: "rgba(255,255,255,0.12)", backdropFilter: "blur(12px)", borderRadius: "16px", mb: 3, width: "100%", overflowX: "auto" }}>
          <CardContent sx={{ textAlign: isMobile ? "center" : "left" }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>📈 Sales Summary</Typography>
            <Typography sx={{ mt: 1 }}>Total Approved Deposits: <b>₱{salesData.total.toFixed(2)}</b></Typography>
            <Typography sx={{ mt: 1 }}>Revenue (2% Charges): <b>₱{salesData.revenue.toFixed(2)}</b></Typography>
          </CardContent>
        </Card>

        {/* Deposits Table */}
        <Card sx={{ background: "rgba(255,255,255,0.12)", backdropFilter: "blur(12px)", borderRadius: "16px", boxShadow: "0 6px 25px rgba(0,0,0,0.25)", width: "100%", overflowX: "auto" }}>
          <CardContent sx={{ p: 1 }}>
            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}><CircularProgress sx={{ color: "white" }} /></Box>
            ) : deposits.length === 0 ? (
              <Typography align="center" sx={{ color: "rgba(255,255,255,0.7)", py: 3 }}>No deposits found.</Typography>
            ) : (
              <TableContainer sx={{ width: "100%", overflowX: "auto" }}>
                <Table size={isMobile ? "small" : "medium"}>
                  <TableHead>
                    <TableRow>
                      {["Name","Amount","Charge","Net Amount","Status","Date","Actions"].map(head => (
                        <TableCell key={head} sx={{ color: "white", fontWeight: "bold", whiteSpace: "nowrap" }}>{head}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {deposits.map(d => {
                      const status = d.status?.toLowerCase() || "pending";
                      return (
                        <motion.tr key={d.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                          <TableCell sx={{ color: "white" }}>{d.name}</TableCell>
                          <TableCell sx={{ color: "white" }}>₱{d.amount}</TableCell>
                          <TableCell sx={{ color: "white" }}>₱{d.charge || 0}</TableCell>
                          <TableCell sx={{ color: "white" }}>₱{d.netAmount || d.amount}</TableCell>
                          <TableCell sx={{ color: status==="approved"?"#00e676":status==="rejected"?"#ff1744":"#fff", fontWeight:600 }}>{status.toUpperCase()}</TableCell>
                          <TableCell sx={{ color: "white", whiteSpace: "nowrap" }}>
                            {d.createdAt ? new Date(d.createdAt.seconds*1000).toLocaleString() : "—"}
                          </TableCell>
                          <TableCell>
                            {canApproveReject && status==="pending" ? (
                              <Box sx={{ display:"flex", gap:1, flexWrap:"wrap", justifyContent:"center" }}>
                                {d.receiptUrl && <Button variant="outlined" color="info" size="small" onClick={()=>handleViewProof(d.receiptUrl)}>View Proof</Button>}
                                <Button variant="contained" color="success" size="small" onClick={()=>openDialog(d)}>Approve / Reject</Button>
                              </Box>
                            ) : (
                              <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.6)" }}>{status==="pending"?"—":"Done"}</Typography>
                            )}
                          </TableCell>
                        </motion.tr>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>

        {/* Approve / Reject Dialog */}
        <Dialog open={!!selectedDeposit} onClose={closeDialog} fullWidth maxWidth="sm">
          <DialogTitle>Approve or Reject Deposit</DialogTitle>
          <DialogContent>
            <Typography variant="body1" sx={{ mb: 2 }}>
              {selectedDeposit?.name} deposited ₱{selectedDeposit?.amount}.<br/>
              Charge: ₱{selectedDeposit?.charge || 0} | Net: ₱{selectedDeposit?.netAmount || selectedDeposit?.amount}
            </Typography>
            <TextField fullWidth label="Remarks (optional)" value={remarks} onChange={e=>setRemarks(e.target.value)} multiline rows={3}/>
          </DialogContent>
          <DialogActions sx={{ flexWrap:"wrap", gap:1 }}>
            <Button onClick={closeDialog}>Cancel</Button>
            <Button onClick={()=>handleAction("rejected")} color="error" variant="contained">Reject</Button>
            <Button onClick={()=>handleAction("approved")} color="success" variant="contained">Approve</Button>
          </DialogActions>
        </Dialog>

        {/* Proof Viewer Dialog */}
        <Dialog open={!!proofImage} onClose={closeProofDialog} fullWidth maxWidth="xs">
          <DialogTitle>Receipt / Proof Image</DialogTitle>
          <DialogContent sx={{ textAlign:"center" }}>
            <img src={proofImage} alt="Deposit Proof" style={{ width:"100%", borderRadius:"12px", marginTop:"10px" }}/>
          </DialogContent>
          <DialogActions><Button onClick={closeProofDialog}>Close</Button></DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
};

export default AdminDeposits;