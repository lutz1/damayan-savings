import React, { useEffect, useState, useCallback } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  Chip,
  Typography,
  Button,
  Box,
} from "@mui/material";
import {
  ArrowDropUp as CreditIcon,
  ArrowDropDown as DebitIcon,
} from "@mui/icons-material";
import { collection, query, where, onSnapshot, doc, getDoc } from "firebase/firestore";

const EwalletHistoryDialog = ({ open, onClose, db, auth }) => {
  const [history, setHistory] = useState([]);
  const [username, setUsername] = useState("");
  const [listenersReady, setListenersReady] = useState(false);

  // Fetch username before attaching listeners
  useEffect(() => {
    const fetchUsername = async () => {
      if (!auth?.currentUser) return;
      const userRef = doc(db, "users", auth.currentUser.uid);
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        setUsername(snap.data().username || "");
        setListenersReady(true);
      }
    };
    fetchUsername();
  }, [auth, db]);

  // Helper to convert timestamp to number
  const getTimestampValue = useCallback((ts) => {
    if (!ts) return 0;
    if (typeof ts === "number") return ts;
    if (ts.seconds) return ts.seconds;
    if (ts.toDate) return Math.floor(ts.toDate().getTime() / 1000);
    if (typeof ts === "string") return Math.floor(new Date(ts).getTime() / 1000);
    return 0;
  }, []);

  // Merge and sort new data
  const mergeAndSort = useCallback(
    (prev, newData, source) => {
      const filtered = prev.filter((item) => item.source !== source);
      const merged = [...filtered, ...newData];
      return merged.sort((a, b) => getTimestampValue(b.createdAt) - getTimestampValue(a.createdAt));
    },
    [getTimestampValue]
  );

  // Real-time listeners
useEffect(() => {
  if (!auth?.currentUser || !listenersReady || !username) return;
  const uid = auth.currentUser.uid;
  const unsubscribers = [];

  const setupListener = (q, sourceLabel, transformFn) => {
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => transformFn({ id: doc.id, ...doc.data() }));
      setHistory((prev) => mergeAndSort(prev, data, sourceLabel));
    });
    unsubscribers.push(unsub);
  };

  // Purchase Codes
  setupListener(
    query(collection(db, "purchaseCodes"), where("userId", "==", uid)),
    "purchase",
    (d) => ({ ...d, source: "purchase", displayType: "Purchase Codes", isCredit: false })
  );

  // Withdrawals
  setupListener(
    query(collection(db, "withdrawals"), where("userId", "==", uid)),
    "withdrawal",
    (d) => ({ ...d, source: "withdrawal", displayType: "Withdrawal", isCredit: false })
  );

  // Deposits
  setupListener(
    query(collection(db, "deposits"), where("userId", "==", uid)),
    "deposit",
    (d) => ({ ...d, source: "deposit", displayType: "Deposit", isCredit: true })
  );

  // Transfers (sent)
  setupListener(
    query(collection(db, "transferFunds"), where("senderId", "==", uid)),
    "transfer",
    (d) => ({
      ...d,
      source: "transfer",
      displayType: `Transfer → ${d.recipientUsername || "User"}`,
      isCredit: false,
    })
  );

  // Transfers (received)
  setupListener(
    query(collection(db, "transferFunds"), where("recipientUsername", "==", username)),
    "received",
    (d) => ({
      ...d,
      source: "received",
      displayType: `Transfer credited ₱${d.netAmount || d.amount || 0} from ${d.senderUsername || d.senderName || "User"}`,
      isCredit: true,
    })
  );

  // ➕ Payback Entries
  setupListener(
    query(collection(db, "paybackEntries"), where("userId", "==", uid)),
    "payback",
    (d) => ({
      ...d,
      source: "payback",
      displayType: `Payback Entry (${d.role || "N/A"})`,
      isCredit: false, // deduction
    })
  );

  return () => unsubscribers.forEach((unsub) => unsub());
}, [db, auth, username, listenersReady, mergeAndSort]);

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "success":
      case "approved":
        return "success";
      case "pending":
        return "warning";
      case "failed":
      case "rejected":
        return "error";
      default:
        return "default";
    }
  };

  const formatDate = (ts) => {
    if (!ts) return "Processing...";
    if (ts.toDate) return ts.toDate().toLocaleString("en-PH");
    if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleString("en-PH");
    if (typeof ts === "string") return new Date(ts).toLocaleString("en-PH");
    return new Date(ts).toLocaleString("en-PH");
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3, background: "rgba(25,25,25,0.95)", color: "#fff", p: 1, boxShadow: "0 8px 32px rgba(0,0,0,0.6)" } }}>
      <DialogTitle sx={{ textAlign: "center", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.15)" }}>E-Wallet History</DialogTitle>
      <DialogContent>
        {history.length > 0 ? (
          <List dense sx={{ maxHeight: 400, overflowY: "auto" }}>
            {history.map((item) => {
              const amount = item.source === "received" && item.status === "Approved" ? item.netAmount || item.amount : item.amount;
              const formattedAmount = Number(amount || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 });
              if (item.source === "received" && item.status !== "Approved") return null;

              return (
                <ListItem key={item.id} sx={{ borderBottom: "1px solid rgba(255,255,255,0.08)", py: 0.8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <ListItemText
                    primary={
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        {item.isCredit ? <CreditIcon sx={{ color: "#4CAF50", fontSize: 22 }} /> : <DebitIcon sx={{ color: "#FF5252", fontSize: 22 }} />}
                        <Typography component="span" sx={{ fontWeight: 600, color: item.isCredit ? "#4CAF50" : "#FF5252" }}>
                          {item.isCredit ? `+₱${formattedAmount}` : `-₱${formattedAmount}`}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.75)", fontSize: 12 }}>
                        {item.displayType} • {formatDate(item.createdAt)}
                      </Typography>
                    }
                  />
                  <Chip size="small" label={item.status || "Pending"} color={getStatusColor(item.status)} sx={{ textTransform: "capitalize", fontWeight: 600, fontSize: 11, ml: 1 }} />
                </ListItem>
              );
            })}
          </List>
        ) : (
          <Typography variant="body2" sx={{ textAlign: "center", color: "rgba(255,255,255,0.7)", py: 3 }}>
            No wallet history yet.
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ justifyContent: "center", pb: 2 }}>
        <Button onClick={onClose} variant="outlined" color="inherit" sx={{ borderColor: "rgba(255,255,255,0.3)", color: "#fff", "&:hover": { background: "rgba(255,255,255,0.1)" } }}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default EwalletHistoryDialog;