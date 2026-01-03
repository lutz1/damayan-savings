import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  List,
  ListItem,
  ListItemText,
} from "@mui/material";

const RewardHistoryDialog = ({
  open,
  onClose,
  rewardHistory = [],
  user,
  loadingTransfer = {},
  setLoadingTransfer = () => {},
}) => {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Reward History</DialogTitle>
      <DialogContent dividers>
        {rewardHistory.length === 0 ? (
          <Typography variant="body2">No approved rewards yet.</Typography>
        ) : (
          <List>
            {rewardHistory
              .sort((a, b) => (b.releasedAt?.seconds || 0) - (a.releasedAt?.seconds || 0))
              .map((reward) => {
                const transferred = reward.transferredAmount && reward.dateTransferred;
                const transferredText = transferred
                  ? ` | Transferred: ₱${(reward.transferredAmount || 0).toLocaleString()} on ${new Date(
                      reward.dateTransferred
                    ).toLocaleString()}`
                  : " | Not yet transferred";

                const handleSingleTransfer = async () => {
                  if (!user) return;
                  if (transferred) return alert("Reward already transferred.");

                  // ✅ Ask user for confirmation
                  const confirmed = window.confirm(
                    `Are you sure you want to transfer ₱${reward.amount.toLocaleString()} to your eWallet?`
                  );
                  if (!confirmed) return;

                  try {
                    setLoadingTransfer((prev) => ({ ...prev, [reward.id]: true }));

                    const userRef = window.firebaseUserRef
                      ? window.firebaseUserRef(user.uid)
                      : null;
                    const userSnap = userRef ? await userRef.get() : null;
                    if (!userSnap || !userSnap.exists()) return alert("User not found.");

                    const currentBalance = userSnap.data().eWallet || 0;
                    await userRef.update({
                      eWallet: currentBalance + reward.amount,
                      updatedAt: Date.now(),
                    });

                    // Mark this reward as transferred
                    await window.firebaseRewardRef(reward.id).update({
                      transferredAmount: reward.amount,
                      dateTransferred: Date.now(),
                    });

                    alert(`₱${reward.amount.toLocaleString()} transferred to eWallet!`);
                  } catch (err) {
                    console.error("Error transferring reward:", err);
                    alert("Failed to transfer reward.");
                  } finally {
                    setLoadingTransfer((prev) => ({ ...prev, [reward.id]: false }));
                  }
                };

                return (
                  <ListItem key={reward.id} divider>
                    <ListItemText
                      primary={`₱${reward.amount.toLocaleString()} earned`}
                      secondary={`From: ${reward.source}${transferredText}`}
                    />
                    {!transferred && (
                      <Button
                        variant="contained"
                        size="small"
                        color="success"
                        onClick={handleSingleTransfer}
                        disabled={loadingTransfer?.[reward.id]}
                      >
                        {loadingTransfer?.[reward.id] ? "Processing..." : "Transfer to eWallet"}
                      </Button>
                    )}
                  </ListItem>
                );
              })}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default RewardHistoryDialog;
