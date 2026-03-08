import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import HomeIcon from "@mui/icons-material/Home";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import PersonIcon from "@mui/icons-material/Person";
import PaidIcon from "@mui/icons-material/Paid";
import { auth, db } from "../../firebase";
import WithdrawDialog from "../../components/Topbar/dialogs/WithdrawDialog";

const RiderWallet = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [walletBalance, setWalletBalance] = useState(0);
  const [withdrawals, setWithdrawals] = useState([]);
  const [userData, setUserData] = useState(null);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setUserData(null);
        setWithdrawals([]);
        setWalletBalance(0);
        setLoading(false);
        navigate("/login", { replace: true });
        return;
      }

      let unsubUser = () => {};
      let unsubWithdrawals = () => {};

      const init = async () => {
        try {
          const userSnap = await getDoc(doc(db, "users", user.uid));
          const userProfile = userSnap.exists() ? userSnap.data() || {} : {};
          setUserData(userProfile);
          setWalletBalance(Number(userProfile.eWallet || 0));

          unsubUser = onSnapshot(doc(db, "users", user.uid), (snap) => {
            const data = snap.exists() ? snap.data() || {} : {};
            setUserData(data);
            setWalletBalance(Number(data.eWallet || 0));
          });

          unsubWithdrawals = onSnapshot(
            query(collection(db, "withdrawals"), where("userId", "==", user.uid)),
            (snap) => {
              const mapped = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
              mapped.sort((a, b) => {
                const aMs = Date.parse(a.createdAt?.toDate?.() || a.createdAt || 0) || 0;
                const bMs = Date.parse(b.createdAt?.toDate?.() || b.createdAt || 0) || 0;
                return bMs - aMs;
              });
              setWithdrawals(mapped);
            }
          );
        } catch (error) {
          console.error("Error loading rider wallet:", error);
        } finally {
          setLoading(false);
        }
      };

      init();

      return () => {
        unsubUser();
        unsubWithdrawals();
      };
    });

    return () => unsubAuth();
  }, [navigate]);

  const wallet = useMemo(() => {
    const pending = withdrawals
      .filter((w) => String(w.status || "").toLowerCase() === "pending")
      .reduce((sum, w) => sum + Number(w.amount || 0), 0);

    const approved = withdrawals
      .filter((w) => String(w.status || "").toLowerCase() === "approved")
      .reduce((sum, w) => sum + Number(w.amount || 0), 0);

    return {
      available: Number(walletBalance || 0),
      pending,
      approved,
      totalRequested: pending + approved,
    };
  }, [walletBalance, withdrawals]);

  const statusChipColor = (status) => {
    const normalized = String(status || "").toLowerCase();
    if (normalized === "approved") return "success";
    if (normalized === "rejected") return "error";
    return "warning";
  };

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "#f8fafc", pb: 12 }}>
      <Container maxWidth="sm" disableGutters sx={{ minHeight: "100dvh", bgcolor: "#fff" }}>
        <Paper sx={{ position: "sticky", top: 0, zIndex: 10, p: 2, borderRadius: 0, borderBottom: "1px solid #e2e8f0" }}>
          <Typography sx={{ fontSize: 20, fontWeight: 900 }}>Rider Wallet</Typography>
          <Typography sx={{ fontSize: 12, color: "#64748b" }}>View earnings from your delivery activity</Typography>
        </Paper>

        <Box sx={{ p: 2 }}>
          {loading ? (
            <Box sx={{ py: 8, textAlign: "center" }}>
              <CircularProgress size={30} />
            </Box>
          ) : (
            <>
              <Card sx={{ borderRadius: 3, bgcolor: "#0f172a", color: "#fff", mb: 1.5 }}>
                <CardContent sx={{ p: 2.2 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                    <PaidIcon sx={{ color: "#5bec13" }} />
                    <Typography sx={{ fontSize: 12, color: "#cbd5e1" }}>Available Balance</Typography>
                  </Box>
                  <Typography sx={{ fontSize: 34, fontWeight: 900 }}>P{wallet.available.toFixed(2)}</Typography>
                </CardContent>
              </Card>

              <Stack direction="row" spacing={1.2} sx={{ mb: 2 }}>
                <Card sx={{ flex: 1, borderRadius: 2.5 }}>
                  <CardContent sx={{ py: 1.4 }}>
                    <Typography sx={{ fontSize: 11, color: "#64748b" }}>PENDING</Typography>
                    <Typography sx={{ fontSize: 21, fontWeight: 900, color: "#2563eb" }}>P{wallet.pending.toFixed(2)}</Typography>
                  </CardContent>
                </Card>
                <Card sx={{ flex: 1, borderRadius: 2.5 }}>
                  <CardContent sx={{ py: 1.4 }}>
                    <Typography sx={{ fontSize: 11, color: "#64748b" }}>APPROVED</Typography>
                    <Typography sx={{ fontSize: 21, fontWeight: 900, color: "#16a34a" }}>P{wallet.approved.toFixed(2)}</Typography>
                  </CardContent>
                </Card>
              </Stack>

              <Paper sx={{ p: 2, borderRadius: 2.5, border: "1px solid #e2e8f0", mb: 1.5 }}>
                <Typography sx={{ fontWeight: 800, fontSize: 14, mb: 0.4 }}>Cash Out</Typography>
                <Typography sx={{ fontSize: 12, color: "#64748b", mb: 1.2 }}>
                  Submit a withdrawal request and wait for admin approval. Minimum cash out is P100.
                </Typography>
                <Button
                  fullWidth
                  onClick={() => setWithdrawDialogOpen(true)}
                  disabled={wallet.available < 100}
                  variant="contained"
                  sx={{ bgcolor: "#5bec13", color: "#102010", fontWeight: 900, "&:hover": { bgcolor: "#4cd70d" }, "&.Mui-disabled": { bgcolor: "#a3e635", color: "#102010", opacity: 0.55 } }}
                >
                  {wallet.available < 100 ? "Minimum P100 required" : "Cash Out Now"}
                </Button>
              </Paper>

              <Paper sx={{ p: 2, borderRadius: 2.5, border: "1px solid #e2e8f0" }}>
                <Typography sx={{ fontWeight: 800, fontSize: 14, mb: 1 }}>Recent Withdrawals</Typography>
                {withdrawals.length === 0 ? (
                  <Typography sx={{ fontSize: 12, color: "#64748b" }}>No withdrawal requests yet.</Typography>
                ) : (
                  <Stack spacing={1}>
                    {withdrawals.slice(0, 6).map((row) => (
                      <Box key={row.id} sx={{ p: 1.2, border: "1px solid #e2e8f0", borderRadius: 1.8 }}>
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                          <Typography sx={{ fontSize: 13, fontWeight: 800 }}>P{Number(row.amount || 0).toFixed(2)}</Typography>
                          <Chip size="small" label={String(row.status || "Pending")} color={statusChipColor(row.status)} sx={{ textTransform: "capitalize", fontWeight: 700 }} />
                        </Box>
                        <Typography sx={{ fontSize: 11, color: "#64748b", mt: 0.3 }}>
                          {row.paymentMethod || "Payment Method"}
                        </Typography>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Paper>
            </>
          )}
        </Box>

        <Box sx={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 0, width: "100%", maxWidth: 600, borderTop: "1px solid rgba(91,236,19,0.15)", bgcolor: "#fff", px: 1, pt: 1, pb: 1.8, zIndex: 30 }}>
          <Stack direction="row" spacing={0.3}>
            <Button onClick={() => navigate("/rider/dashboard")} sx={{ flex: 1, minWidth: 0, color: "#94a3b8", display: "flex", flexDirection: "column", gap: 0.2, textTransform: "none" }}><HomeIcon sx={{ fontSize: 23 }} /><Typography sx={{ fontSize: 10, fontWeight: 700 }}>Home</Typography></Button>
            <Button onClick={() => navigate("/rider/orders")} sx={{ flex: 1, minWidth: 0, color: "#94a3b8", display: "flex", flexDirection: "column", gap: 0.2, textTransform: "none" }}><ReceiptLongIcon sx={{ fontSize: 23 }} /><Typography sx={{ fontSize: 10, fontWeight: 700 }}>Orders</Typography></Button>
            <Button onClick={() => navigate("/rider/wallet")} sx={{ flex: 1, minWidth: 0, color: "#5bec13", display: "flex", flexDirection: "column", gap: 0.2, textTransform: "none" }}><AccountBalanceWalletIcon sx={{ fontSize: 23 }} /><Typography sx={{ fontSize: 10, fontWeight: 900 }}>Wallet</Typography></Button>
            <Button onClick={() => navigate("/rider/profile")} sx={{ flex: 1, minWidth: 0, color: "#94a3b8", display: "flex", flexDirection: "column", gap: 0.2, textTransform: "none" }}><PersonIcon sx={{ fontSize: 23 }} /><Typography sx={{ fontSize: 10, fontWeight: 700 }}>Profile</Typography></Button>
          </Stack>
        </Box>

        <WithdrawDialog
          open={withdrawDialogOpen}
          onClose={() => setWithdrawDialogOpen(false)}
          userData={userData || { eWallet: wallet.available }}
          db={db}
          auth={auth}
          onBalanceUpdate={(newBalance) => {
            const nextBalance = Number(newBalance || 0);
            setWalletBalance(nextBalance);
            setUserData((prev) => ({ ...(prev || {}), eWallet: nextBalance }));
          }}
        />
      </Container>
    </Box>
  );
};

export default RiderWallet;
