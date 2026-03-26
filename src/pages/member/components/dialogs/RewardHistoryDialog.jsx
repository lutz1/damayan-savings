import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';

const API_BASE = import.meta.env.REACT_APP_API_BASE_URL || "http://localhost:5000";

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
      maxWidth="sm"
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: "hidden",
          backgroundColor: "#f7f9fc",
        },
      }}
    >
      {/* Header */}
      <DialogTitle sx={{ background: "linear-gradient(135deg,#003f8d,#0055ba)", color: "#fff", p: 0 }}>
        <Box sx={{ px: 2.5, pt: 2.5, pb: 2.2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.2, mb: 0.6 }}>
            <Box sx={{ width: 36, height: 36, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.18)",
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <GroupAddIcon sx={{ color: "#fff", fontSize: 20 }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 9, color: "rgba(255,255,255,0.72)", letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700 }}>Earnings</Typography>
              <Typography sx={{ fontSize: 19, fontWeight: 800, color: "#fff" }}>Referral Rewards</Typography>
            </Box>
          </Box>
          <Chip
            label={`${rewardHistory.filter(r => !r.transferredAmount && !r.dateTransferred).length} pending transfer${rewardHistory.filter(r => !r.transferredAmount && !r.dateTransferred).length !== 1 ? "s" : ""}`}
            size="small"
            sx={{ backgroundColor: "rgba(255,255,255,0.2)", color: "#fff", fontWeight: 700, fontSize: 11 }}
          />
        </Box>
      </DialogTitle>

      {/* Content */}
      <DialogContent sx={{ p: 0, backgroundColor: "#f7f9fc" }}>
        {rewardHistory.length === 0 ? (
          <Box sx={{ py: 8, textAlign: "center" }}>
            <HourglassEmptyIcon sx={{ fontSize: 44, color: "#c2c6d5", mb: 1 }} />
            <Typography sx={{ fontSize: 13, color: "#8b95a5" }}>No approved rewards yet.</Typography>
          </Box>
        ) : (
          <Box component="ul" sx={{ m: 0, p: 0, listStyle: "none" }}>
            {[...rewardHistory]
              .filter(r => !r.transferredAmount && !r.dateTransferred)
              .sort((a, b) => (b.releasedAt?.seconds || 0) - (a.releasedAt?.seconds || 0))
              .map((reward, idx) => {
                const transferred = !!(reward.transferredAmount && reward.dateTransferred);
                const isLoading = !!loadingTransfer?.[reward.id];

                const handleSingleTransfer = async () => {
                  if (!user) return;
                  if (transferred) return alert("Reward already transferred.");
                  const confirmed = window.confirm(
                    `Are you sure you want to transfer \u20b1${reward.amount.toLocaleString()} to your eWallet?`
                  );
                  if (!confirmed) return;
                  try {
                    setLoadingTransfer((prev) => ({ ...prev, [reward.id]: true }));
                    const idToken = await user.getIdToken();
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 30000);
                    const response = await fetch(
                      "https://us-central1-amayan-savings.cloudfunctions.net/transferReferralReward",
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${idToken}` },
                        body: JSON.stringify({ rewardId: reward.id, amount: reward.amount, clientRequestId: `reward-${reward.id}-${user.uid}` }),
                        signal: controller.signal,
                      }
                    );
                    clearTimeout(timeoutId);
                    if (!response.ok) {
                      let msg = "Failed to transfer reward";
                      try { const e = await response.json(); msg = e.error || msg; } catch (_) {}
                      throw new Error(msg);
                    }
                    const result = await response.json();
                    alert(result.alreadyTransferred ? "Already transferred previously." : `\u20b1${reward.amount.toLocaleString()} transferred to eWallet!`);
                    onTransferSuccess();
                  } catch (err) {
                    const msg = err.name === "AbortError" ? "Request timed out." : (err.message || "Unknown error");
                    alert("Transfer failed: " + msg);
                  } finally {
                    setLoadingTransfer((prev) => ({ ...prev, [reward.id]: false }));
                  }
                };

                const dateLabel = reward.releasedAt?.seconds
                  ? new Date(reward.releasedAt.seconds * 1000).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
                  : "";

                return (
                  <Box
                    key={reward.id}
                    component="li"
                    sx={{
                      display: "flex", alignItems: "center", gap: 1.5,
                      px: 2, py: 1.8,
                      backgroundColor: idx % 2 === 0 ? "#fff" : "#f7f9fc",
                      borderBottom: "1px solid #eceef1",
                    }}
                  >
                    {/* Icon */}
                    <Box sx={{
                      width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                      backgroundColor: "rgba(16,90,191,0.08)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <GroupAddIcon sx={{ color: "#105abf", fontSize: 20 }} />
                    </Box>

                    {/* Details */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.8, flexWrap: "wrap" }}>
                        <Typography sx={{ fontSize: 15, fontWeight: 800, color: "#105abf" }}>
                          \u20b1{Number(reward.amount).toLocaleString()}
                        </Typography>
                        <Chip
                          label="Pending Transfer"
                          size="small"
                          sx={{ fontSize: 9, fontWeight: 700, height: 18,
                            backgroundColor: "rgba(239,108,0,0.12)", color: "#e65100" }}
                        />
                      </Box>
                      {reward.source && (
                        <Typography sx={{ fontSize: 11, color: "#5d646f", mt: 0.3 }}
                          noWrap title={reward.source}>
                          From: {reward.source}
                        </Typography>
                      )}
                      {dateLabel && (
                        <Typography sx={{ fontSize: 10, color: "#8b95a5", mt: 0.2, fontWeight: 600 }}>
                          {dateLabel}
                        </Typography>
                      )}
                    </Box>

                    {/* Transfer button */}
                    <Button
                      variant="contained"
                      size="small"
                      onClick={handleSingleTransfer}
                      disabled={isLoading}
                      sx={{
                        borderRadius: 2, textTransform: "none", fontWeight: 700,
                        minWidth: 72, fontSize: 12,
                        backgroundColor: "#105abf", "&:hover": { backgroundColor: "#0b4eaa" },
                        boxShadow: "none",
                      }}
                    >
                      {isLoading ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : "Transfer"}
                    </Button>
                  </Box>
                );
              })}
          </Box>
        )}
      </DialogContent>

      {/* Footer */}
      <DialogActions sx={{ backgroundColor: "#fff", borderTop: "1px solid #eceef1", px: 2, py: 1.4 }}>
        <Button
          onClick={onClose}
          sx={{ borderRadius: 2, fontWeight: 700, color: "#105abf", textTransform: "none",
            backgroundColor: "rgba(16,90,191,0.08)", px: 2.5, "&:hover": { backgroundColor: "rgba(16,90,191,0.14)" } }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RewardHistoryDialog;

