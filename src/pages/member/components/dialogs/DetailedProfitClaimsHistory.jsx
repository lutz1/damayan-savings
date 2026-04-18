import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  Card,
  Grid,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

/**
 * Detailed Profit Claims History
 * Shows each capital share entry with all associated profit claims,
 * calculations, and verification of claim frequency
 */
const DetailedProfitClaimsHistory = ({
  open,
  onClose,
  transactionHistory = [],
  onTransferProfit,
  transferLoading = false,
  claimingEntryId = null,
}) => {
  const [expandedEntry, setExpandedEntry] = useState(null);

  // Group claims by source entry
  const entriesWithClaims = transactionHistory.map((entry) => {
    const createdAt = entry.createdAt ? new Date(entry.createdAt) : new Date();
    const expireDate = new Date(createdAt);
    expireDate.setFullYear(expireDate.getFullYear() + 1);
    const isActive = new Date() <= expireDate;

    // Calculate months elapsed since creation
    const now = new Date();
    const monthsElapsed = Math.floor(
      (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
    );

    // Calculate expected profit per month (use full capital amount, not lock-in)
    const profitBase = entry.amount || 0;
    const monthlyProfitRate = profitBase * 0.05;

    return {
      ...entry,
      createdAt,
      expireDate,
      isActive,
      monthsElapsed,
      monthlyProfitRate,
      profitBase,
    };
  });

  const formatDate = (date) => {
    if (!date) return "N/A";
    
    // Handle Firestore Timestamp object
    if (date && typeof date.toDate === "function") {
      return date.toDate().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
    
    // Handle Date object
    if (typeof date === "object" && date.toLocaleDateString) {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
    
    // Handle string or number
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return "N/A";
    
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const calculateMonthsSince = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const months =
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth());
    return Math.max(0, months);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="lg"
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
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        <span>📊</span>
        Detailed Profit Claims History
      </DialogTitle>
      <DialogContent sx={{ bgcolor: "transparent", mt: 2, mb: 2 }}>
        {entriesWithClaims.length > 0 ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {entriesWithClaims.map((entry, index) => {
              const isExpanded = expandedEntry === entry.id;

              return (
                <Accordion
                  key={entry.id || index}
                  expanded={isExpanded}
                  onChange={() =>
                    setExpandedEntry(isExpanded ? null : entry.id)
                  }
                  sx={{
                    bgcolor: "rgba(33, 47, 61, 0.6)",
                    border: "1px solid rgba(79, 195, 247, 0.2)",
                    borderRadius: 2,
                    "&.Mui-expanded": {
                      margin: 0,
                    },
                  }}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon sx={{ color: "#90CAF9" }} />}
                    sx={{
                      backgroundColor: "rgba(15,78,168,0.2)",
                      "&:hover": {
                        backgroundColor: "rgba(15,78,168,0.3)",
                      },
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        width: "100%",
                        pr: 2,
                      }}
                    >
                      <Box>
                        <Typography
                          sx={{
                            color: "#90CAF9",
                            fontWeight: 700,
                            fontSize: 12,
                            textTransform: "uppercase",
                            letterSpacing: 0.5,
                            mb: 0.5,
                          }}
                        >
                          Entry Date: {formatDate(entry.createdAt)}
                        </Typography>
                        <Typography
                          sx={{
                            color: "#FFB74D",
                            fontWeight: 600,
                            fontSize: 11,
                            textTransform: "uppercase",
                            letterSpacing: 0.3,
                            mb: 0.5,
                          }}
                        >
                          Expires: {formatDate(entry.expireDate)}
                        </Typography>
                        <Typography
                          sx={{
                            color: "#fff",
                            fontWeight: 600,
                            fontSize: 14,
                          }}
                        >
                          ₱{Number(entry.amount || 0).toLocaleString()} Capital
                          {entry.lockInPortion && (
                            <span style={{ color: "#FFB74D", marginLeft: 8 }}>
                              (₱
                              {Number(entry.lockInPortion).toLocaleString()} locked-in)
                            </span>
                          )}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: "right" }}>
                        <Chip
                          label={`${entry.monthsElapsed} months elapsed`}
                          size="small"
                          sx={{
                            bgcolor: "rgba(79, 195, 247, 0.2)",
                            color: "#90CAF9",
                            fontWeight: 700,
                            mb: 1,
                          }}
                        />
                        <Typography
                          sx={{
                            color: entry.profitStatus === "Claimed" ? "#81C784" : "#FFB74D",
                            fontWeight: 700,
                            fontSize: 13,
                          }}
                        >
                          {entry.profitStatus === "Claimed"
                            ? "✅ All Claimed"
                            : "⏳ Accruing"}
                        </Typography>
                      </Box>
                    </Box>
                  </AccordionSummary>

                  <AccordionDetails
                    sx={{
                      bgcolor: "rgba(10, 31, 68, 0.4)",
                      pt: 2,
                    }}
                  >
                    {/* Summary Card */}
                    <Card
                      sx={{
                        mb: 2,
                        p: 2,
                        background:
                          "linear-gradient(135deg, rgba(15,78,168,0.25) 0%, rgba(10,31,68,0.35) 100%)",
                        border: "1px solid rgba(79, 195, 247, 0.25)",
                        borderRadius: 1.5,
                      }}
                    >
                      <Grid container spacing={2}>
                        <Grid item xs={6} sm={3}>
                          <Typography
                            variant="caption"
                            sx={{
                              color: "#90CAF9",
                              fontWeight: 700,
                              fontSize: 10,
                              textTransform: "uppercase",
                            }}
                          >
                            Monthly Rate (5%)
                          </Typography>
                          <Typography
                            sx={{
                              color: "#90CAF9",
                              fontWeight: 700,
                              fontSize: "1.1rem",
                              mt: 0.5,
                            }}
                          >
                            ₱
                            {Number(entry.monthlyProfitRate).toLocaleString(
                              undefined,
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }
                            )}
                          </Typography>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Typography
                            variant="caption"
                            sx={{
                              color: "#FFB74D",
                              fontWeight: 700,
                              fontSize: 10,
                              textTransform: "uppercase",
                            }}
                          >
                            Months Elapsed
                          </Typography>
                          <Typography
                            sx={{
                              color: "#FFB74D",
                              fontWeight: 700,
                              fontSize: "1.1rem",
                              mt: 0.5,
                            }}
                          >
                            {entry.monthsElapsed}
                          </Typography>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Typography
                            variant="caption"
                            sx={{
                              color: "#81C784",
                              fontWeight: 700,
                              fontSize: 10,
                              textTransform: "uppercase",
                            }}
                          >
                            Expected Total
                          </Typography>
                          <Typography
                            sx={{
                              color: "#81C784",
                              fontWeight: 700,
                              fontSize: "1.1rem",
                              mt: 0.5,
                            }}
                          >
                            ₱
                            {Number(
                              entry.monthlyProfitRate * entry.monthsElapsed
                            ).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </Typography>
                        </Grid>
                        <Grid item xs={6} sm={3}>
                          <Typography
                            variant="caption"
                            sx={{
                              color: entry.profitStatus === "Claimed" ? "#4CAF50" : "#FF9800",
                              fontWeight: 700,
                              fontSize: 10,
                              textTransform: "uppercase",
                            }}
                          >
                            Status
                          </Typography>
                          <Typography
                            sx={{
                              color: entry.profitStatus === "Claimed" ? "#4CAF50" : "#FF9800",
                              fontWeight: 700,
                              fontSize: "1.1rem",
                              mt: 0.5,
                            }}
                          >
                            {entry.profitStatus === "Claimed" ? "✅ Claimed" : "⏳ Pending"}
                          </Typography>
                        </Grid>
                      </Grid>
                    </Card>

                    {/* Claim Calculation Breakdown */}
                    <Box sx={{ mb: 2 }}>
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
                        <span>📋</span>
                        Calculation Formula
                      </Typography>
                      <Card
                        sx={{
                          p: 1.5,
                          bgcolor: "rgba(33, 47, 61, 0.8)",
                          border: "1px solid rgba(255, 183, 77, 0.2)",
                          borderRadius: 1,
                        }}
                      >
                        <Typography
                          sx={{
                            color: "#fff",
                            fontFamily: "monospace",
                            fontSize: 12,
                            mb: 1,
                            lineHeight: 1.6,
                          }}
                        >
                          Profit Base: ₱{Number(entry.profitBase).toLocaleString()} × 5% (monthly
                          rate)
                          <br />
                          = ₱
                          {Number(entry.monthlyProfitRate).toLocaleString(
                            undefined,
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }
                          )}{" "}
                          per month
                          <br />
                          <br />
                          {entry.monthsElapsed} months × ₱
                          {Number(entry.monthlyProfitRate).toLocaleString(
                            undefined,
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }
                          )}{" "}
                          = ₱
                          {Number(
                            entry.monthlyProfitRate * entry.monthsElapsed
                          ).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          expected
                        </Typography>
                      </Card>
                    </Box>

                    {/* Monthly Profit Timeline */}
                    <Box sx={{ mb: 2 }}>
                      <Typography
                        variant="subtitle2"
                        sx={{
                          color: "#90CAF9",
                          fontWeight: 700,
                          mb: 1.5,
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                        }}
                      >
                        <span>📅</span>
                        Monthly Profit Timeline
                      </Typography>
                      <TableContainer
                        component={Paper}
                        sx={{
                          bgcolor: "rgba(33, 47, 61, 0.7)",
                          border: "1px solid rgba(144, 202, 249, 0.2)",
                          borderRadius: 1,
                        }}
                      >
                        <Table size="small">
                          <TableHead>
                            <TableRow
                              sx={{
                                bgcolor: "rgba(15, 78, 168, 0.3)",
                                borderBottom: "1px solid rgba(144, 202, 249, 0.2)",
                              }}
                            >
                              <TableCell
                                sx={{
                                  color: "#90CAF9",
                                  fontWeight: 700,
                                  fontSize: 11,
                                  textTransform: "uppercase",
                                }}
                              >
                                Profit Ready Date
                              </TableCell>
                              <TableCell
                                sx={{
                                  color: "#90CAF9",
                                  fontWeight: 700,
                                  fontSize: 11,
                                  textTransform: "uppercase",
                                }}
                              >
                                Amount
                              </TableCell>
                              <TableCell
                                sx={{
                                  color: "#90CAF9",
                                  fontWeight: 700,
                                  fontSize: 11,
                                  textTransform: "uppercase",
                                }}
                              >
                                Status
                              </TableCell>
                              <TableCell
                                sx={{
                                  color: "#90CAF9",
                                  fontWeight: 700,
                                  fontSize: 11,
                                  textTransform: "uppercase",
                                }}
                              >
                                Claim Date
                              </TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {(() => {
                              // Helper to safely convert dates
                              const toDateSafe = (date) => {
                                if (!date) return null;
                                if (typeof date.toDate === "function") return date.toDate();
                                if (date instanceof Date) return date;
                                return new Date(date);
                              };

                              const now = new Date();
                              const monthlyRate = entry.monthlyProfitRate;
                              const profitTimeline = [];

                              // First pass: identify which period was claimed (if any)
                              let claimedPeriodIndex = -1;
                              if (entry.profitStatus === "Claimed" && entry.profitClaimedAt) {
                                const claimDate = toDateSafe(entry.profitClaimedAt);
                                if (claimDate) {
                                  let periodStartDate = new Date(entry.createdAt);
                                  let periodIndex = 0;

                                  // Find which period's profit was claimed
                                  // The logic: find the LAST period whose endDate is <= claimDate
                                  while (periodIndex < 12) {
                                    const periodEndDate = new Date(periodStartDate);
                                    periodEndDate.setMonth(periodEndDate.getMonth() + 1);

                                    // If claim date is after this period's end date, this period could be claimed
                                    if (claimDate >= periodEndDate) {
                                      claimedPeriodIndex = periodIndex;
                                    } else {
                                      // We've passed the claim date, stop searching
                                      break;
                                    }

                                    periodStartDate = periodEndDate;
                                    periodIndex += 1;
                                  }
                                }
                              }

                              // Second pass: generate timeline
                              let periodStartDate = new Date(entry.createdAt);
                              let periodNumber = 0;

                              // Calculate 1-year expiry date from activation
                              const expiryDate = new Date(entry.createdAt);
                              expiryDate.setFullYear(expiryDate.getFullYear() + 1);

                              // Generate periods for the full 12-month validity period
                              while (periodNumber < 12) { // Max 12 months (1 year)
                                const periodEndDate = new Date(periodStartDate);
                                periodEndDate.setMonth(periodEndDate.getMonth() + 1);

                                // Stop if this period starts on or after expiry date
                                if (periodStartDate >= expiryDate) break;

                                // This period is claimed if it matches the claimed period index
                                const isClaimed = periodNumber === claimedPeriodIndex;
                                const claimDateForPeriod = isClaimed && entry.profitClaimedAt ? toDateSafe(entry.profitClaimedAt) : null;

                                profitTimeline.push({
                                  periodStartDate: new Date(periodStartDate),
                                  periodEndDate: new Date(periodEndDate),
                                  amount: monthlyRate,
                                  isClaimed: isClaimed,
                                  claimDate: claimDateForPeriod,
                                });

                                periodStartDate = periodEndDate;
                                periodNumber += 1;
                              }

                              return profitTimeline.map((timeline, idx) => (
                                <TableRow
                                  key={idx}
                                  sx={{
                                    bgcolor:
                                      timeline.isClaimed
                                        ? "rgba(76, 175, 80, 0.1)"
                                        : "rgba(255, 152, 0, 0.05)",
                                    borderBottom:
                                      "1px solid rgba(144, 202, 249, 0.1)",
                                    "&:hover": {
                                      bgcolor: timeline.isClaimed
                                        ? "rgba(76, 175, 80, 0.15)"
                                        : "rgba(255, 152, 0, 0.1)",
                                    },
                                  }}
                                >
                                  <TableCell sx={{ color: "#fff", fontSize: 12 }}>
                                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                                      <Typography sx={{ fontSize: 11, fontWeight: 600 }}>
                                        {formatDate(timeline.periodStartDate)}
                                      </Typography>
                                      <Typography sx={{ fontSize: 10, color: "rgba(255,255,255,0.6)" }}>
                                        → {formatDate(timeline.periodEndDate)}
                                      </Typography>
                                    </Box>
                                  </TableCell>
                                  <TableCell sx={{ color: "#90CAF9", fontWeight: 600, fontSize: 12 }}>
                                    ₱
                                    {Number(timeline.amount).toLocaleString(
                                      undefined,
                                      {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      }
                                    )}
                                  </TableCell>
                                  <TableCell sx={{ fontSize: 12 }}>
                                    {timeline.isClaimed ? (
                                      <Chip
                                        label="✅ Claimed"
                                        size="small"
                                        sx={{
                                          bgcolor: "rgba(76, 175, 80, 0.2)",
                                          color: "#81C784",
                                          fontWeight: 700,
                                          height: 24,
                                        }}
                                      />
                                    ) : (
                                      <Chip
                                        label="⏳ Accruing"
                                        size="small"
                                        sx={{
                                          bgcolor: "rgba(255, 152, 0, 0.2)",
                                          color: "#FFB74D",
                                          fontWeight: 700,
                                          height: 24,
                                        }}
                                      />
                                    )}
                                  </TableCell>
                                  <TableCell sx={{ color: "#fff", fontSize: 12 }}>
                                    {timeline.isClaimed ? (
                                      <Typography sx={{ fontSize: 12, fontWeight: 600, color: "#81C784" }}>
                                        {formatDate(timeline.claimDate)}
                                      </Typography>
                                    ) : (
                                      <Button
                                        size="small"
                                        variant="contained"
                                        disabled={timeline.periodEndDate > now || claimingEntryId === entry.id}
                                        sx={{
                                          fontWeight: 700,
                                          borderRadius: 1,
                                          textTransform: "none",
                                          fontSize: 11,
                                          minWidth: 70,
                                          py: 0.5,
                                          px: 1.5,
                                          transition: "all 0.3s ease",
                                          opacity: timeline.periodEndDate > now ? 0.5 : 1,
                                          background: claimingEntryId === entry.id ? "linear-gradient(135deg, #FFB74D, #FF9800)" : (timeline.periodEndDate > now ? "rgba(255, 152, 0, 0.2)" : "linear-gradient(135deg, #2f7de1, #0f4ea8)"),
                                          color: claimingEntryId === entry.id ? "#000" : (timeline.periodEndDate > now ? "#FFB74D" : "#fff"),
                                          "&:hover": {
                                            background: claimingEntryId === entry.id ? "linear-gradient(135deg, #FFB74D, #FF9800)" : (timeline.periodEndDate > now ? "rgba(255, 152, 0, 0.3)" : "linear-gradient(135deg, #3b8cf2, #1a5fc5)"),
                                            transform: claimingEntryId === entry.id ? "scale(1)" : "scale(1.02)",
                                          },
                                          "&:disabled": {
                                            opacity: 0.5,
                                            cursor: timeline.periodEndDate > now ? "not-allowed" : "pointer",
                                          },
                                        }}
                                        onClick={() => {
                                          const claimData = {
                                            id: entry.id,
                                            profit: timeline.amount,
                                            profitStatus: "Pending",
                                            amount: entry.amount,
                                            date: entry.createdAt,
                                          };
                                          console.log("🔵 Timeline Claim button clicked with data:", claimData);
                                          console.log("Entry data:", entry);
                                          console.log("Timeline data:", timeline);
                                          onTransferProfit(claimData);
                                        }}
                                      >
                                        {claimingEntryId === entry.id ? "⏳ Claiming..." : "Claim"}
                                      </Button>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ));
                            })()}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>

                    {/* Profit Status Summary */}
                    {entry.profitStatus === "Claimed" ? (
                      <Box>
                        <Typography
                          variant="subtitle2"
                          sx={{
                            color: "#81C784",
                            fontWeight: 700,
                            mb: 1,
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                          }}
                        >
                          <span>✅</span>
                          Latest Claim
                        </Typography>
                        <Card
                          sx={{
                            p: 1.5,
                            bgcolor: "rgba(33, 47, 61, 0.6)",
                            border: "1px solid rgba(76, 175, 80, 0.3)",
                            borderRadius: 1,
                          }}
                        >
                          <Typography sx={{ color: "#81C784", fontSize: 12 }}>
                            Profit Claimed: ₱
                            {Number(entry.profitClaimedAmount || entry.profit || 0).toLocaleString(
                              undefined,
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }
                            )}
                          </Typography>
                          {entry.profitClaimedAt && (
                            <Typography
                              sx={{ color: "#81C784", fontSize: 12, mt: 0.5 }}
                            >
                              Claimed on: {formatDate(entry.profitClaimedAt)}
                            </Typography>
                          )}
                        </Card>
                      </Box>
                    ) : (
                      <Box>
                        <Typography
                          variant="subtitle2"
                          sx={{
                            color: "#FFB74D",
                            fontWeight: 700,
                            mb: 1,
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                          }}
                        >
                          <span>⏳</span>
                          Currently Accruing
                        </Typography>
                        <Card
                          sx={{
                            p: 1.5,
                            bgcolor: "rgba(33, 47, 61, 0.6)",
                            border: "1px solid rgba(255, 183, 77, 0.2)",
                            borderRadius: 1,
                          }}
                        >
                          <Typography sx={{ color: "#FFB74D", fontSize: 12 }}>
                            Current Accrued Profit: ₱
                            {Number(entry.profit || 0).toLocaleString(
                              undefined,
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }
                            )}
                          </Typography>
                          <Typography
                            sx={{ color: "#FFB74D", fontSize: 12, mt: 0.5 }}
                          >
                            Expires: {formatDate(entry.expireDate)}
                          </Typography>
                        </Card>
                      </Box>
                    )}

                    {/* Expiry Status */}
                    {!entry.isActive && (
                      <Box sx={{ mt: 2 }}>
                        <Chip
                          label="🔴 EXPIRED - No longer accruing profit"
                          sx={{
                            bgcolor: "rgba(239, 83, 80, 0.2)",
                            color: "#EF5350",
                            fontWeight: 700,
                            width: "100%",
                            height: 32,
                          }}
                        />
                      </Box>
                    )}
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </Box>
        ) : (
          <Typography
            sx={{
              color: "rgba(217,233,255,0.5)",
              textAlign: "center",
              py: 3,
            }}
          >
            No capital share entries found
          </Typography>
        )}

        {/* Info Box */}
        <Box
          sx={{
            mt: 3,
            p: 2,
            borderRadius: 2,
            bgcolor: "rgba(79, 195, 247, 0.1)",
            border: "1px solid rgba(79, 195, 247, 0.2)",
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: "#90CAF9",
              fontWeight: 700,
              display: "block",
              mb: 1,
            }}
          >
            ℹ️ How to Read This:
          </Typography>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12 }}>
            <li style={{ color: "rgba(217,233,255,0.7)", marginBottom: 4 }}>
              <strong>Entry Date:</strong> When you created the capital share entry
            </li>
            <li style={{ color: "rgba(217,233,255,0.7)", marginBottom: 4 }}>
              <strong>Months Elapsed:</strong> How long since you made the entry
            </li>
            <li style={{ color: "rgba(217,233,255,0.7)", marginBottom: 4 }}>
              <strong>Monthly Rate:</strong> 5% of your capital amount per month
            </li>
            <li style={{ color: "rgba(217,233,255,0.7)", marginBottom: 4 }}>
              <strong>Expected Total:</strong> How much profit you should have earned
            </li>
            <li style={{ color: "rgba(217,233,255,0.7)" }}>
              <strong>Status:</strong> Whether profit has been claimed or is still accruing
            </li>
          </ul>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default DetailedProfitClaimsHistory;
