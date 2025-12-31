import React from "react";
import { Card, Typography, Box, CircularProgress } from "@mui/material";

const PaybackTransactions = ({ loading, paybackEntries }) => {
  return (
    <Card sx={{ background: "linear-gradient(120deg, rgba(231,237,241,0.27), rgba(33,150,243,0.08))", borderRadius: 3, p: 3, minHeight: 320, width: '100%', maxWidth: 900, boxShadow: '0 4px 24px 0 rgba(33,150,243,0.10)', mb: 4, height: { xs: '60vh', sm: '65vh', md: '70vh', lg: '75vh' }, display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h6" sx={{ fontWeight: 700, color: '#1976d2', mb: 2, letterSpacing: 0.5 }}>
        Payback Transactions
      </Typography>
      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" height="120px">
          <CircularProgress color="info" />
        </Box>
      ) : paybackEntries.length > 0 ? (
        <Box sx={{ width: '100%', flex: 1, overflowY: 'auto', height: '100%' }}>
          {paybackEntries.map((e, idx) => {
            const now = new Date();
            const expirationDate = e.expirationDate instanceof Date ? e.expirationDate : new Date(e.expirationDate);
            const isMatured = expirationDate <= now;
            const profitStatus = isMatured ? "Profit Earn" : "Pending";
            const profitIcon = profitStatus === "Pending" ? "⏳" : "✅";
            const borderColor = profitStatus === "Profit Earn" ? '#4caf50' : '#1976d2';
            const iconBg = profitStatus === "Profit Earn" ? '#e8f5e9' : '#e3f2fd';
            const iconColor = profitStatus === "Profit Earn" ? '#388e3c' : '#1976d2';
            return (
              <Card
                key={e.id}
                sx={{
                  p: 0,
                  borderRadius: 1.5,
                  bgcolor: 'rgba(30,41,59,0.92)',
                  color: '#fff',
                  boxShadow: '0px 2px 12px rgba(33,150,243,0.10)',
                  borderLeft: `4px solid ${borderColor}`,
                  display: 'flex',
                  alignItems: 'stretch',
                  minHeight: 56,
                  mb: 0.8,
                  transition: 'box-shadow 0.2s',
                  '&:hover': {
                    boxShadow: `0 4px 16px 0 ${borderColor}33`,
                  },
                }}
              >
                <Box sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 38,
                  bgcolor: iconBg,
                  borderTopLeftRadius: 6,
                  borderBottomLeftRadius: 6,
                  px: 0.7,
                  py: 1.1,
                  mr: 1,
                }}>
                  <Box sx={{ fontSize: 18, color: iconColor }}>{profitIcon}</Box>
                </Box>
                <Box sx={{ flex: 1, py: 0.7, pr: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: 11, letterSpacing: 0.1, color: '#fff' }}>
                    Amount
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: borderColor, mb: 0.1, fontSize: 14, letterSpacing: 0.1 }}>
                    ₱{e.amount.toFixed(2)}
                  </Typography>
                  <Box sx={{ display: "flex", gap: 0.7, flexWrap: "wrap", mb: 0.2 }}>
                    <Typography
                      sx={{
                        px: 0.7,
                        py: 0.1,
                        borderRadius: 1,
                        bgcolor: isMatured ? "#1976d2" : "#c62828",
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: 9.5,
                      }}
                    >
                      Status: {isMatured ? "Valid" : (e.status || "Pending")}
                    </Typography>
                    <Typography
                      sx={{
                        px: 0.7,
                        py: 0.1,
                        borderRadius: 1,
                        bgcolor: profitStatus === "Profit Earn" ? "#388e3c" : "#ef6c00",
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: 9.5,
                      }}
                    >
                      Profit: {profitStatus}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ color: '#e0e0e0', mb: 0.1, fontSize: 10 }}>
                    {isMatured ? "Expired" : `Next Profit Date: ${expirationDate ? expirationDate.toDateString() : "-"}`}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#e0e0e0', fontSize: 10 }}>
                    Upline: <b style={{color:'#fff'}}>{e.uplineUsername}</b> | 2% Profit: <b style={{color:'#fff'}}>₱{(e.amount * 0.02).toFixed(2)}</b>
                  </Typography>
                </Box>
              </Card>
            );
          })}
        </Box>
      ) : (
        <Box display="flex" alignItems="center" justifyContent="center" height="80px">
          <Typography variant="h6" color="text.secondary" sx={{ fontSize: 16 }}>
            No payback transactions found.
          </Typography>
        </Box>
      )}
    </Card>
  );
};

export default PaybackTransactions;
