import React from "react";
import { Card, Box, Typography, Button } from "@mui/material";

const CapitalShareTransactions = ({
  transactionHistory,
  onViewDetails,
  onTransferCapital,
}) => {
  return (
    <Card
      sx={{
        background:
          "linear-gradient(120deg, rgba(231,237,241,0.27), rgba(33,150,243,0.08))",
        borderRadius: 3,
        p: 3,
        minHeight: 320,
        width: "100%",
        maxWidth: 900,
        boxShadow: "0 4px 24px 0 rgba(33,150,243,0.10)",
        mb: 4,
        height: { xs: "60vh", sm: "65vh", md: "70vh", lg: "75vh" },
        display: "flex",
        flexDirection: "column",
        mx: "auto",
      }}
    >
      <Typography
        variant="h6"
        sx={{ fontWeight: 700, color: "#1976d2", mb: 2, letterSpacing: 0.5 }}
      >
        Capital Share Transactions
      </Typography>
      {transactionHistory.length > 0 ? (
        <Box sx={{ width: "100%", flex: 1, overflowY: "auto", height: "100%" }}>
          {transactionHistory.map((t, idx) => {
            const now = new Date();
            const transferableAfterDate =
              t.transferableAfterDate instanceof Date
                ? t.transferableAfterDate
                : t.transferableAfterDate?.toDate?.();

            // Determine lock-in status
            const isLocked = t.lockInPortion > 0;
            const canTransferByTime =
              transferableAfterDate && now >= transferableAfterDate;
            const transferStatus = isLocked
              ? "🔒 Locked"
              : canTransferByTime
              ? "✅ Available"
              : "⏳ Locked (1 month)";

            const borderColor = isLocked
              ? "#ff9800"
              : canTransferByTime
              ? "#4caf50"
              : "#1976d2";
            const iconBg = isLocked
              ? "#fff3e0"
              : canTransferByTime
              ? "#e8f5e9"
              : "#e3f2fd";
            const iconColor = isLocked
              ? "#f57c00"
              : canTransferByTime
              ? "#388e3c"
              : "#1976d2";

            return (
              <Card
                key={idx}
                sx={{
                  mb: 1.5,
                  p: 1.5,
                  borderRadius: 2,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                  bgcolor: "rgba(33, 47, 61, 0.6)",
                  border: `1.5px solid ${borderColor}`,
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 1.5,
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    minW: 50,
                  }}
                >
                  <Box
                    sx={{
                      fontSize: 24,
                      bgcolor: iconBg,
                      color: iconColor,
                      borderRadius: "50%",
                      width: 44,
                      height: 44,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 1px 4px #0002",
                    }}
                  >
                    {t.profitEnabled === false ? "🛑" : "💰"}
                  </Box>
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, mb: 0.5 }}>
                    <Typography
                      variant="h6"
                      sx={{ fontWeight: 800, color: "#1976d2", fontSize: 16 }}
                    >
                      ₱{t.amount.toLocaleString()}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: iconColor, fontWeight: 700, fontSize: 11 }}
                    >
                      {t.profitEnabled === false
                        ? "Stopped"
                        : transferStatus}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 0.5 }}>
                    {t.lockInPortion > 0 && (
                      <Typography
                        variant="caption"
                        sx={{
                          color: "#ff9800",
                          fontWeight: 600,
                          fontSize: 11,
                        }}
                      >
                        🔒 ₱{t.lockInPortion.toLocaleString()}
                      </Typography>
                    )}
                    {t.transferablePortion > 0 && (
                      <Typography
                        variant="caption"
                        sx={{
                          color: "#4caf50",
                          fontWeight: 600,
                          fontSize: 11,
                        }}
                      >
                        💼 ₱{t.transferablePortion.toLocaleString()}
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ display: "flex", gap: 0.8, flexWrap: "wrap", mt: 0.5 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      sx={{
                        fontWeight: 600,
                        borderRadius: 1.5,
                        textTransform: "none",
                        px: 1.5,
                        py: 0.5,
                        fontSize: 11,
                        minWidth: "auto",
                      }}
                      onClick={() => onViewDetails(t)}
                    >
                      View Details
                    </Button>
                    {t.transferablePortion > 0 && (
                      <Button
                        variant="contained"
                        size="small"
                        sx={{
                          fontWeight: 600,
                          borderRadius: 1.5,
                          textTransform: "none",
                          px: 1.5,
                          py: 0.5,
                          fontSize: 11,
                          bgcolor: "#4caf50",
                          minWidth: "auto",
                          "&:hover": { bgcolor: "#45a049" },
                        }}
                        disabled={
                          !canTransferByTime ||
                          (t.transferredAmount &&
                            t.transferredAmount >= t.transferablePortion)
                        }
                        onClick={() => onTransferCapital(t)}
                      >
                        Transfer
                      </Button>
                    )}
                  </Box>
                </Box>
              </Card>
            );
          })}
        </Box>
      ) : (
        <Box
          display="flex"
          alignItems="center"
          justifyContent="center"
          height="80px"
        >
          <Typography variant="h6" color="text.secondary" sx={{ fontSize: 16 }}>
            No capital share transactions found.
          </Typography>
        </Box>
      )}
    </Card>
  );
};

export default CapitalShareTransactions;
