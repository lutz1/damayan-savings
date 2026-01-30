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

const EntryDetailsDialog = ({
  open,
  onClose,
  selectedEntry,
}) => {
  return (
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
        Capital Share Entry Details
      </DialogTitle>
      <DialogContent sx={{ mt: 2, bgcolor: "transparent" }}>
        {selectedEntry && (
          <Box>
            <Typography
              variant="subtitle2"
              sx={{
                color: "#90CAF9",
                fontWeight: 700,
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                mb: 0.5,
              }}
            >
              Total Amount
            </Typography>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 800,
                color: "#4FC3F7",
                mb: 2,
                textShadow: "1px 1px 4px #000",
              }}
            >
              ₱{Number(selectedEntry.amount || 0).toLocaleString()}
            </Typography>

            <Typography
              variant="subtitle2"
              sx={{
                color: "#90CAF9",
                fontWeight: 700,
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                mt: 2,
                mb: 0.5,
              }}
            >
              Entry Date
            </Typography>
            <Typography variant="body2" sx={{ color: "#b0bec5", mb: 2 }}>
              {selectedEntry.date instanceof Date
                ? selectedEntry.date.toDateString()
                : selectedEntry.date?.toDate?.().toDateString() || "N/A"}
            </Typography>

            {selectedEntry.lockInPortion > 0 && (
              <>
                <Typography
                  variant="subtitle2"
                  sx={{
                    color: "#90CAF9",
                    fontWeight: 700,
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    mt: 2,
                    mb: 0.5,
                  }}
                >
                  🔒 Lock-in Portion
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ mb: 2, color: "#FF9800", fontWeight: 700 }}
                >
                  ₱{Number(selectedEntry.lockInPortion || 0).toLocaleString()} (Locked
                  for 1 year)
                </Typography>
              </>
            )}

            {selectedEntry.transferablePortion > 0 && (
              <>
                <Typography
                  variant="subtitle2"
                  sx={{
                    color: "#90CAF9",
                    fontWeight: 700,
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    mt: 2,
                    mb: 0.5,
                  }}
                >
                  💼 Transferable Portion
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ mb: 2, color: "#4CAF50", fontWeight: 700 }}
                >
                  ₱{Number(selectedEntry.transferablePortion || 0).toLocaleString()} (After
                  1 month)
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: "#FFB74D",
                    fontStyle: "italic",
                    display: "block",
                    mb: 1.5,
                    lineHeight: 1.4,
                  }}
                >
                  ⚠️ <strong>Important:</strong> Transfer only after profit is
                  credited to avoid forfeiting upcoming profit.
                </Typography>
              </>
            )}

            {selectedEntry.transferredAmount && selectedEntry.transferredAmount > 0 && (
              <>
                <Typography
                  variant="subtitle2"
                  sx={{
                    color: "#90CAF9",
                    fontWeight: 700,
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    mt: 2,
                    mb: 0.5,
                  }}
                >
                  ✅ Already Transferred
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ mb: 2, color: "#4CAF50", fontWeight: 700 }}
                >
                  ₱{Number(selectedEntry.transferredAmount || 0).toLocaleString()}
                </Typography>
              </>
            )}

            <Typography
              variant="subtitle2"
              sx={{
                color: "#90CAF9",
                fontWeight: 700,
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                mt: 2.5,
                mb: 0.5,
              }}
            >
              📈 Monthly Profit
            </Typography>
            <Typography variant="body2" sx={{ color: "#b0bec5", mb: 0.5 }}>
              Rate: <strong style={{ color: "#4CAF50" }}>5%</strong> monthly
            </Typography>
            {selectedEntry.transferredAmount && selectedEntry.transferredAmount > 0 ? (
              <Typography variant="body2" sx={{ color: "#FFB74D", mb: 1 }}>
                Accrues on: <strong style={{ color: "#4CAF50" }}>Remaining lock-in</strong> (₱
                {Number(selectedEntry.lockInPortion || 0).toLocaleString()})
              </Typography>
            ) : (
              <Typography variant="body2" sx={{ color: "#b0bec5", mb: 1 }}>
                Accrues: <strong style={{ color: "#4CAF50" }}>Every month</strong>{" "}
                automatically
              </Typography>
            )}

            <Typography
              variant="subtitle2"
              sx={{
                color: "#90CAF9",
                fontWeight: 700,
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                mt: 2,
                mb: 0.5,
              }}
            >
              Current Profit
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
              ₱{Number(selectedEntry.profit || 0).toLocaleString()}
            </Typography>
            <Box
              sx={{
                px: 1.5,
                py: 0.75,
                borderRadius: 1.5,
                bgcolor:
                  selectedEntry.profitStatus === "Claimed"
                    ? "rgba(76, 175, 80, 0.2)"
                    : "rgba(255, 152, 0, 0.2)",
                border: `1.5px solid ${
                  selectedEntry.profitStatus === "Claimed"
                    ? "#4CAF50"
                    : "#FF9800"
                }`,
                color:
                  selectedEntry.profitStatus === "Claimed"
                    ? "#81C784"
                    : "#FFB74D",
                fontWeight: 700,
                fontSize: 12,
                display: "inline-block",
                mb: 1,
              }}
            >
              {selectedEntry.profitStatus === "Claimed"
                ? "✅ Claimed"
                : "⏳ " + (selectedEntry.profitStatus || "Pending")}
            </Box>

            <Typography
              variant="subtitle2"
              sx={{
                color: "#90CAF9",
                fontWeight: 700,
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: 0.5,
                mt: 2,
                mb: 0.5,
              }}
            >
              Next Profit Date
            </Typography>
            <Typography variant="body2" sx={{ color: "#b0bec5", mb: 1 }}>
              {selectedEntry.nextProfitDate instanceof Date
                ? selectedEntry.nextProfitDate.toDateString()
                : selectedEntry.nextProfitDate?.toDate?.().toDateString() ||
                  "N/A"}
            </Typography>
            {selectedEntry.transferredAmount && selectedEntry.transferredAmount > 0 ? (
              <Box
                sx={{
                  px: 1.5,
                  py: 0.75,
                  borderRadius: 1.5,
                  bgcolor: "rgba(76, 175, 80, 0.15)",
                  border: "1.5px solid rgba(76, 175, 80, 0.3)",
                  color: "#81C784",
                  fontWeight: 600,
                  fontSize: 11,
                  lineHeight: 1.4,
                }}
              >
                ✓ Recalculated on next profit date:
                <br />
                5% × ₱{Number(selectedEntry.lockInPortion || 0).toLocaleString()} (lock-in) = ₱
                {Number((selectedEntry.lockInPortion || 0) * 0.05).toLocaleString("en-US", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
                /month
              </Box>
            ) : null}
          </Box>
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

export default EntryDetailsDialog;
