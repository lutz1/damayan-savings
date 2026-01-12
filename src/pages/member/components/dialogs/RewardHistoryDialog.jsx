import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

const RewardHistoryDialog = ({
  open,
  onClose,
  rewardHistory = [],
  user,
  loadingTransfer = {},
  setLoadingTransfer = () => {},
  onTransferSuccess = () => {},
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
        Reward History
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
        {rewardHistory.length === 0 ? (
          <Box display="flex" alignItems="center" justifyContent="center" height="120px">
            <Typography variant="body2" sx={{ color: "#FFD54F", textAlign: "center" }}>
              No approved rewards yet.
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
            {[...rewardHistory]
              // Double-check: exclude transferred rewards from display
              .filter(r => !r.transferredAmount && !r.dateTransferred)
              .sort((a, b) => (b.releasedAt?.seconds || b.dateTransferred?.seconds || 0) - (a.releasedAt?.seconds || a.dateTransferred?.seconds || 0))
              .map((reward) => {
                // Reward is transferred ONLY if both transferredAmount AND dateTransferred exist
                const transferred = !!(reward.transferredAmount && reward.dateTransferred);
                const profitStatus = transferred ? "Transferred" : "Pending";
                const profitIcon = transferred ? "✅" : "⏳";
                const borderColor = transferred ? "#4caf50" : "#1976d2";
                const iconBg = transferred ? "rgba(76,175,80,0.12)" : "rgba(33,150,243,0.12)";
                const iconColor = transferred ? "#81C784" : "#64B5F6";
                const handleSingleTransfer = async () => {
                  if (!user) return;
                  if (transferred) return alert("Reward already transferred.");
                  const confirmed = window.confirm(
                    `Are you sure you want to transfer ₱${reward.amount.toLocaleString()} to your eWallet?`
                  );
                  if (!confirmed) return;
                  try {
                    setLoadingTransfer((prev) => ({ ...prev, [reward.id]: true }));
                    
                    // Get user's ID token
                    const idToken = await user.getIdToken();
                    
                    // Call backend API to transfer reward
                    const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://localhost:5000";
                    const response = await fetch(`${API_BASE}/api/transfer-referral-reward`, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        idToken,
                        rewardId: reward.id,
                        amount: reward.amount,
                      }),
                    });

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

                    await response.json();
                    alert(`₱${reward.amount.toLocaleString()} transferred to eWallet!`);
                    onTransferSuccess();
                  } catch (err) {
                    console.error("Error transferring reward:", err);
                    alert(`Failed to transfer reward: ${err.message || "Unknown error"}`);
                  } finally {
                    setLoadingTransfer((prev) => ({ ...prev, [reward.id]: false }));
                  }
                };
                return (
                  <Box
                    key={reward.id}
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
                        ₱{reward.amount.toLocaleString()} earned
                      </Typography>
                      <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 0.2, mb: 0.2 }}>
                        <Typography
                          sx={{
                            px: 0.7,
                            py: 0.1,
                            borderRadius: 1,
                            bgcolor: transferred ? "#1976d2" : "#c62828",
                            color: "#fff",
                            fontWeight: 500,
                            fontSize: 10,
                            letterSpacing: 0.2,
                          }}
                        >
                          {transferred ? "Valid" : "Pending"}
                        </Typography>
                        <Typography
                          sx={{
                            px: 0.7,
                            py: 0.1,
                            borderRadius: 1,
                            bgcolor: profitStatus === "Transferred" ? "#388e3c" : "#ef6c00",
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
                        title={reward.source}
                      >
                        From: {reward.source}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: "#fff", opacity: 0.6, display: "block", mt: 0.2, fontSize: 10 }}
                      >
                        {reward.releasedAt?.seconds
                          ? new Date(reward.releasedAt.seconds * 1000).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          : ""}
                      </Typography>
                    </Box>
                    {!transferred && (
                      <Button
                        variant="contained"
                        size="small"
                        color="success"
                        onClick={handleSingleTransfer}
                        disabled={loadingTransfer?.[reward.id]}
                        sx={{ ml: 1, fontWeight: 500, minWidth: 60, px: 1.5, py: 0.5, height: 28, fontSize: 12, borderRadius: 2, boxShadow: 'none' }}
                      >
                        {loadingTransfer?.[reward.id] ? "..." : "Transfer"}
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

export default RewardHistoryDialog;
