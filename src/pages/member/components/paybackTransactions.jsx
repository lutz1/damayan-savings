import React, { useState } from "react";
import { Card, Typography, Box, CircularProgress, Checkbox } from "@mui/material";

const PaybackTransactions = ({ loading, paybackEntries }) => {
  const [filterActiveOnly, setFilterActiveOnly] = useState(false);
  return (
    <Card sx={{
      background: "rgba(30,41,59,0.92)",
      borderRadius: 3,
      p: 3,
      minHeight: 320,
      width: '100%',
      maxWidth: 900,
      boxShadow: '0 4px 24px 0 rgba(33,150,243,0.10)',
      mb: 4,
      height: { xs: '60vh', sm: '65vh', md: '70vh', lg: '75vh' },
      display: 'flex',
      flexDirection: 'column',
      color: '#fff',
      backdropFilter: 'blur(10px)',
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: '#FFD54F', letterSpacing: 0.5, textShadow: '1px 1px 3px rgba(0,0,0,0.4)' }}>
          Payback Transactions
        </Typography>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            bgcolor: 'rgba(33,150,243,0.10)',
            borderRadius: 2,
            px: 1.5,
            py: 0.5,
            boxShadow: '0 2px 8px 0 rgba(33,150,243,0.08)',
            ml: 2,
            userSelect: 'none',
            gap: 1,
          }}
        >
          <Checkbox
            color="info"
            size="small"
            checked={filterActiveOnly}
            onChange={e => setFilterActiveOnly(e.target.checked)}
            sx={{
              p: 0.5,
              color: '#29B6F6',
              '&.Mui-checked': {
                color: '#1976d2',
              },
              mr: 1,
            }}
          />
          <Typography sx={{ fontSize: 13.5, color: '#fff', fontWeight: 500, letterSpacing: 0.1 }}>
            Show Active Only
          </Typography>
        </Box>
      </Box>
      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" height="120px">
          <CircularProgress color="info" />
        </Box>
      ) : paybackEntries.length > 0 ? (
        <Box sx={{
          width: '100%',
          flex: 1,
          overflowY: 'auto',
          height: '100%',
          scrollbarWidth: 'none', // Firefox
          '-ms-overflow-style': 'none', // IE and Edge
          '&::-webkit-scrollbar': {
            display: 'none', // Chrome, Safari, Opera
          },
        }}>
          <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {[...paybackEntries]
              .filter(e => {
                if (!filterActiveOnly) return true;
                const now = new Date();
                const expirationDate = e.expirationDate instanceof Date ? e.expirationDate : new Date(e.expirationDate);
                return expirationDate > now;
              })
              .sort((a, b) => {
                const now = new Date();
                const aExp = a.expirationDate instanceof Date ? a.expirationDate : new Date(a.expirationDate);
                const bExp = b.expirationDate instanceof Date ? b.expirationDate : new Date(b.expirationDate);
                const aMatured = aExp <= now;
                const bMatured = bExp <= now;
                // Expired (matured) should be at the bottom
                if (aMatured === bMatured) {
                  // If both same, sort by createdAt/created descending (newest first)
                  const aCreated = a.createdAt || a.created;
                  const bCreated = b.createdAt || b.created;
                  const aTime = aCreated ? (typeof aCreated === 'string' ? new Date(aCreated).getTime() : (aCreated.toDate ? aCreated.toDate().getTime() : (aCreated instanceof Date ? aCreated.getTime() : 0))) : 0;
                  const bTime = bCreated ? (typeof bCreated === 'string' ? new Date(bCreated).getTime() : (bCreated.toDate ? bCreated.toDate().getTime() : (bCreated instanceof Date ? bCreated.getTime() : 0))) : 0;
                  return bTime - aTime;
                }
                return aMatured ? 1 : -1;
              })
              .map((e, idx) => {
                const now = new Date();
                const expirationDate = e.expirationDate instanceof Date ? e.expirationDate : new Date(e.expirationDate);
                const isMatured = expirationDate <= now;
                const profitStatus = isMatured ? "Profit Earn" : "Pending";
                const profitIcon = profitStatus === "Pending" ? "⏳" : "✅";
                const borderColor = profitStatus === "Profit Earn" ? '#4caf50' : '#1976d2';
                const iconBg = profitStatus === "Profit Earn" ? 'rgba(76,175,80,0.12)' : 'rgba(33,150,243,0.12)';
                const iconColor = profitStatus === "Profit Earn" ? '#81C784' : '#64B5F6';
                return (
                <Box
                  key={e.id}
                  component="li"
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                    py: 2,
                    px: 1,
                    transition: 'background 0.2s',
                    '&:hover': {
                      background: 'rgba(33,150,243,0.10)',
                    },
                  }}
                >
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 44,
                    minHeight: 44,
                    bgcolor: iconBg,
                    borderRadius: '50%',
                    mr: 2,
                    border: `2px solid ${borderColor}`,
                  }}>
                    <Typography sx={{ fontSize: 22, color: iconColor }}>{profitIcon}</Typography>
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#fff', fontSize: 15 }}>
                      ₱{e.amount.toFixed(2)}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5, mb: 0.5 }}>
                      <Typography
                        sx={{
                          px: 1,
                          py: 0.2,
                          borderRadius: 1,
                          bgcolor: isMatured ? "#1976d2" : "#c62828",
                          color: '#fff',
                          fontWeight: 600,
                          fontSize: 11,
                        }}
                      >
                        Status: {isMatured ? "Valid" : (e.status || "Pending")}
                      </Typography>
                      <Typography
                        sx={{
                          px: 1,
                          py: 0.2,
                          borderRadius: 1,
                          bgcolor: profitStatus === "Profit Earn" ? "#388e3c" : "#ef6c00",
                          color: '#fff',
                          fontWeight: 600,
                          fontSize: 11,
                        }}
                      >
                        Profit: {profitStatus}
                      </Typography>
                    </Box>
                    {(e.created || e.createdAt) && (
                      <Typography variant="body2" sx={{ color: '#b0bec5', fontSize: 11, mb: 0.2 }}>
                        Created: {
                          (() => {
                            const val = e.createdAt || e.created;
                            if (!val) return '';
                            if (typeof val === 'string') {
                              // Try to parse as date string
                              const d = new Date(val);
                              return isNaN(d) ? val : d.toDateString();
                            }
                            if (val.toDate) return val.toDate().toDateString();
                            if (val instanceof Date) return val.toDateString();
                            return '';
                          })()
                        }
                      </Typography>
                    )}
                    <Typography variant="body2" sx={{ color: '#e0e0e0', fontSize: 12, mb: 0.2 }}>
                      {isMatured ? "Expired" : `Next Profit Date: ${expirationDate ? expirationDate.toDateString() : "-"}`}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#FFD54F', fontSize: 12 }}>
                      2% Profit: <b style={{color:'#81C784'}}>₱{(e.amount * 0.02).toFixed(2)}</b>
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      ) : (
        <Box display="flex" alignItems="center" justifyContent="center" height="80px">
          <Typography variant="h6" sx={{ fontSize: 16, color: '#FFD54F' }}>
            No payback transactions found.
          </Typography>
        </Box>
      )}
    </Card>
  );
};

export default PaybackTransactions;
