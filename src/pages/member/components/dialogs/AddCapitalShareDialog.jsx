import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  CircularProgress,
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
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = () => {
    setConfirmDialogOpen(true);
  };

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm();
      setConfirmDialogOpen(false);
    } finally {
      setIsLoading(false);
    }
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
            background: "linear-gradient(150deg, rgba(8,26,62,0.96) 0%, rgba(13,44,102,0.92) 100%)",
            backdropFilter: "blur(14px)",
            border: "1px solid rgba(217,233,255,0.22)",
            color: "#fff",
          },
        }}
      >
        <DialogTitle
          sx={{
            bgcolor: "rgba(8,31,76,0.75)",
            color: "#d9e9ff",
            fontWeight: 700,
            borderBottom: "1px solid rgba(217,233,255,0.15)",
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
              "& .MuiOutlinedInput-root": { color: "#d9e9ff", background: "rgba(6,20,52,0.42)" },
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: "rgba(217,233,255,0.3)",
              },
              "& .MuiInputBase-input": { color: "#d9e9ff" },
              "& label": { color: "rgba(217,233,255,0.74)" },
            }}
            InputLabelProps={{ shrink: true, style: { color: "rgba(217,233,255,0.74)" } }}
            inputProps={{ style: { color: "#d9e9ff" } }}
          />
          <TextField
            label="Amount (₱)"
            type="number"
            fullWidth
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            sx={{
              mb: 2,
              "& .MuiOutlinedInput-root": { color: "#d9e9ff", background: "rgba(6,20,52,0.42)" },
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: "rgba(217,233,255,0.3)",
              },
              "& .MuiInputBase-input": { color: "#d9e9ff" },
              "& label": { color: "rgba(217,233,255,0.74)" },
            }}
            InputLabelProps={{ style: { color: "rgba(217,233,255,0.74)" } }}
            inputProps={{ min: MIN_AMOUNT, style: { color: "#d9e9ff" } }}
          />
          <TextField
            label="Upline Username"
            fullWidth
            value={userData?.referredBy || "No Upline"}
            InputProps={{ readOnly: true, style: { color: "#d9e9ff" } }}
            sx={{
              mb: 2,
              "& .MuiOutlinedInput-root": { color: "#d9e9ff", background: "rgba(6,20,52,0.42)" },
              "& .MuiOutlinedInput-notchedOutline": {
                borderColor: "rgba(217,233,255,0.3)",
              },
              "& .MuiInputBase-input": { color: "#d9e9ff" },
              "& label": { color: "rgba(217,233,255,0.74)" },
            }}
            InputLabelProps={{ style: { color: "rgba(217,233,255,0.74)" } }}
          />
        </DialogContent>
        <DialogActions sx={{ borderTop: "1px solid rgba(217,233,255,0.15)", pt: 2 }}>
          <Button
            onClick={onClose}
            sx={{ fontWeight: 700, borderRadius: 1.5, textTransform: "none", color: "#d9e9ff" }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            sx={{ fontWeight: 700, borderRadius: 1.5, textTransform: "none", background: "linear-gradient(135deg, #2f7de1, #0f4ea8)" }}
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
            background: "linear-gradient(150deg, rgba(8,26,62,0.96) 0%, rgba(13,44,102,0.92) 100%)",
            backdropFilter: "blur(14px)",
            border: "1px solid rgba(217,233,255,0.22)",
            color: "#fff",
          },
        }}
      >
        <DialogTitle
          sx={{
            bgcolor: "rgba(8,31,76,0.75)",
            color: "#d9e9ff",
            fontWeight: 700,
            borderBottom: "1px solid rgba(217,233,255,0.15)",
          }}
        >
          Confirm Submission
        </DialogTitle>
        <DialogContent sx={{ bgcolor: "transparent", mt: 2 }}>
          <Typography sx={{ color: "rgba(217,233,255,0.8)" }}>
            Are you sure you want to add a capital share entry of ₱
            {Number(amount).toLocaleString()} on {selectedDate?.toDateString()}?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ borderTop: "1px solid rgba(217,233,255,0.15)", pt: 2 }}>
          <Button
            onClick={() => setConfirmDialogOpen(false)}
            disabled={isLoading}
            sx={{ fontWeight: 700, borderRadius: 1.5, textTransform: "none", color: "#d9e9ff" }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirm}
            disabled={isLoading}
            sx={{ fontWeight: 700, borderRadius: 1.5, textTransform: "none", background: "linear-gradient(135deg, #2f7de1, #0f4ea8)" }}
          >
            {isLoading ? <CircularProgress size={20} color="inherit" /> : "Confirm"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AddCapitalShareDialog;
