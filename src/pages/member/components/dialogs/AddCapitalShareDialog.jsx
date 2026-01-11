import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
} from "@mui/material";

const AddCapitalShareDialog = ({
  open,
  onClose,
  amount,
  setAmount,
  selectedDate,
  setSelectedDate,
  userData,
  MIN_AMOUNT,
  onConfirm,
}) => {
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const handleSubmit = () => {
    setConfirmDialogOpen(true);
  };

  const handleConfirm = async () => {
    setConfirmDialogOpen(false);
    await onConfirm();
  };

  return (
    <>
      {/* Add Entry Dialog */}
      <Dialog
        open={open}
        onClose={onClose}
        fullWidth
        maxWidth="xs"
        PaperProps={{
          sx: {
            background: `linear-gradient(120deg, rgba(30, 41, 59, 0.95), rgba(33, 47, 61, 0.9))`,
            backdropFilter: "blur(14px)",
            border: `1px solid rgba(79, 195, 247, 0.2)`,
          },
        }}
      >
        <DialogTitle
          sx={{
            bgcolor: "rgba(31, 150, 243, 0.15)",
            color: "#4FC3F7",
            fontWeight: 700,
            borderBottom: "1px solid rgba(79, 195, 247, 0.15)",
          }}
        >
          Add Capital Share Entry
        </DialogTitle>
        <DialogContent sx={{ bgcolor: "transparent", mt: 2 }}>
          <TextField
            label="Selected Date"
            type="date"
            fullWidth
            value={selectedDate ? selectedDate.toISOString().slice(0, 10) : ""}
            onChange={(e) => setSelectedDate(new Date(e.target.value))}
            sx={{
              mb: 2,
              mt: 1,
              "& .MuiOutlinedInput-root": { color: "#b0bec5" },
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: "rgba(79, 195, 247, 0.3)",
              },
              "& .MuiInputBase-input": { color: "#b0bec5" },
              "& label": { color: "#90CAF9" },
            }}
            InputLabelProps={{ shrink: true, style: { color: "#90CAF9" } }}
            inputProps={{ style: { color: "#b0bec5" } }}
          />
          <TextField
            label="Amount (₱)"
            type="number"
            fullWidth
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            sx={{
              mb: 2,
              "& .MuiOutlinedInput-root": { color: "#b0bec5" },
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: "rgba(79, 195, 247, 0.3)",
              },
              "& .MuiInputBase-input": { color: "#b0bec5" },
              "& label": { color: "#90CAF9" },
            }}
            InputLabelProps={{ style: { color: "#90CAF9" } }}
            inputProps={{ min: MIN_AMOUNT, style: { color: "#b0bec5" } }}
          />
          <TextField
            label="Upline Username"
            fullWidth
            value={userData?.referredBy || "No Upline"}
            InputProps={{ readOnly: true, style: { color: "#b0bec5" } }}
            sx={{
              mb: 2,
              "& .MuiOutlinedInput-root": { color: "#b0bec5" },
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: "rgba(79, 195, 247, 0.3)",
              },
              "& .MuiInputBase-input": { color: "#b0bec5" },
              "& label": { color: "#90CAF9" },
            }}
            InputLabelProps={{ style: { color: "#90CAF9" } }}
          />
        </DialogContent>
        <DialogActions sx={{ borderTop: "1px solid rgba(79, 195, 247, 0.15)", pt: 2 }}>
          <Button
            onClick={onClose}
            sx={{ fontWeight: 700, borderRadius: 1.5, textTransform: "none", color: "#4FC3F7" }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            sx={{ fontWeight: 700, borderRadius: 1.5, textTransform: "none", bgcolor: "#1976d2" }}
          >
            Submit
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm Submission Dialog */}
      <Dialog
        open={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
        fullWidth
        maxWidth="xs"
        PaperProps={{
          sx: {
            background: `linear-gradient(120deg, rgba(30, 41, 59, 0.95), rgba(33, 47, 61, 0.9))`,
            backdropFilter: "blur(14px)",
            border: `1px solid rgba(79, 195, 247, 0.2)`,
          },
        }}
      >
        <DialogTitle
          sx={{
            bgcolor: "rgba(31, 150, 243, 0.15)",
            color: "#4FC3F7",
            fontWeight: 700,
            borderBottom: "1px solid rgba(79, 195, 247, 0.15)",
          }}
        >
          Confirm Submission
        </DialogTitle>
        <DialogContent sx={{ bgcolor: "transparent", mt: 2 }}>
          <Typography sx={{ color: "#b0bec5" }}>
            Are you sure you want to add a capital share entry of ₱
            {Number(amount).toLocaleString()} on {selectedDate?.toDateString()}?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ borderTop: "1px solid rgba(79, 195, 247, 0.15)", pt: 2 }}>
          <Button
            onClick={() => setConfirmDialogOpen(false)}
            sx={{ fontWeight: 700, borderRadius: 1.5, textTransform: "none", color: "#4FC3F7" }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirm}
            sx={{ fontWeight: 700, borderRadius: 1.5, textTransform: "none", bgcolor: "#1976d2" }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AddCapitalShareDialog;
