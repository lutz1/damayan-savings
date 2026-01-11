import React, { useState } from "react";
import PaybackReceiptDialog from "./PaybackReceiptDialog";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  CircularProgress,
  Typography
} from "@mui/material";

const AddPaybackEntryDialog = ({
  open,
  onClose,
  onSubmit,
  selectedDate,
  setSelectedDate,
  uplineUsername,
  amount,
  setAmount,
  adding,
  receiptData,
  onDownloadReceipt,
  showReceipt,
  setShowReceipt
}) => {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const handleTrySubmit = () => {
    setConfirmOpen(true);
  };
  const handleConfirm = async () => {
    setConfirmLoading(true);
    try {
      // Await onSubmit, then show receipt dialog
      const result = await onSubmit();
      if (result && typeof setShowReceipt === 'function') {
        setShowReceipt(true);
      }
      setConfirmOpen(false);
    } finally {
      setConfirmLoading(false);
    }
  };
  const handleReceiptClose = () => {
    setShowReceipt(false);
    if (typeof onClose === 'function') onClose();
  };
  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" PaperProps={{ sx: { background: `linear-gradient(120deg, rgba(30, 41, 59, 0.95), rgba(33, 47, 61, 0.9))`, backdropFilter: "blur(14px)", border: `1px solid rgba(79, 195, 247, 0.2)`, borderRadius: 2 } }}>
        <DialogTitle sx={{ bgcolor: "rgba(31, 150, 243, 0.15)", color: "#4FC3F7", fontWeight: 700, borderBottom: "1px solid rgba(79, 195, 247, 0.15)" }}>
          <Box display="flex" flexDirection="column" alignItems="center" gap={1}>
            <Box sx={{ fontSize: 38, mb: 0.5 }}>📝</Box>
            Add Payback Entry
          </Box>
        </DialogTitle>
        <DialogContent sx={{ bgcolor: "transparent", px: 3, py: 2.5, mt: 1 }}>
          <Box display="flex" flexDirection="column" gap={2.5}>
            <Box display="flex" alignItems="center" gap={2}>
              <Box sx={{ width: 32, height: 32, bgcolor: "rgba(79, 195, 247, 0.2)", color: "#4FC3F7", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16, border: "1.5px solid #4FC3F7" }}>1</Box>
              <TextField
                label="Date"
                type="date"
                fullWidth
                value={selectedDate ? new Date(selectedDate).toISOString().slice(0,10) : ''}
                onChange={e => setSelectedDate(e.target.value)}
                InputLabelProps={{ shrink: true, style: { color: "#90CAF9" } }}
                sx={{ '& .MuiOutlinedInput-root': { color: '#b0bec5' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(79, 195, 247, 0.3)' }, '& .MuiInputBase-input': { color: '#b0bec5' }, '& label': { color: '#90CAF9' } }}
                inputProps={{ style: { color: '#b0bec5' } }}
                error={!selectedDate}
                helperText={!selectedDate ? 'Please select a date.' : ''}
              />
            </Box>
            <Box display="flex" alignItems="center" gap={2}>
              <Box sx={{ width: 32, height: 32, bgcolor: "rgba(79, 195, 247, 0.2)", color: "#4FC3F7", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16, border: "1.5px solid #4FC3F7" }}>2</Box>
              <TextField
                label="Upline Username"
                fullWidth
                value={uplineUsername}
                disabled
                sx={{ '& .MuiOutlinedInput-root': { color: '#b0bec5' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(79, 195, 247, 0.3)' }, '& .MuiInputBase-input': { color: '#b0bec5' }, '& label': { color: '#90CAF9' } }}
                InputLabelProps={{ style: { color: "#90CAF9" } }}
              />
            </Box>
            <Box display="flex" alignItems="center" gap={2}>
              <Box sx={{ width: 32, height: 32, bgcolor: "rgba(79, 195, 247, 0.2)", color: "#4FC3F7", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16, border: "1.5px solid #4FC3F7" }}>3</Box>
              <TextField
                label="Amount (₱)"
                type="number"
                fullWidth
                value={amount}
                onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                inputProps={{ min: 300, step: '0.01', style: { color: '#b0bec5' } }}
                sx={{ '& .MuiOutlinedInput-root': { color: '#b0bec5' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(79, 195, 247, 0.3)' }, '& .MuiInputBase-input': { color: '#b0bec5' }, '& label': { color: '#90CAF9' } }}
                InputLabelProps={{ style: { color: "#90CAF9" } }}
                error={!amount || Number(amount) < 300}
                helperText={!amount || Number(amount) < 300 ? 'Minimum ₱300 required.' : ''}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, bgcolor: "transparent", borderTop: "1px solid rgba(79, 195, 247, 0.15)" }}>
          <Button onClick={onClose} sx={{ fontWeight: 700, borderRadius: 1.5, textTransform: 'none', color: '#4FC3F7' }}>
            Cancel
          </Button>
          <Button
            onClick={handleTrySubmit}
            variant="contained"
            disabled={adding || !selectedDate || !amount || Number(amount) < 300}
            sx={{ fontWeight: 700, borderRadius: 1.5, textTransform: 'none', bgcolor: '#1976d2' }}
          >
            {adding ? <CircularProgress size={18} color="inherit" /> : "Submit"}
          </Button>
        </DialogActions>
      </Dialog>
      {/* Confirm Payback Entry Dialog */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} fullWidth maxWidth="xs" PaperProps={{ sx: { background: `linear-gradient(120deg, rgba(30, 41, 59, 0.95), rgba(33, 47, 61, 0.9))`, backdropFilter: "blur(14px)", border: `1px solid rgba(79, 195, 247, 0.2)`, borderRadius: 2 } }}>
        <DialogTitle sx={{ bgcolor: "rgba(31, 150, 243, 0.15)", color: "#4FC3F7", fontWeight: 700, borderBottom: "1px solid rgba(79, 195, 247, 0.15)" }}>Confirm Payback Entry</DialogTitle>
        <DialogContent sx={{ bgcolor: "transparent", mt: 2 }}>
          <Typography sx={{ color: '#b0bec5' }}>
            Are you sure you want to submit this payback entry of ₱{amount}?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, bgcolor: "transparent", borderTop: "1px solid rgba(79, 195, 247, 0.15)" }}>
          <Button onClick={() => setConfirmOpen(false)} disabled={confirmLoading} sx={{ fontWeight: 700, borderRadius: 1.5, textTransform: 'none', color: '#4FC3F7' }}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            variant="contained"
            disabled={adding || confirmLoading}
            sx={{ fontWeight: 700, borderRadius: 1.5, textTransform: 'none', bgcolor: '#1976d2' }}
          >
            {confirmLoading ? <CircularProgress size={18} color="inherit" /> : "Confirm"}
          </Button>
        </DialogActions>
      </Dialog>
      {/* Payback Receipt Dialog */}
      <PaybackReceiptDialog
        open={!!showReceipt}
        onClose={handleReceiptClose}
        receiptData={receiptData}
        onDownload={onDownloadReceipt}
      />
    </>
  );
};

export default AddPaybackEntryDialog;
