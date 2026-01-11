import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
} from "@mui/material";

const ProfitHistoryDialog = ({
  open,
  onClose,
  transactionHistory,
  onTransferProfit,
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
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
        Monthly Profit History
      </DialogTitle>
      <DialogContent sx={{ bgcolor: "transparent", mt: 2 }}>
        {transactionHistory.length > 0 ? (
          transactionHistory.map((t) => (
            <Box
              key={t.id}
              sx={{
                mb: 2,
                p: 1.5,
                borderRadius: 2,
                bgcolor: "rgba(33, 47, 61, 0.6)",
                border: "1px solid rgba(79, 195, 247, 0.15)",
                boxShadow: "0px 2px 6px rgba(0,0,0,0.3)",
              }}
            >
              <Typography
                variant="subtitle2"
                sx={{
                  color: "#90CAF9",
                  fontWeight: 700,
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  mb: 0.5,
                }}
              >
                Profit Amount
              </Typography>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 800,
                  color: "#4CAF50",
                  mb: 1,
                  textShadow: "1px 1px 4px #000",
                }}
              >
                ₱{Number(t.profit || 0).toLocaleString()}
              </Typography>

              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 1 }}>
                <Box
                  sx={{
                    px: 1.5,
                    py: 0.5,
                    borderRadius: 1.5,
                    bgcolor:
                      t.profitStatus === "Claimed"
                        ? "rgba(76, 175, 80, 0.2)"
                        : "rgba(255, 152, 0, 0.2)",
                    border: `1.5px solid ${
                      t.profitStatus === "Claimed" ? "#4CAF50" : "#FF9800"
                    }`,
                    color:
                      t.profitStatus === "Claimed" ? "#81C784" : "#FFB74D",
                    fontWeight: 700,
                    fontSize: 11,
                  }}
                >
                  {t.profitStatus === "Claimed"
                    ? "✅ Claimed"
                    : "⏳ " + (t.profitStatus || "Pending")}
                </Box>

                {t.nextProfitDate && (
                  <Box
                    sx={{
                      px: 1.5,
                      py: 0.5,
                      borderRadius: 1.5,
                      bgcolor: "rgba(76, 175, 80, 0.15)",
                      border: "1.5px solid #4CAF50",
                      color: "#81C784",
                      fontWeight: 700,
                      fontSize: 11,
                    }}
                  >
                    📅 {t.nextProfitDate.toDateString()}
                  </Box>
                )}
              </Box>

              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  mt: 1.5,
                }}
              >
                <Typography
                  variant="body2"
                  sx={{ color: "#b0bec5", fontWeight: 600 }}
                >
                  Capital:{" "}
                  <strong style={{ color: "#4FC3F7" }}>
                    ₱{Number(t.amount || 0).toLocaleString()}
                  </strong>
                </Typography>
                <Button
                  variant="contained"
                  size="small"
                  disabled={
                    !t.profit ||
                    t.profit <= 0 ||
                    t.profitStatus === "Claimed"
                  }
                  sx={{
                    fontWeight: 600,
                    borderRadius: 1.5,
                    textTransform: "none",
                    fontSize: 12,
                    bgcolor: "#4CAF50",
                    "&:hover": { bgcolor: "#45a049" },
                  }}
                  onClick={() => onTransferProfit(t)}
                >
                  Transfer
                </Button>
              </Box>
            </Box>
          ))
        ) : (
          <Typography sx={{ textAlign: "center", py: 3, color: "#b0bec5" }}>
            No profit history yet.
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ borderTop: "1px solid rgba(79, 195, 247, 0.15)", pt: 2 }}>
        <Button
          onClick={onClose}
          variant="contained"
          sx={{
            fontWeight: 700,
            borderRadius: 1.5,
            textTransform: "none",
            bgcolor: "#1976d2",
          }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ProfitHistoryDialog;
