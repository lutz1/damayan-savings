import React from "react";
import {
  Dialog,
  DialogContent,
  Button,
  Box,
  Typography
} from "@mui/material";
import bgImage from "../../../../assets/bg.jpg";

const PassiveIncomeEarn = ({ open, onClose, paybackEntries, setTransferAmount, setTransferDialogOpen }) => {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 4, boxShadow: 12, overflow: 'hidden', background: 'none', maxWidth: { xs: '100%', sm: 500, md: 500 } } }}>
      {/* Reduced header with X button */}
      <Box sx={{
        bgcolor: '#1976d2',
        color: '#fff',
        px: { xs: 2, sm: 4 },
        py: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderTopLeftRadius: 4,
        borderTopRightRadius: 4,
        boxShadow: 2,
        position: 'relative',
        zIndex: 1,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ fontSize: 28, mb: 0.5 }}>📈</Box>
          <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: 0.5, color: '#fff', textShadow: '0 2px 12px #000a' }}>
            Passive Income Earn
          </Typography>
        </Box>
        <Button
          onClick={onClose}
          sx={{ minWidth: 0, p: 0.5, color: '#fff', bgcolor: 'transparent', '&:hover': { bgcolor: '#1565c0' } }}
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </Button>
      </Box>
      {/* Professional style background for content, cards centered */}
      <DialogContent
        dividers
        sx={{
          px: { xs: 2, sm: 4 },
          py: 3,
          background: `linear-gradient(120deg, rgba(30,41,59,0.92) 60%, rgba(33,150,243,0.18)), url(${bgImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative',
          minHeight: 220,
          borderBottomLeftRadius: 4,
          borderBottomRightRadius: 4,
          zIndex: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          overflowX: 'hidden', // Disable horizontal swipe/scroll
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(120deg, rgba(30,41,59,0.92) 60%, rgba(33,150,243,0.18))',
            zIndex: -1,
            borderBottomLeftRadius: 4,
            borderBottomRightRadius: 4,
          },
        }}
      >
        {paybackEntries.length > 0 ? (
          <Box
            sx={{
              width: '100%',
              maxWidth: 500,
              mx: 'auto',
              p: 0,
              mt: 0,
              mb: 0,
              maxHeight: 360,
              overflowY: 'auto',
              scrollbarWidth: 'none', // Firefox
              msOverflowStyle: 'none', // IE/Edge
              '&::-webkit-scrollbar': { display: 'none' }, // Chrome/Safari
            }}
          >
            <Box
              component="ul"
              sx={{
                listStyle: 'none',
                m: 0,
                p: 0,
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 0,
                borderRadius: 3,
                overflow: 'hidden',
                boxShadow: '0 2px 16px 0 rgba(33,150,243,0.10)',
                background: 'rgba(30,41,59,0.92)',
              }}
            >
              {[...paybackEntries]
                .sort((a, b) => {
                  const aCreated = a.createdAt || a.created;
                  const bCreated = b.createdAt || b.created;
                  const aTime = aCreated ? (typeof aCreated === 'string' ? new Date(aCreated).getTime() : (aCreated.toDate ? aCreated.toDate().getTime() : (aCreated instanceof Date ? aCreated.getTime() : 0))) : 0;
                  const bTime = bCreated ? (typeof bCreated === 'string' ? new Date(bCreated).getTime() : (bCreated.toDate ? bCreated.toDate().getTime() : (bCreated instanceof Date ? bCreated.getTime() : 0))) : 0;
                  return bTime - aTime;
                })
                .map((e, idx) => {
                const now = new Date();
                const expirationDate = e.expirationDate instanceof Date ? e.expirationDate : new Date(e.expirationDate);
                let profitStatus, profitIcon, profitColor, profitBg;
                if (expirationDate > now) {
                  profitStatus = "Pending";
                  profitIcon = "⏳";
                  profitColor = '#ef6c00';
                  profitBg = '#ef6c00';
                } else if (e.transferred) {
                  profitStatus = "Transferred";
                  profitIcon = "💸";
                  profitColor = '#0288d1';
                  profitBg = '#0288d1';
                } else {
                  profitStatus = "Profit Earn";
                  profitIcon = "✅";
                  profitColor = '#388e3c';
                  profitBg = '#388e3c';
                }
                const canTransfer = profitStatus === "Profit Earn" && !e.transferred;
                const profit = (e.amount * 0.02);
                return (
                  <Box
                    key={e.id}
                    component="li"
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      px: 2.5,
                      py: 2,
                      borderBottom: idx !== paybackEntries.length - 1 ? '1px solid #263043' : 'none',
                      background: 'transparent',
                      transition: 'background 0.2s',
                      '&:hover': {
                        background: 'rgba(33,150,243,0.08)',
                      },
                      position: 'relative',
                    }}
                  >
                    <Box sx={{ fontSize: 28, color: profitColor, mr: 1 }}>{profitIcon}</Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: 13, color: '#fff', letterSpacing: 0.1 }}>
                        2% Profit
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 800, color: profitStatus === "Profit Earn" ? '#4caf50' : profitStatus === "Transferred" ? '#0288d1' : '#1976d2', fontSize: 18, letterSpacing: 0.1, mb: 0.2 }}>
                        ₱{profit.toFixed(2)}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
                        <Typography
                          sx={{
                            px: 1.2,
                            py: 0.3,
                            borderRadius: 1,
                            bgcolor: profitBg,
                            color: '#fff',
                            fontWeight: 600,
                            fontSize: 11,
                          }}
                        >
                          Profit: {profitIcon} {profitStatus}
                        </Typography>
                      </Box>
                      {/* Created date before next profit date */}
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
                      <Typography variant="body2" sx={{ color: '#e0e0e0', fontSize: 11, mb: 0.2 }}>
                        Next Profit Date: {expirationDate ? expirationDate.toDateString() : "-"}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#e0e0e0', fontSize: 11 }}>
                        2% Profit: <b style={{color:'#fff'}}>₱{(e.amount * 0.02).toFixed(2)}</b>
                      </Typography>
                    </Box>
                    {canTransfer && (
                      <Button
                        variant="contained"
                        color="success"
                        sx={{ fontWeight: 700, borderRadius: 2, boxShadow: 2, textTransform: 'none', px: 2, py: 1, fontSize: 14, ml: 2, minWidth: 0 }}
                        onClick={() => {
                          setTransferAmount((e.amount * 0.02).toFixed(2));
                          setTransferDialogOpen(true);
                        }}
                      >
                        Transfer
                      </Button>
                    )}
                  </Box>
                );
              })}
            </Box>
          </Box>
        ) : (
          <Typography sx={{ textAlign: "center", py: 3, color: '#1976d2', fontWeight: 700, fontSize: 18 }}>No passive income earned yet.</Typography>
        )}
      </DialogContent>
      {/* Removed: Close button at the bottom, replaced by X icon at top right */}
    </Dialog>
  );
};

export default PassiveIncomeEarn;
