import React from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, IconButton, Tooltip } from "@mui/material";

const PaybackReceiptDialog = ({ open, onClose, receiptData, onDownload }) => {
  if (!receiptData) return null;
  const { date, amount, reference, createdAt } = receiptData;
  // Prevent closing by clicking outside or pressing Escape
  const handleDialogClose = (event, reason) => {
    if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
      return;
    }
    onClose();
  };

  // Download receipt with TransferFundsDialog style
  const handleDownloadReceipt = () => {
    if (!receiptData) return;
    // Create canvas
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 800;
    const ctx = canvas.getContext("2d");

    // ...existing code for drawing receipt...
    // Background
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, "#2d2d2d");
    gradient.addColorStop(1, "#1e1e1e");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Border
    ctx.strokeStyle = "#4CAF50";
    ctx.lineWidth = 3;
    ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

    // Header
    ctx.fillStyle = "#4CAF50";
    ctx.font = "bold 32px Arial";
    ctx.textAlign = "center";
    ctx.fillText("🧾 PAYBACK RECEIPT", canvas.width / 2, 80);

    // Divider
    ctx.strokeStyle = "#4CAF50";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(50, 110);
    ctx.lineTo(canvas.width - 50, 110);
    ctx.stroke();

    // Reference Number
    if (reference) {
      ctx.fillStyle = "#9E9E9E";
      ctx.font = "14px Arial";
      ctx.fillText("Reference Number", canvas.width / 2, 145);
      ctx.fillStyle = "#4FC3F7";
      ctx.font = "bold 18px monospace";
      ctx.fillText(reference, canvas.width / 2, 170);
    }

    // Date & Time
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "16px Arial";
    ctx.textAlign = "left";
    ctx.fillText("Date & Time:", 60, 220);
    ctx.textAlign = "right";
    ctx.fillText(date, canvas.width - 60, 220);

    // Divider
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(50, 240);
    ctx.lineTo(canvas.width - 50, 240);
    ctx.stroke();

    // Amount Details
    ctx.fillStyle = "#9E9E9E";
    ctx.textAlign = "left";
    ctx.font = "16px Arial";
    ctx.fillText("Amount:", 60, 280);
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "right";
    ctx.fillText(`₱${Number(amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`, canvas.width - 60, 280);

    // Created At
    if (createdAt) {
      ctx.fillStyle = "#9E9E9E";
      ctx.textAlign = "left";
      ctx.font = "16px Arial";
      ctx.fillText("Created At:", 60, 320);
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "right";
      ctx.fillText(createdAt, canvas.width - 60, 320);
    }

    // Divider
    ctx.strokeStyle = "#4CAF50";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(50, 350);
    ctx.lineTo(canvas.width - 50, 350);
    ctx.stroke();

    // Status Box
    ctx.fillStyle = "rgba(76, 175, 80, 0.2)";
    ctx.fillRect(60, 380, canvas.width - 120, 50);
    ctx.strokeStyle = "#4CAF50";
    ctx.lineWidth = 2;
    ctx.strokeRect(60, 380, canvas.width - 120, 50);
    ctx.fillStyle = "#4CAF50";
    ctx.font = "bold 18px Arial";
    ctx.textAlign = "center";
    ctx.fillText("✓ Status: Approved", canvas.width / 2, 412);

    // Footer
    ctx.fillStyle = "#9E9E9E";
    ctx.font = "12px Arial";
    ctx.fillText("Keep this receipt for your records", canvas.width / 2, 470);
    ctx.fillText("This is an official payback receipt", canvas.width / 2, 490);

    // Timestamp
    ctx.font = "10px Arial";
    ctx.fillText(`Generated on ${new Date().toLocaleString("en-PH")}`, canvas.width / 2, 520);

    // Convert canvas to blob and download
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Payback_Receipt_${reference || ""}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      // Close dialog after download
      onClose();
    });
  };
  return (
    <Dialog
      open={open}
      onClose={handleDialogClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          background: "linear-gradient(135deg, rgba(40,40,40,0.98) 0%, rgba(30,30,30,0.98) 100%)",
          color: "#fff",
          p: 2,
          boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
          border: "1px solid rgba(76, 175, 80, 0.3)",
        },
      }}
    >
      <DialogTitle sx={{ textAlign: "center", pb: 1 }}>
        <Box sx={{ fontSize: 60, color: "#4CAF50", mb: 1, textAlign: "center" }}>🧾</Box>
        <Typography variant="h5" sx={{ fontWeight: 700, color: "#4CAF50" }}>
          Payback Entry Receipt
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Box
          sx={{
            background: "rgba(76, 175, 80, 0.1)",
            borderRadius: 2,
            p: 3,
            border: "1px dashed rgba(76, 175, 80, 0.3)",
          }}
        >
          {/* Reference Number */}
          {reference && (
            <Box sx={{ mb: 3, textAlign: "center" }}>
              <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }}>
                Reference Number
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mt: 0.5 }}>
                <Typography
                  variant="h6"
                  sx={{
                    fontFamily: "monospace",
                    color: "#4FC3F7",
                    fontWeight: 700,
                    letterSpacing: 1,
                    maxWidth: 260,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    mx: 0,
                    display: 'block',
                  }}
                  title={reference}
                >
                  {reference}
                </Typography>
                <Tooltip title="Copy Reference" arrow>
                  <IconButton
                    size="small"
                    sx={{ color: '#4FC3F7', ml: 0.5, p: 0.5 }}
                    onClick={() => {
                      navigator.clipboard.writeText(reference);
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          )}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: "flex", mb: 1 }}>
              <Typography sx={{ color: "rgba(255,255,255,0.7)" }}>Date & Time:</Typography>
              <Typography sx={{ fontWeight: 600, flex: 1, textAlign: 'right' }}>{date}</Typography>
            </Box>
          </Box>
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
              <Typography sx={{ color: "rgba(255,255,255,0.7)" }}>Amount:</Typography>
              <Typography sx={{ fontWeight: 600 }}>
                ₱{Number(amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
              </Typography>
            </Box>
            {createdAt && (
              <Box sx={{ display: "flex", mb: 1 }}>
                <Typography sx={{ color: "rgba(255,255,255,0.7)" }}>Created At:</Typography>
                <Typography sx={{ fontWeight: 600, flex: 1, textAlign: 'right' }}>{createdAt}</Typography>
              </Box>
            )}
          </Box>
          <Box
            sx={{
              mt: 2,
              p: 1.5,
              background: "rgba(76, 175, 80, 0.15)",
              borderRadius: 1,
              textAlign: "center",
            }}
          >
            <Typography variant="body2" sx={{ color: "#4CAF50", fontWeight: 600 }}>
              ✓ Status: Approved
            </Typography>
          </Box>
        </Box>
        <Typography
          variant="caption"
          sx={{
            display: "block",
            textAlign: "center",
            color: "rgba(255,255,255,0.5)",
            mt: 2,
          }}
        >
          Keep this reference number for your records
        </Typography>
      </DialogContent>
      <DialogActions sx={{ justifyContent: "center", gap: 2, pb: 2 }}>
        <Button
          onClick={handleDownloadReceipt}
          variant="outlined"
          sx={{
            color: "#4FC3F7",
            borderColor: "#4FC3F7",
            "&:hover": {
              borderColor: "#29B6F6",
              background: "rgba(79, 195, 247, 0.1)",
            },
          }}
        >
          Download Receipt
        </Button>
        <Button
          onClick={onClose}
          variant="contained"
          sx={{
            bgcolor: "#4CAF50",
            color: "#fff",
            fontWeight: 600,
            "&:hover": { bgcolor: "#45A049" },
          }}
        >
          Done
        </Button>
      </DialogActions>
      </Dialog>
    );
};

export default PaybackReceiptDialog;
