import React, { useEffect, useState, useCallback } from "react";
import {
  Drawer,
  List,
  ListItem,
  ListItemText,
  Chip,
  Typography,
  IconButton,
  Box,
} from "@mui/material";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import {
  ArrowDropUp as CreditIcon,
  ArrowDropDown as DebitIcon,
} from "@mui/icons-material";
import { collection, query, where, onSnapshot, doc, getDoc } from "firebase/firestore";

const EwalletHistoryDialog = ({ open, onClose, db, auth }) => {
  const [history, setHistory] = useState([]);

  const getTimestampValue = useCallback((ts) => {
    if (!ts) return 0;
    if (typeof ts === "number") return ts;
    if (ts.seconds) return ts.seconds;
    if (ts.toDate) return Math.floor(ts.toDate().getTime() / 1000);
    if (typeof ts === "string") return Math.floor(new Date(ts).getTime() / 1000);
    return 0;
  }, []);

  const mergeAndSort = useCallback(
    (prev, newData, source) => {
      const filtered = prev.filter((item) => item.source !== source);
      const merged = [...filtered, ...newData];
      return merged.sort((a, b) => getTimestampValue(b.createdAt) - getTimestampValue(a.createdAt));
    },
    [getTimestampValue]
  );

  useEffect(() => {
    if (!open) return; // Only setup listeners when dialog is open
    if (!auth?.currentUser) return;

    const init = async () => {
      const uid = auth.currentUser.uid;

      // Fetch username
      const snap = await getDoc(doc(db, "users", uid));
      const username = snap.exists() ? snap.data().username || "" : "";
      if (!username) return;

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

      // Deposits (including Monthly Profit Transfers & Capital Share Transfers & Referral Rewards)
      setupListener(
        query(collection(db, "deposits"), where("userId", "==", uid)),
        "deposit",
        (d) => {
          let displayType = "Deposit";
          if (d.type === "Monthly Profit Transfer") {
            displayType = "📈 Monthly Profit Earn";
          } else if (d.type === "Capital Share Transfer") {
            displayType = "💰 Capital Share Transfer";
          } else if (d.type === "Capital Share Added") {
            displayType = "💰 Capital Share Added";
          } else if (d.type === "Referral Reward Transfer") {
            displayType = `🎁 Referral Reward from ${d.source || "System"}`;
          } else if (d.type === "Cash In Request") {
            displayType = "Cash In Request";
          }
          return { 
            ...d, 
            source: "deposit", 
            displayType, 
            isCredit: true 
          };
        }
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


      // Payback Entries
      setupListener(
        query(collection(db, "paybackEntries"), where("userId", "==", uid)),
        "payback",
        (d) => ({
          ...d,
          source: "payback",
          displayType: `Payback Entry (${d.role || "N/A"})`,
          isCredit: false,
        })
      );

      // Passive Income Earn (passiveTransfers)
      setupListener(
        query(collection(db, "passiveTransfers"), where("userId", "==", uid)),
        "passive",
        (d) => ({
          ...d,
          source: "passive",
          displayType: "Passive Income Earn",
          isCredit: true,
        })
      );

      // Override Transactions
      setupListener(
        query(collection(db, "overrideTransactions"), where("userId", "==", uid)),
        "override",
        (d) => ({
          ...d,
          source: "override",
          displayType: `💵 Override Earnings from ${d.fromUsername || "System"}`,
          isCredit: true,
        })
      );

      return () => unsubscribers.forEach((unsub) => unsub());
    };

    const cleanup = init();

    // Cleanup listeners on close
    return () => {
      setHistory([]); // Reset history when dialog closes
      if (cleanup?.then) {
        cleanup.then((fn) => fn && fn());
      } else if (typeof cleanup === "function") {
        cleanup();
      }
    };
  }, [open, auth, db, mergeAndSort]);

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
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
      transitionDuration={{ enter: 360, exit: 260 }}
      slotProps={{ backdrop: { sx: { backgroundColor: "rgba(0,0,0,0.4)" } } }}
      PaperProps={{
        sx: {
          width: { xs: "100%", sm: 430 },
          maxWidth: "100%",
          background: "linear-gradient(180deg, rgba(4,12,30,0.98) 0%, rgba(8,23,52,0.98) 44%, rgba(15,42,99,0.97) 100%)",
          color: "#f8fbff",
          borderLeft: "1px solid rgba(138,199,255,0.14)",
        },
      }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Header */}
        <Box sx={{ minHeight: 70, px: 1, pt: "calc(env(safe-area-inset-top, 0px) + 10px)", pb: 1, display: "flex", alignItems: "center", justifyContent: "space-between", color: "#fff", background: "linear-gradient(135deg, rgba(6,19,46,0.98) 0%, rgba(13,47,118,0.96) 58%, rgba(37,101,214,0.90) 100%)", borderBottom: "1px solid rgba(138,199,255,0.16)" }}>
          <IconButton onClick={onClose} sx={{ color: "#fff" }}>
            <ArrowBackIosNewIcon />
          </IconButton>
          <Typography sx={{ fontSize: 18, fontWeight: 800, letterSpacing: 0.2 }}>E-Wallet History</Typography>
          <Box sx={{ width: 40 }} />
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflowY: "auto", p: 2 }}>
          {history.length > 0 ? (
            <Box sx={{ background: "linear-gradient(145deg, rgba(255,255,255,0.96) 0%, rgba(241,246,255,0.98) 100%)", borderRadius: 2.5, border: "1px solid rgba(138,199,255,0.18)", boxShadow: "0 12px 24px rgba(2,10,24,0.16)" }}>
              <List dense>
                {history.map((item) => {
                  const amount =
                    item.source === "received" && item.status === "Approved"
                      ? item.netAmount || item.amount
                      : item.netAmount || item.amount;
                  const formattedAmount = Number(amount || 0).toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                  });
                  if (item.source === "received" && item.status !== "Approved") return null;

                  return (
                    <ListItem
                      key={item.id}
                      sx={{
                        borderBottom: "1px solid rgba(138,199,255,0.18)",
                        py: 0.8,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <ListItemText
                        primary={
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                            {item.isCredit ? (
                              <CreditIcon sx={{ color: "#4CAF50", fontSize: 22 }} />
                            ) : (
                              <DebitIcon sx={{ color: "#FF5252", fontSize: 22 }} />
                            )}
                            <Typography
                              component="span"
                              sx={{
                                fontWeight: 700,
                                color: item.isCredit ? "#2e7d32" : "#c62828",
                              }}
                            >
                              {item.isCredit ? `+₱${formattedAmount}` : `-₱${formattedAmount}`}
                            </Typography>
                          </Box>
                        }
                        secondary={
                          <Typography
                            variant="body2"
                            sx={{ color: "#666", fontSize: 12 }}
                          >
                            {item.displayType} • {formatDate(item.createdAt)}
                          </Typography>
                        }
                      />
                      <Chip
                        size="small"
                        label={item.status || "Pending"}
                        color={getStatusColor(item.status)}
                        sx={{ textTransform: "capitalize", fontWeight: 600, fontSize: 11, ml: 1 }}
                      />
                    </ListItem>
                  );
                })}
              </List>
            </Box>
          ) : (
            <Typography variant="body2" sx={{ textAlign: "center", color: "rgba(220,232,255,0.72)", py: 4 }}>
              No wallet history yet.
            </Typography>
          )}
        </Box>
      </Box>
    </Drawer>
  );
};

export default EwalletHistoryDialog;