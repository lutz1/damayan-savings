import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Typography, Card, CardContent, Button, Stack } from "@mui/material";
import { CancelOutlined } from "@mui/icons-material";
import bgImage from "../assets/bg.jpg";

const DepositCancel = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Log cancellation for admin review if needed
    console.log("[deposit-cancel] User cancelled PayMongo payment at:", new Date().toISOString());
  }, []);

  const handleRetryDeposit = () => {
    // Redirect to member dashboard where user can retry from deposit dialog
    navigate("/member/dashboard", { state: { openDepositDialog: true } });
  };

  const handleGoBack = () => {
    navigate("/member/dashboard");
  };

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        backgroundImage: `url(${bgImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        position: "relative",
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.4)",
          zIndex: 0,
        },
      }}
    >
      <Card
        sx={{
          maxWidth: 450,
          width: "90%",
          zIndex: 1,
          background: "rgba(30,30,30,0.95)",
          backdropFilter: "blur(20px)",
          color: "#fff",
          textAlign: "center",
          p: 3,
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        }}
      >
        <CardContent>
          <CancelOutlined sx={{ fontSize: 60, color: "#FF6B6B", mb: 2 }} />
          
          <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
            Payment Cancelled
          </Typography>
          
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.7)", mb: 3 }}>
            You cancelled the payment transaction. No amount was charged to your account.
          </Typography>

          <Box
            sx={{
              background: "rgba(255,107,107,0.15)",
              border: "1px solid rgba(255,107,107,0.3)",
              borderRadius: 2,
              p: 2,
              mb: 3,
            }}
          >
            <Typography variant="body2" sx={{ color: "#FFB3B3" }}>
              ✅ Your wallet is safe - no deduction was made
            </Typography>
          </Box>

          <Stack spacing={2}>
            <Button
              variant="contained"
              fullWidth
              sx={{
                bgcolor: "#81C784",
                color: "#000",
                fontWeight: 600,
                py: 1.2,
                "&:hover": { bgcolor: "#66BB6A" },
              }}
              onClick={handleRetryDeposit}
            >
              🔄 Retry Deposit
            </Button>

            <Button
              variant="outlined"
              fullWidth
              sx={{
                borderColor: "rgba(255,255,255,0.3)",
                color: "#fff",
                fontWeight: 600,
                py: 1.2,
                "&:hover": { background: "rgba(255,255,255,0.1)" },
              }}
              onClick={handleGoBack}
            >
              Go to Dashboard
            </Button>
          </Stack>

          <Typography
            variant="caption"
            sx={{
              color: "rgba(255,255,255,0.5)",
              mt: 3,
              display: "block",
            }}
          >
            If you have any questions, please contact support.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default DepositCancel;
