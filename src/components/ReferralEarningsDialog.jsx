// ReferralEarningsDialog.jsx
import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography,
} from "@mui/material";

import { auth, db } from "../firebase";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";

const ReferralEarningsDialog = ({
  open,
  onClose,
  balance,
  userId,
  onSuccess,
}) => {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const handleTransfer = async () => {
    const numericAmount = Number(amount);

    if (!numericAmount || numericAmount <= 0) {
      alert("Enter a valid amount.");
      return;
    }

    if (numericAmount > balance) {
      alert("Insufficient Referral Earnings balance.");
      return;
    }

    try {
      setLoading(true);

      const currentUserId = auth.currentUser.uid;

      // 🔥 If admin/ceo opened this dialog, they can transfer to ANY user
      const targetUser = userId || currentUserId;

      const userRef = doc(db, "users", targetUser);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        alert("User not found.");
        setLoading(false);
        return;
      }

      const currentWallet = userSnap.data().eWallet || 0;

      // ⭐ Update eWallet
      await updateDoc(userRef, {
        eWallet: currentWallet + numericAmount,
        updatedAt: Date.now(),
      });

      // ⭐ Mark referral earnings as transferred
      const rewardsRef = collection(db, "referralReward");
      const rewardsQuery = query(
        rewardsRef,
        where("userId", "==", targetUser),
        where("payoutReleased", "==", true)
      );

      const rewardsSnap = await getDocs(rewardsQuery);

      const updatePromises = rewardsSnap.docs.map((item) =>
        updateDoc(doc(db, "referralReward", item.id), {
          payoutReleased: false,
          dateTransferred: Date.now(),
        })
      );

      await Promise.all(updatePromises);

      alert(`₱${numericAmount.toLocaleString()} transferred to eWallet!`);
      onSuccess();
    } catch (err) {
      console.error("Transfer failed:", err);
      alert("Transfer failed, please try again.");
    } try {
  setLoading(true);
  // ... firestore update code
  alert(`₱${numericAmount.toLocaleString()} transferred to eWallet!`);
  setAmount(""); // clear **only on success**
  onSuccess();
} catch (err) {
  console.error("Transfer failed:", err);
  alert("Transfer failed, please try again.");
} finally {
  setLoading(false);
}
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Transfer Referral Earnings</DialogTitle>

      <DialogContent>
        <Typography sx={{ mb: 1 }}>
          Available Balance: <strong>₱{balance.toLocaleString()}</strong>
        </Typography>

        <TextField
          label="Enter amount"
          type="number"
          fullWidth
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          sx={{ mt: 1 }}
        />
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>

        <Button
          variant="contained"
          color="success"
          onClick={handleTransfer}
          disabled={loading}
        >
          {loading ? "Processing..." : "Confirm Transfer"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ReferralEarningsDialog;