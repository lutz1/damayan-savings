import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
} from "@mui/material";

const OverrideUplineRewardsDialog = ({
  open,
  onClose,
  overrideList = [],
  user,
  loadingTransfer = {},
  setLoadingTransfer = () => {},
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="lg"
      PaperProps={{
        sx: {
          background: "rgba(30,41,59,0.92)",
          borderRadius: 3,
          boxShadow: "0 8px 32px 0 rgba(31,38,135,0.37)",
          color: "#fff",
          backdropFilter: "blur(10px)",
        },
      }}
    >
      <DialogTitle
        sx={{
          fontWeight: 700,
          letterSpacing: 0.5,
          color: "#FFD54F",
          textShadow: "1px 1px 3px rgba(0,0,0,0.4)",
          textAlign: "center",
          background: "rgba(33,150,243,0.10)",
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          mb: 1,
        }}
      >
        Override Upline Rewards
      </DialogTitle>
      <DialogContent
        dividers
        sx={{
          background: "rgba(255,255,255,0.03)",
          borderRadius: 2,
          p: 0,
          maxHeight: { xs: 800, sm: 900, md: 1000, lg: 1200 },
          minHeight: 480,
          overflowY: "auto",
          width: '100%',
        }}
      >
        {overrideList.length === 0 ? (
          <Box display="flex" alignItems="center" justifyContent="center" height="120px">
            <Typography variant="body2" sx={{ color: "#FFD54F", textAlign: "center" }}>
              No override rewards found.
            </Typography>
          </Box>
        ) : (
          <Box
            sx={{
              width: "100%",
              flex: 1,
              overflowY: "auto",
              maxHeight: { xs: 700, sm: 800, md: 900, lg: 1100 },
              scrollbarWidth: "none",
              "-ms-overflow-style": "none",
              "&::-webkit-scrollbar": {
                display: "none",
              },
              p: 0,
              m: 0,
            }}
            component="ul"
          >
            {[...overrideList]
              .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
              .map((o) => {
                // Check if dueDate has passed for uplineRewards collection
                let dueDate = o.dueDate || o.releaseDate;
                if (dueDate) {
                  if (typeof dueDate === "object" && dueDate.seconds) {
                    dueDate = new Date(dueDate.seconds * 1000);
                  } else if (typeof dueDate === "string" || typeof dueDate === "number") {
                    dueDate = new Date(dueDate);
                  }
                }
                
                const isClaimed = o.claimed || o.status === "Credited";
                const isClaimable = dueDate && new Date() >= dueDate && !isClaimed;
                
                // Fallback for old override collection (with expirationDate)
                const isExpired = o.expirationDate && new Date(o.expirationDate) < new Date();
                const credited = o.status === "Credited" || isExpired || isClaimed;
                
                const profitStatus = credited ? "Credited" : (isClaimable ? "Ready to Claim" : "Pending");
                const profitIcon = credited ? "✅" : (isClaimable ? "✓" : "⏳");
                const borderColor = credited ? "#4caf50" : (isClaimable ? "#fdd835" : "#1976d2");
                const iconBg = credited ? "rgba(76,175,80,0.12)" : (isClaimable ? "rgba(253,216,53,0.12)" : "rgba(33,150,243,0.12)");
                const iconColor = credited ? "#81C784" : (isClaimable ? "#FBC02D" : "#64B5F6");

                const handleSingleOverrideTransfer = async () => {
                  if (!user) return;
                  if (credited) return alert("Already credited.");
                  if (!isClaimable) return alert("This reward is not yet due. Check back after the due date.");
                  const confirmed = window.confirm(
                    `Are you sure you want to transfer ₱${o.amount.toLocaleString()} to your eWallet?`
                  );
                  if (!confirmed) return;
                  try {
                    setLoadingTransfer((prev) => ({ ...prev, [o.id]: true }));
                    
                    // Get user's ID token
                    const idToken = await user.getIdToken();
                    
                    // Call Cloud Function HTTP endpoint with Authorization header
                    const endpoint = "https://us-central1-amayan-savings.cloudfunctions.net/transferOverrideReward";
                    console.log("[OverrideTransfer] Calling endpoint:", endpoint);
                    
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
                    
                    const response = await fetch(endpoint, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${idToken}`,
                      },
                      body: JSON.stringify({
                        overrideId: o.id,
                        amount: o.amount,
                      }),
                      signal: controller.signal,
                    });
                    
                    clearTimeout(timeoutId);

                    if (!response.ok) {
                      let errorMessage = "Failed to transfer reward";
                      try {
                        const errorData = await response.json();
                        errorMessage = errorData.error || errorMessage;
                      } catch (e) {
                        errorMessage = `Server error (${response.status}): ${response.statusText}`;
                      }
                      throw new Error(errorMessage);
                    }

                    const result = await response.json();
                    console.log("[OverrideTransfer] Success:", result);
                    
                    if (result.alreadyTransferred) {
                      alert("This reward was already credited previously.");
                    } else {
                      alert(`₱${o.amount.toLocaleString()} successfully transferred to eWallet!`);
                    }
                  } catch (err) {
                    console.error("[OverrideTransfer] Error:", err);
                    let userMsg = "Failed to transfer reward: ";
                    if (err.name === "AbortError") {
                      userMsg += "Request timeout (check your internet connection)";
                    } else if (err instanceof TypeError && err.message.includes("fetch")) {
                      userMsg += "Network error - unable to reach Cloud Function";
                    } else {
                      userMsg += err.message || "Unknown error";
                    }
                    alert(userMsg);
                  } finally {
                    setLoadingTransfer((prev) => ({ ...prev, [o.id]: false }));
                  }
                };
                let releaseDate = "N/A";
                const dateObj = o.releaseDate || o.createdAt;
                if (dateObj) {
                  let d;
                  if (typeof dateObj === "object" && dateObj.seconds) {
                    d = new Date(dateObj.seconds * 1000);
                  } else if (typeof dateObj === "string" || typeof dateObj === "number") {
                    d = new Date(dateObj);
                  }
                  if (d && !isNaN(d.getTime())) {
                    releaseDate = d.toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric"
                    });
                  }
                }
                const from = o.fromUsername || o.fromUser || o.source || "N/A";
                return (
                  <Box
                    key={o.id}
                    component="li"
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "flex-start",
                      borderBottom: "1px solid rgba(255,255,255,0.06)",
                      py: 1,
                      px: { xs: 0.5, sm: 1, md: 1.5 },
                      width: '100%',
                      m: 0,
                      gap: 1.5,
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minWidth: 32,
                        minHeight: 32,
                        bgcolor: iconBg,
                        borderRadius: "50%",
                        mr: 1.5,
                        border: `1.5px solid ${borderColor}`,
                      }}
                    >
                      <Typography sx={{ fontSize: 16, color: iconColor }}>{profitIcon}</Typography>
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        variant="subtitle2"
                        sx={{ fontWeight: 600, color: "#fff", fontSize: 13, lineHeight: 1.2 }}
                      >
                        ₱{o.amount.toLocaleString()} override
                      </Typography>
                      <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 0.2, mb: 0.2 }}>
                        <Typography
                          sx={{
                            px: 0.7,
                            py: 0.1,
                            borderRadius: 1,
                            bgcolor: credited ? "#1976d2" : "#c62828",
                            color: "#fff",
                            fontWeight: 500,
                            fontSize: 10,
                            letterSpacing: 0.2,
                          }}
                        >
                          {credited ? "Valid" : "Pending"}
                        </Typography>
                        <Typography
                          sx={{
                            px: 0.7,
                            py: 0.1,
                            borderRadius: 1,
                            bgcolor: profitStatus === "Credited" ? "#388e3c" : "#ef6c00",
                            color: "#fff",
                            fontWeight: 500,
                            fontSize: 10,
                            letterSpacing: 0.2,
                          }}
                        >
                          {profitStatus}
                        </Typography>
                      </Box>
                      <Typography
                        variant="caption"
                        sx={{
                          color: "#B3E5FC",
                          fontWeight: 400,
                          display: "block",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: { xs: 100, sm: 140, md: 180 },
                        }}
                        title={from}
                      >
                        From: {from}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: "#fff", opacity: 0.6, display: "block", mt: 0.2, fontSize: 10 }}
                      >
                        {releaseDate}
                      </Typography>
                    </Box>
                    {!credited && isClaimable && (
                      <Button
                        variant="contained"
                        size="small"
                        color="success"
                        onClick={handleSingleOverrideTransfer}
                        disabled={loadingTransfer?.[o.id]}
                        sx={{ ml: 1, fontWeight: 500, minWidth: 60, px: 1.5, py: 0.5, height: 28, fontSize: 12, borderRadius: 2, boxShadow: 'none' }}
                      >
                        {loadingTransfer?.[o.id] ? "..." : "Transfer"}
                      </Button>
                    )}
                  </Box>
                );
              })}
          </Box>
        )}
      </DialogContent>
      <DialogActions
        sx={{
          background: "rgba(33,150,243,0.10)",
          borderBottomRightRadius: 16,
          borderBottomLeftRadius: 16,
        }}
      >
        <Button onClick={onClose} sx={{ fontWeight: 600, color: "#1976d2" }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default OverrideUplineRewardsDialog;
