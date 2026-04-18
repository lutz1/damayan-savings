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
  transferLoading = false,
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
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
                ₱{Number(t.profitStatus === "Claimed" ? (t.profitClaimedAmount || t.profit || 0) : (t.profit || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

                {t.profitClaimedAt && (
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
                    {`📅 Credited: ${
                      t.profitClaimedAt instanceof Date
                        ? t.profitClaimedAt.toDateString()
                        : new Date(t.profitClaimedAt.seconds ? t.profitClaimedAt.seconds * 1000 : t.profitClaimedAt).toDateString()
                    }`}
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
                <Box>
                  <Typography
                    variant="body2"
                    sx={{ color: "rgba(217,233,255,0.74)", fontWeight: 600, mb: 0.5 }}
                  >
                    Entry Date: <strong style={{ color: "#d9e9ff" }}>{t.date instanceof Date ? t.date.toDateString() : t.date?.toDate?.().toDateString?.() || "N/A"}</strong>
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ color: "rgba(217,233,255,0.74)", fontWeight: 600 }}
                  >
                    Capital:{" "}
                    <strong style={{ color: "#d9e9ff" }}>
                      ₱{Number(t.amount || 0).toLocaleString()}
                    </strong>
                  </Typography>
                </Box>
                {t.profitStatus !== "Claimed" && (
                  <Button
                    variant="contained"
                    size="small"
                    disabled={
                      transferLoading ||
                      !t.profit ||
                      t.profit <= 0
                    }
                    sx={{
                      fontWeight: 600,
                      borderRadius: 1.5,
                      textTransform: "none",
                      fontSize: 12,
                      background: "linear-gradient(135deg, #2f7de1, #0f4ea8)",
                      "&:hover": { background: "linear-gradient(135deg, #3b8cf2, #1a5fc5)" },
                      minWidth: 80,
                    }}
                    onClick={() => onTransferProfit(t)}
                  >
                    {transferLoading ? "⏳ Claiming..." : "Claim"}
                  </Button>
                )}
              </Box>
            </Box>
          ))
        ) : (
          <Typography sx={{ textAlign: "center", py: 3, color: "#b0bec5" }}>
            No profit history yet.
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ borderTop: "1px solid rgba(217,233,255,0.15)", pt: 2 }}>
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
