import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  Card,
  Grid,
  Chip,
} from "@mui/material";

/**
 * Capital Share Profit Breakdown Dialog
 * Shows detailed breakdown of unclaimed vs claimed profits
 */
const CapitalShareProfitBreakdown = ({
  open,
  onClose,
  transactionHistory = [],
}) => {
  // Calculate breakdown
  const breakdown = transactionHistory.reduce(
    (acc, entry) => {
      const createdAt = entry.createdAt || new Date();
      const expireDate = new Date(createdAt);
      expireDate.setFullYear(expireDate.getFullYear() + 1);
      const isActive = new Date() <= expireDate;

      if (!isActive) {
        return acc;
      }

      const profit = Number(entry.profit || 0);
      const status = entry.profitStatus || "Pending";
      const amount = Number(entry.amount || 0);

      if (status === "Claimed") {
        acc.claimed.total += profit;
        acc.claimed.entries.push({
          id: entry.id,
          capital: amount,
          profit,
          claimedAt: entry.profitClaimedAt,
        });
      } else {
        acc.unclaimed.total += profit;
        acc.unclaimed.entries.push({
          id: entry.id,
          capital: amount,
          profit,
        });
      }

      acc.allEntries.total += profit;
      return acc;
    },
    {
      claimed: { total: 0, entries: [] },
      unclaimed: { total: 0, entries: [] },
      allEntries: { total: 0 },
    }
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          background:
            "linear-gradient(150deg, rgba(8,26,62,0.96) 0%, rgba(13,44,102,0.92) 100%)",
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
        Capital Share Profit Breakdown
      </DialogTitle>
      <DialogContent sx={{ bgcolor: "transparent", mt: 3, mb: 2 }}>
        {/* Summary Card */}
        <Card
          sx={{
            mb: 3,
            p: 2,
            background:
              "linear-gradient(135deg, rgba(15,78,168,0.3) 0%, rgba(10,31,68,0.4) 100%)",
            border: "1px solid rgba(79, 195, 247, 0.3)",
            borderRadius: 2,
          }}
        >
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography
                variant="caption"
                sx={{
                  color: "#90CAF9",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  fontSize: 10,
                  letterSpacing: 0.5,
                }}
              >
                🟡 Unclaimed Profit
              </Typography>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 800,
                  color: "#FFB74D",
                  mt: 0.5,
                  fontSize: "1.5rem",
                }}
              >
                ₱{Number(breakdown.unclaimed.total).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography
                variant="caption"
                sx={{
                  color: "#90CAF9",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  fontSize: 10,
                  letterSpacing: 0.5,
                }}
              >
                ✅ Already Claimed
              </Typography>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 800,
                  color: "#81C784",
                  mt: 0.5,
                  fontSize: "1.5rem",
                }}
              >
                ₱{Number(breakdown.claimed.total).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Typography>
            </Grid>
          </Grid>
        </Card>

        {/* Unclaimed Profits */}
        {breakdown.unclaimed.entries.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography
              variant="subtitle2"
              sx={{
                color: "#FFB74D",
                fontWeight: 700,
                mb: 1.5,
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              <span>🟡 Unclaimed Profits ({breakdown.unclaimed.entries.length})</span>
              <Chip
                label={`Total: ₱${breakdown.unclaimed.total.toLocaleString()}`}
                size="small"
                sx={{
                  bgcolor: "rgba(255, 152, 0, 0.2)",
                  color: "#FFB74D",
                  fontWeight: 700,
                  height: 24,
                }}
              />
            </Typography>

            {breakdown.unclaimed.entries.map((entry, idx) => (
              <Card
                key={entry.id || idx}
                sx={{
                  mb: 1,
                  p: 1.5,
                  bgcolor: "rgba(33, 47, 61, 0.6)",
                  border: "1px solid rgba(255, 152, 0, 0.2)",
                  borderRadius: 1.5,
                }}
              >
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Box>
                    <Typography
                      variant="caption"
                      sx={{
                        color: "#90CAF9",
                        fontWeight: 700,
                        fontSize: 10,
                        textTransform: "uppercase",
                      }}
                    >
                      Capital
                    </Typography>
                    <Typography sx={{ color: "#fff", fontWeight: 600 }}>
                      ₱{entry.capital.toLocaleString()}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: "right" }}>
                    <Typography
                      variant="caption"
                      sx={{
                        color: "#90CAF9",
                        fontWeight: 700,
                        fontSize: 10,
                        textTransform: "uppercase",
                      }}
                    >
                      Profit
                    </Typography>
                    <Typography
                      sx={{
                        color: "#FFB74D",
                        fontWeight: 700,
                        fontSize: "1.1rem",
                      }}
                    >
                      ₱{entry.profit.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </Typography>
                  </Box>
                </Box>
              </Card>
            ))}
          </Box>
        )}

        {/* Claimed Profits */}
        {breakdown.claimed.entries.length > 0 && (
          <Box>
            <Typography
              variant="subtitle2"
              sx={{
                color: "#81C784",
                fontWeight: 700,
                mb: 1.5,
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              <span>✅ Already Claimed ({breakdown.claimed.entries.length})</span>
              <Chip
                label={`Total: ₱${breakdown.claimed.total.toLocaleString()}`}
                size="small"
                sx={{
                  bgcolor: "rgba(76, 175, 80, 0.2)",
                  color: "#81C784",
                  fontWeight: 700,
                  height: 24,
                }}
              />
            </Typography>

            {breakdown.claimed.entries.map((entry, idx) => (
              <Card
                key={entry.id || idx}
                sx={{
                  mb: 1,
                  p: 1.5,
                  bgcolor: "rgba(33, 47, 61, 0.4)",
                  border: "1px solid rgba(76, 175, 80, 0.2)",
                  borderRadius: 1.5,
                  opacity: 0.8,
                }}
              >
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Box>
                    <Typography
                      variant="caption"
                      sx={{
                        color: "#90CAF9",
                        fontWeight: 700,
                        fontSize: 10,
                        textTransform: "uppercase",
                      }}
                    >
                      Capital
                    </Typography>
                    <Typography sx={{ color: "#fff", fontWeight: 600 }}>
                      ₱{entry.capital.toLocaleString()}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: "right" }}>
                    <Typography
                      variant="caption"
                      sx={{
                        color: "#90CAF9",
                        fontWeight: 700,
                        fontSize: 10,
                        textTransform: "uppercase",
                      }}
                    >
                      Claimed on
                    </Typography>
                    <Typography
                      sx={{
                        color: "#81C784",
                        fontWeight: 600,
                        fontSize: "0.9rem",
                      }}
                    >
                      {entry.claimedAt
                        ? new Date(
                            entry.claimedAt.seconds
                              ? entry.claimedAt.seconds * 1000
                              : entry.claimedAt
                          ).toLocaleDateString()
                        : "N/A"}
                    </Typography>
                  </Box>
                </Box>
              </Card>
            ))}
          </Box>
        )}

        {breakdown.allEntries.total === 0 && (
          <Typography
            sx={{
              color: "rgba(217,233,255,0.5)",
              textAlign: "center",
              py: 3,
            }}
          >
            No profit history yet
          </Typography>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CapitalShareProfitBreakdown;
