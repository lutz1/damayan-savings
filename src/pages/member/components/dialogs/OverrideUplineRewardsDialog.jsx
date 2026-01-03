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

const OverrideUplineRewardsDialog = ({
  open,
  onClose,
  overrideList = [],
  user,
  loadingTransfer = {},
  setLoadingTransfer = () => {},
}) => {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Override Upline Rewards</DialogTitle>
      <DialogContent dividers>
        {overrideList.length === 0 ? (
          <Typography variant="body2">No override rewards found.</Typography>
        ) : (
          <List>
            {overrideList
              .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
              .map((o) => {
                const isExpired = o.expirationDate && new Date(o.expirationDate) < new Date();
                const credited = o.status === "Credited" || isExpired;

                const handleSingleOverrideTransfer = async () => {
                  if (!user) return;
                  if (credited) return alert("Already credited.");

                  const confirmed = window.confirm(
                    `Are you sure you want to transfer ₱${o.amount.toLocaleString()} to your eWallet?`
                  );
                  if (!confirmed) return;

                  try {
                    setLoadingTransfer((prev) => ({ ...prev, [o.id]: true }));

                    // Call backend API for override transfer
                    const idToken = await user.getIdToken();
                    const response = await fetch("/api/transfer-override-reward", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ idToken, overrideId: o.id, amount: o.amount })
                    });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.error || "Transfer failed");

                    alert(`₱${o.amount.toLocaleString()} successfully transferred to eWallet!`);
                  } catch (err) {
                    console.error(err);
                    alert(err.message || "Transfer failed.");
                  } finally {
                    setLoadingTransfer((prev) => ({ ...prev, [o.id]: false }));
                  }
                };

                // Show 'Release Date' using releaseDate (preferred) or createdAt, formatted as 'Month Day, Year'
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
                      month: "long",
                      day: "numeric"
                    });
                  }
                }
                const from = o.fromUsername || o.fromUser || o.source || "N/A";
                return (
                  <ListItem key={o.id} divider>
                    <ListItemText
                      primary={`₱${o.amount.toLocaleString()} — ${credited ? "Credited" : "Pending"}`}
                      secondary={`From: ${from} | Release Date: ${releaseDate}`}
                    />
                    {!credited && (
                      <Button
                        variant="contained"
                        size="small"
                        color="primary"
                        onClick={handleSingleOverrideTransfer}
                        disabled={loadingTransfer?.[o.id]}
                      >
                        {loadingTransfer?.[o.id] ? "Processing..." : "Transfer to eWallet"}
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

export default OverrideUplineRewardsDialog;
