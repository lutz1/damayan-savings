import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  CircularProgress,
} from "@mui/material";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import TaskAltIcon from "@mui/icons-material/TaskAlt";

const API_BASE = import.meta.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

const OverrideUplineRewardsDialog = ({
  open,
  onClose,
  overrideList = [],
  user,
  loadingTransfer = {},
  setLoadingTransfer = () => {},
}) => {
  const formatAmount = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed.toLocaleString() : "0";
  };

  const toDate = (value) => {
    if (!value) return null;
    if (typeof value?.toDate === "function") return value.toDate();
    if (typeof value === "object" && typeof value.seconds === "number") {
      return new Date(value.seconds * 1000);
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const getSortTime = (item) => {
    const date = toDate(item.releaseDate) || toDate(item.createdAt);
    return date?.getTime?.() || 0;
  };

  const getDisplayDate = (item) => {
    const date = toDate(item.releaseDate) || toDate(item.createdAt);
    if (!date) return "";
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getSourceLabel = (item) => {
    const source = (item.source || "").toString().trim();
    const normalized = source.toLowerCase();
    if (source && normalized !== "system") return source;

    return (
      item.fromUsername ||
      item.fromUser ||
      item.triggeredByUsername ||
      item.uplineUsername ||
      item.type ||
      "Network Bonus"
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: "hidden",
          background: "linear-gradient(150deg, rgba(8,26,62,0.96) 0%, rgba(13,44,102,0.92) 100%)",
          border: "1px solid rgba(217,233,255,0.22)",
          color: "#fff",
        },
      }}
    >
      {/* Header */}
      <DialogTitle sx={{ background: "rgba(8,31,76,0.75)", color: "#fff", p: 0, borderBottom: "1px solid rgba(217,233,255,0.15)" }}>
        <Box sx={{ px: 2.5, pt: 2.5, pb: 2.2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.2, mb: 0.6 }}>
            <Box sx={{ width: 36, height: 36, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.18)",
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <AccountTreeIcon sx={{ color: "#fff", fontSize: 20 }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 9, color: "rgba(255,255,255,0.72)", letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700 }}>Earnings</Typography>
              <Typography sx={{ fontSize: 19, fontWeight: 800, color: "#fff" }}>Override Rewards</Typography>
            </Box>
          </Box>
          <Chip
            label={`${overrideList.length} record${overrideList.length !== 1 ? "s" : ""}`}
            size="small"
            sx={{ backgroundColor: "rgba(255,255,255,0.2)", color: "#fff", fontWeight: 700, fontSize: 11 }}
          />
        </Box>
      </DialogTitle>

      {/* Content */}
      <DialogContent sx={{ p: 0, backgroundColor: "transparent" }}>
        {overrideList.length === 0 ? (
          <Box sx={{ py: 8, textAlign: "center" }}>
            <HourglassEmptyIcon sx={{ fontSize: 44, color: "rgba(217,233,255,0.46)", mb: 1 }} />
            <Typography sx={{ fontSize: 13, color: "rgba(217,233,255,0.74)" }}>No override rewards found.</Typography>
          </Box>
        ) : (
          <Box component="ul" sx={{ m: 0, p: 0, listStyle: "none" }}>
            {[...overrideList]
              .sort((a, b) => getSortTime(b) - getSortTime(a))
              .map((o, idx) => {
                let dueDate = o.dueDate || o.releaseDate;
                if (dueDate) {
                  if (typeof dueDate === "object" && dueDate.seconds) dueDate = new Date(dueDate.seconds * 1000);
                  else if (typeof dueDate === "string" || typeof dueDate === "number") dueDate = new Date(dueDate);
                }
                const isClaimed = o.claimed || o.status === "Credited";
                const isClaimable = dueDate && new Date() >= dueDate && !isClaimed;
                const isExpired = o.expirationDate && new Date(o.expirationDate) < new Date();
                const credited = o.status === "Credited" || isExpired || isClaimed;
                const profitStatus = credited ? "Credited" : (isClaimable ? "Ready to Claim" : "Pending");
                const isLoading = !!loadingTransfer?.[o.id];

                const releaseLabel = getDisplayDate(o);
                const from = getSourceLabel(o);

                const handleSingleOverrideTransfer = async () => {
                  if (!user || credited) return alert(credited ? "Already credited." : "");
                  if (!isClaimable) return alert("Not yet due. Check back after the due date.");
                  const confirmed = window.confirm(`Transfer ₱${formatAmount(o.amount)} to eWallet?`);
                  if (!confirmed) return;
                  try {
                    setLoadingTransfer((prev) => ({ ...prev, [o.id]: true }));
                    const idToken = await user.getIdToken();
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 60000);
                    const response = await fetch(
                      "https://us-central1-amayan-savings.cloudfunctions.net/transferOverrideReward",
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${idToken}` },
                        body: JSON.stringify({ overrideId: o.id, amount: o.amount, clientRequestId: `override-${o.id}-${user.uid}` }),
                        signal: controller.signal,
                      }
                    );
                    clearTimeout(timeoutId);
                    if (!response.ok) {
                      let msg = "Failed";
                      try { const e = await response.json(); msg = e.error || msg; } catch (_) {}
                      throw new Error(msg);
                    }
                    const result = await response.json();
                    alert(result.alreadyTransferred ? "Already credited previously." : `₱${formatAmount(o.amount)} transferred!`);
                  } catch (err) {
                    if (err.name === "AbortError") {
                      alert("Transfer is still processing. Please wait a moment and check your E-Wallet history before retrying.");
                    } else {
                      alert("Transfer failed: " + (err.message || "Unknown error"));
                    }
                  } finally {
                    setLoadingTransfer((prev) => ({ ...prev, [o.id]: false }));
                  }
                };

                return (
                  <Box
                    key={o.id}
                    component="li"
                    sx={{
                      display: "flex", alignItems: "center", gap: 1.5,
                      px: 2, py: 1.8,
                      backgroundColor: idx % 2 === 0 ? "rgba(8,26,62,0.42)" : "rgba(7,22,52,0.58)",
                      borderBottom: "1px solid rgba(217,233,255,0.12)",
                    }}
                  >
                    {/* Status icon */}
                    <Box sx={{
                      width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                      backgroundColor: credited ? "rgba(46,125,50,0.10)" : isClaimable ? "rgba(239,108,0,0.10)" : "rgba(117,42,0,0.08)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {credited
                        ? <TaskAltIcon sx={{ fontSize: 20, color: "#2e7d32" }} />
                        : isClaimable
                          ? <CheckCircleIcon sx={{ fontSize: 20, color: "#ffd483" }} />
                          : <AccountTreeIcon sx={{ fontSize: 20, color: "#ffd483" }} />
                      }
                    </Box>

                    {/* Details */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, flexWrap: "wrap" }}>
                        <Typography sx={{ fontSize: 15, fontWeight: 800, color: credited ? "#81C784" : "#d9e9ff" }}>
                          ₱{formatAmount(o.amount)}
                        </Typography>
                        <Chip
                          label={profitStatus}
                          size="small"
                          sx={{
                            fontSize: 9, fontWeight: 700, height: 18,
                            backgroundColor: credited ? "rgba(46,125,50,0.12)" : isClaimable ? "rgba(239,108,0,0.12)" : "rgba(117,42,0,0.10)",
                            color: credited ? "#2e7d32" : isClaimable ? "#ffd483" : "#ffd483",
                          }}
                        />
                      </Box>
                      <Typography sx={{ fontSize: 11, color: "rgba(217,233,255,0.74)", mt: 0.3 }} noWrap>
                        From: {from}
                      </Typography>
                      {releaseLabel && (
                        <Typography sx={{ fontSize: 10, color: "rgba(217,233,255,0.58)", mt: 0.2, fontWeight: 600 }}>
                          {releaseLabel}
                        </Typography>
                      )}
                    </Box>

                    {/* Transfer button */}
                    {!credited && isClaimable && (
                      <Button
                        variant="contained"
                        size="small"
                        onClick={handleSingleOverrideTransfer}
                        disabled={isLoading}
                        sx={{
                          borderRadius: 2, textTransform: "none", fontWeight: 700,
                          minWidth: 72, fontSize: 12,
                          background: "linear-gradient(135deg, #2f7de1, #0f4ea8)", "&:hover": { background: "linear-gradient(135deg, #3b8cf2, #1a5fc5)" },
                          boxShadow: "none",
                        }}
                      >
                        {isLoading ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : "Transfer"}
                      </Button>
                    )}
                  </Box>
                );
              })}
          </Box>
        )}
      </DialogContent>

      {/* Footer */}
      <DialogActions sx={{ backgroundColor: "rgba(7,22,52,0.55)", borderTop: "1px solid rgba(217,233,255,0.14)", px: 2, py: 1.4 }}>
        <Button
          onClick={onClose}
          sx={{ borderRadius: 2, fontWeight: 700, color: "#d9e9ff", textTransform: "none",
            backgroundColor: "rgba(16,90,191,0.2)", px: 2.5, "&:hover": { backgroundColor: "rgba(16,90,191,0.3)" } }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default OverrideUplineRewardsDialog;
