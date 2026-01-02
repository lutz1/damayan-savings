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
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 4, boxShadow: 12 } }}>
        <DialogTitle sx={{ bgcolor: '#1976d2', color: '#fff', fontWeight: 700, textAlign: 'center', pb: 2, borderTopLeftRadius: 4, borderTopRightRadius: 4, boxShadow: 2 }}>
          <Box display="flex" flexDirection="column" alignItems="center" gap={1}>
            <Box sx={{ fontSize: 38, mb: 0.5 }}>📝</Box>
            Add Payback Entry
          </Box>
        </DialogTitle>
        <DialogContent dividers sx={{ bgcolor: '#f8fafc', px: 4, py: 3, borderBottom: '1px solid #e3e8ee' }}>
          <Box display="flex" flexDirection="column" gap={3}>
            <Box display="flex" alignItems="center" gap={2}>
              <Box sx={{ width: 28, height: 28, bgcolor: '#1976d2', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 }}>1</Box>
              <TextField
                label="Date"
                type="date"
                fullWidth
                value={selectedDate ? new Date(selectedDate).toISOString().slice(0,10) : ''}
                onChange={e => setSelectedDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ bgcolor: '#fff', borderRadius: 2 }}
                error={!selectedDate}
                helperText={!selectedDate ? 'Please select a date.' : ''}
              />
            </Box>
            <Box display="flex" alignItems="center" gap={2}>
              <Box sx={{ width: 28, height: 28, bgcolor: '#1976d2', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 }}>2</Box>
              <TextField
                label="Upline Username"
                fullWidth
                value={uplineUsername}
                disabled
                sx={{ bgcolor: '#fff', borderRadius: 2 }}
              />
            </Box>
            <Box display="flex" alignItems="center" gap={2}>
              <Box sx={{ width: 28, height: 28, bgcolor: '#1976d2', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 }}>3</Box>
              <TextField
                label="Amount (₱)"
                type="number"
                fullWidth
                value={amount}
                onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                inputProps={{ min: 300, step: '0.01' }}
                sx={{ bgcolor: '#fff', borderRadius: 2 }}
                error={!amount || Number(amount) < 300}
                helperText={!amount || Number(amount) < 300 ? 'Minimum ₱300 required.' : ''}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 4, pb: 2, bgcolor: '#f8fafc', borderBottomLeftRadius: 4, borderBottomRightRadius: 4, boxShadow: 1 }}>
          <Button onClick={onClose} color="error" variant="outlined" sx={{ borderRadius: 2, minWidth: 100, fontWeight: 600 }}>
            Cancel
          </Button>
          <Button
            onClick={handleTrySubmit}
            color="primary"
            variant="contained"
            disabled={adding || !selectedDate || !amount || Number(amount) < 300}
            sx={{ borderRadius: 2, minWidth: 100, fontWeight: 600, boxShadow: 2 }}
          >
            {adding ? <CircularProgress size={18} color="inherit" /> : "Submit"}
          </Button>
        </DialogActions>
      </Dialog>
      {/* Confirm Payback Entry Dialog */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Confirm Payback Entry</DialogTitle>
        <DialogContent dividers>
          <Typography>
            Are you sure you want to submit this payback entry of ₱{amount}?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} color="error" disabled={confirmLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            color="primary"
            variant="contained"
            disabled={adding || confirmLoading}
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
