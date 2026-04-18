import React, { useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
  Alert,
  MenuItem,
} from "@mui/material";

const DAYS_OF_WEEK = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_LABELS = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

const validateTimes = (openTime, closeTime) => {
  if (!openTime || !closeTime) return { valid: true, error: "" };
  
  const [openHour, openMin] = openTime.split(":").map(Number);
  const [closeHour, closeMin] = closeTime.split(":").map(Number);
  
  const openTotalMins = openHour * 60 + openMin;
  const closeTotalMins = closeHour * 60 + closeMin;
  
  if (openTotalMins >= closeTotalMins) {
    return { valid: false, error: "Opening time must be before closing time" };
  }
  
  return { valid: true, error: "" };
};

const OperationHoursEditor = ({
  operationHours,
  onUpdate,
}) => {
  const [bulkApplyOpen, setBulkApplyOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState("09:00");
  const [bulkClose, setBulkClose] = useState("18:00");
  const [copySourceDay, setCopySourceDay] = useState("");
  const [timeErrors, setTimeErrors] = useState({});

  const handleTimeChange = (day, field, value) => {
    const otherField = field === "open" ? "close" : "open";
    const otherValue = field === "open" ? operationHours[day].close : operationHours[day].open;
    
    const { valid, error } = validateTimes(
      field === "open" ? value : otherValue,
      field === "close" ? value : otherValue
    );
    
    setTimeErrors((prev) => ({
      ...prev,
      [day]: error || "",
    }));

    onUpdate(day, field, value);
  };

  const handleToggleClosed = (day) => {
    onUpdate(day, "closed", !operationHours[day].closed);
    setTimeErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[day];
      return newErrors;
    });
  };

  const handleBulkApply = () => {
    const { valid, error } = validateTimes(bulkOpen, bulkClose);
    if (!valid) {
      setTimeErrors(DAYS_OF_WEEK.reduce((acc, day) => ({ ...acc, [day]: error }), {}));
      return;
    }

    DAYS_OF_WEEK.forEach((day) => {
      onUpdate(day, "open", bulkOpen);
      onUpdate(day, "close", bulkClose);
      onUpdate(day, "closed", false);
    });

    setBulkApplyOpen(false);
    setTimeErrors({});
  };

  const handleCopyDay = () => {
    if (!copySourceDay) return;

    const sourceHours = operationHours[copySourceDay];
    DAYS_OF_WEEK.forEach((day) => {
      if (day !== copySourceDay) {
        onUpdate(day, "open", sourceHours.open);
        onUpdate(day, "close", sourceHours.close);
        onUpdate(day, "closed", sourceHours.closed);
      }
    });

    setCopySourceDay("");
    setTimeErrors({});
  };

  return (
    <>
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap" }}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => setBulkApplyOpen(true)}
            sx={{
              textTransform: "none",
              fontSize: "0.8rem",
              fontWeight: 600,
              color: "#2b7cee",
              borderColor: "#2b7cee",
              "&:hover": { bgcolor: "#eff6ff" },
            }}
          >
            Apply to All Days
          </Button>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <TextField
              select
              size="small"
              label="Copy from"
              value={copySourceDay}
              onChange={(e) => setCopySourceDay(e.target.value)}
              sx={{ width: 130 }}
            >
              {DAYS_OF_WEEK.map((day) => (
                <MenuItem key={day} value={day}>
                  {DAY_LABELS[day]}
                </MenuItem>
              ))}
            </TextField>
            <Button
              variant="outlined"
              size="small"
              onClick={handleCopyDay}
              disabled={!copySourceDay}
              sx={{
                textTransform: "none",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "#2b7cee",
                borderColor: "#2b7cee",
                "&:hover": { bgcolor: "#eff6ff" },
                "&:disabled": { opacity: 0.5 },
              }}
            >
              Copy
            </Button>
          </Box>
        </Box>

        <Stack spacing={1.5}>
          {DAYS_OF_WEEK.map((day) => {
            const hours = operationHours[day];
            const hasError = timeErrors[day];

            return (
              <Box
                key={day}
                sx={{
                  p: 2,
                  bgcolor: "#fff",
                  borderRadius: "12px",
                  border: `1px solid ${hasError ? "#ef4444" : "#e2e8f0"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 2,
                  transition: "border-color 200ms",
                }}
              >
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: "0.85rem", fontWeight: 700, color: "#0f172a", textTransform: "capitalize" }}>
                    {DAY_LABELS[day]}
                  </Typography>
                  {hasError && (
                    <Typography sx={{ fontSize: "0.7rem", color: "#ef4444", mt: 0.25, fontWeight: 600 }}>
                      {hasError}
                    </Typography>
                  )}
                </Box>

                {hours.closed ? (
                  <Typography sx={{ fontSize: "0.85rem", fontWeight: 600, color: "#ef4444", minWidth: 80 }}>
                    Closed
                  </Typography>
                ) : (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 220 }}>
                    <TextField
                      type="time"
                      value={hours.open}
                      onChange={(e) => handleTimeChange(day, "open", e.target.value)}
                      size="small"
                      sx={{
                        width: 90,
                        "& .MuiOutlinedInput-root": {
                          fontSize: "0.8rem",
                          borderRadius: "8px",
                        },
                      }}
                    />
                    <Typography sx={{ fontSize: "0.8rem", color: "#64748b" }}>to</Typography>
                    <TextField
                      type="time"
                      value={hours.close}
                      onChange={(e) => handleTimeChange(day, "close", e.target.value)}
                      size="small"
                      sx={{
                        width: 90,
                        "& .MuiOutlinedInput-root": {
                          fontSize: "0.8rem",
                          borderRadius: "8px",
                        },
                      }}
                    />
                  </Box>
                )}

                <Button
                  size="small"
                  onClick={() => handleToggleClosed(day)}
                  variant={hours.closed ? "outlined" : "contained"}
                  sx={{
                    textTransform: "none",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    minWidth: "auto",
                    px: 1.5,
                    bgcolor: hours.closed ? "transparent" : "#fee2e2",
                    color: hours.closed ? "#6b7280" : "#ef4444",
                    borderColor: "#e5e7eb",
                    "&:hover": {
                      bgcolor: hours.closed ? "#f3f4f6" : "#fecaca",
                    },
                  }}
                >
                  {hours.closed ? "Closed" : "Open"}
                </Button>
              </Box>
            );
          })}
        </Stack>
      </Box>

      {/* Bulk Apply Dialog */}
      <Dialog open={bulkApplyOpen} onClose={() => setBulkApplyOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Apply Hours to All Days</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 2 }}>
            <TextField
              label="Opening Time"
              type="time"
              value={bulkOpen}
              onChange={(e) => setBulkOpen(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Closing Time"
              type="time"
              value={bulkClose}
              onChange={(e) => setBulkClose(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <Alert severity="info" icon={null}>
              This will set the same hours for all days and mark all days as Open.
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkApplyOpen(false)}>Cancel</Button>
          <Button onClick={handleBulkApply} variant="contained">
            Apply
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default OperationHoursEditor;
