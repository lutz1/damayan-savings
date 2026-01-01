
import React from "react";
import { Card, Typography, Box, CircularProgress } from "@mui/material";

const PaybackTransactions = ({ loading, paybackEntries }) => {
  return (
    <Card
      sx={{
        background: 'linear-gradient(120deg, rgba(30,41,59,0.92) 60%, rgba(33,150,243,0.18))',
        borderRadius: 4,
        p: { xs: 2, sm: 3 },
        minHeight: 320,
        width: '100%',
        maxWidth: 900,
        boxShadow: '0 2px 16px 0 rgba(33,150,243,0.07)',
        mb: 4,
        height: { xs: '60vh', sm: '65vh', md: '70vh', lg: '75vh' },
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Typography variant="h6" sx={{ fontWeight: 800, color: '#1976d2', mb: 2, letterSpacing: 0.5, fontSize: 22 }}>
        Payback Transactions
      </Typography>
      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" height="120px">
          <CircularProgress color="info" />
        </Box>
      ) : paybackEntries.length > 0 ? (
        <Box
          sx={{
            width: '100%',
            flex: 1,
            overflowY: 'auto',
            height: '100%',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
            pr: 0.5,
          }}
        >
          {paybackEntries.map((e, idx) => {
            const now = new Date();
            const expirationDate = e.expirationDate instanceof Date ? e.expirationDate : new Date(e.expirationDate);
            const isMatured = expirationDate <= now;
            const profitStatus = isMatured ? "Profit Earn" : "Pending";
            const profitColor = isMatured ? '#388e3c' : '#ef6c00';
            return (
              <Box
                key={e.id}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  bgcolor: idx % 2 === 0 ? 'rgba(44,62,80,0.92)' : 'rgba(33,150,243,0.13)',
                  borderRadius: 3,
                  boxShadow: '0 1px 4px 0 rgba(33,150,243,0.04)',
                  p: { xs: 1.2, sm: 1.7 },
                  mb: 1.2,
                  transition: 'box-shadow 0.2s',
                  border: '1px solid #2b3a4b',
                  '&:hover': {
                    boxShadow: '0 4px 16px 0 #1976d222',
                    border: '1.5px solid #4FC3F7',
                  },
                }}
              >
                <Typography sx={{ fontWeight: 800, color: '#fff', fontSize: 18, mb: 0.5, textShadow: '0 1px 8px #1976d2' }}>
                  User: {e.user?.name || e.user?.username || e.username || e.userId || 'User'}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 0.5 }}>
                  <Typography sx={{ color: '#90caf9', fontWeight: 600, fontSize: 15, minWidth: 120 }}>
                    Amount: ₱{e.amount.toFixed(2)}
                  </Typography>
                  <Typography sx={{ color: '#b2dfdb', fontWeight: 500, fontSize: 14, minWidth: 120 }}>
                    Created: {e.createdAt ? new Date(e.createdAt).toLocaleDateString() : '-'}
                  </Typography>
                  <Typography sx={{ color: '#b2dfdb', fontWeight: 500, fontSize: 14, minWidth: 120 }}>
                    Expiration: {expirationDate ? expirationDate.toLocaleDateString() : '-'}
                  </Typography>
                  <Typography sx={{ color: '#81C784', fontWeight: 600, fontSize: 15, minWidth: 120 }}>
                    2% Profit: ₱{(e.amount * 0.02).toFixed(2)}
                  </Typography>
                  <Typography sx={{ color: '#90caf9', fontWeight: 500, fontSize: 14, minWidth: 180 }}>
                    Email: {e.user?.email || e.email || '-'}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', mt: 0.5 }}>
                  <Typography sx={{ fontWeight: 700, color: profitColor, fontSize: 15, letterSpacing: 0.2, textShadow: '0 1px 4px #0008' }}>
                    {profitStatus}
                  </Typography>
                  <Typography sx={{ color: '#fff', fontWeight: 500, fontSize: 13, textShadow: '0 1px 4px #0008' }}>
                    {isMatured ? 'Valid' : (e.status || 'Pending')}
                  </Typography>
                </Box>
              </Box>
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
