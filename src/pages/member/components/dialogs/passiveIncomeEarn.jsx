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
      <DialogContent
        dividers
        sx={{
          px: { xs: 2, sm: 4 },
          py: 3,
          background: 'rgba(30,41,59,0.98)',
          position: 'relative',
          minHeight: 240,
          borderBottomLeftRadius: 4,
          borderBottomRightRadius: 4,
          zIndex: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          overflowX: 'hidden',
        }}
      >
        {paybackEntries.length > 0 ? (
          <Box
            sx={{
              width: '100%',
              maxWidth: 560,
              mx: 'auto',
              maxHeight: 400,
              overflowY: 'auto',
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(255,255,255,0.15) transparent',
              '&::-webkit-scrollbar': { width: '5px' },
              '&::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.15)', borderRadius: '3px' },
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
              .map((e) => {
                const now = new Date();
                const expirationDate = e.expirationDate instanceof Date ? e.expirationDate : new Date(e.expirationDate);
                let statusLabel, statusIcon, statusColor;
                if (expirationDate > now) {
                  statusLabel = "Pending";
                  statusIcon = "⏳";
                  statusColor = '#ff9800';
                } else if (e.transferred) {
                  statusLabel = "Transferred";
                  statusIcon = "✓";
                  statusColor = '#2196f3';
                } else {
                  statusLabel = "Ready";
                  statusIcon = "✓";
                  statusColor = '#4caf50';
                }
                const canTransfer = statusLabel === "Ready" && !e.transferred;
                const profit = (e.amount * 0.02);
                
                return (
                  <Box
                    key={e.id}
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                      p: 2.5,
                      mb: 1.5,
                      borderRadius: 2.5,
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                        background: 'rgba(255,255,255,0.07)',
                        border: '1px solid rgba(33,150,243,0.2)',
                        boxShadow: '0 4px 12px rgba(33,150,243,0.15)',
                      },
                    }}
                  >
                    {/* Header: Amount + Status */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
                      <Box>
                        <Typography sx={{ fontSize: 11, color: '#90caf9', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, mb: 0.5 }}>
                          2% Profit
                        </Typography>
                        <Typography sx={{ fontWeight: 800, fontSize: 32, color: '#fff', lineHeight: 1 }}>
                          ₱{profit.toFixed(2)}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.2, py: 0.6, borderRadius: 1.5, background: `${statusColor}15`, border: `1.5px solid ${statusColor}40` }}>
                        <Typography sx={{ fontSize: 14, color: statusColor, fontWeight: 600 }}>{statusIcon}</Typography>
                        <Typography sx={{ fontSize: 11, color: statusColor, fontWeight: 600, letterSpacing: 0.3 }}>
                          {statusLabel}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Dates Grid */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, py: 1 }}>
                      <Box>
                        <Typography sx={{ fontSize: 10, color: '#607d8b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3, mb: 0.6 }}>
                          Created
                        </Typography>
                        <Typography sx={{ color: '#e0e0e0', fontSize: 14, fontWeight: 500 }}>
                          {
                            (() => {
                              const val = e.createdAt || e.created;
                              if (!val) return 'N/A';
                              if (typeof val === 'string') {
                                const d = new Date(val);
                                return isNaN(d) ? val : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                              }
                              if (val.toDate) return val.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                              if (val instanceof Date) return val.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                              return 'N/A';
                            })()
                          }
                        </Typography>
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 10, color: '#607d8b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.3, mb: 0.6 }}>
                          Release
                        </Typography>
                        <Typography sx={{ color: '#e0e0e0', fontSize: 14, fontWeight: 500 }}>
                          {expirationDate ? expirationDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : "N/A"}
                        </Typography>
                      </Box>
                    </Box>

                    {/* Transfer Button */}
                    {canTransfer && (
                      <Button
                        variant="contained"
                        color="success"
                        fullWidth
                        sx={{ fontWeight: 700, borderRadius: 2, textTransform: 'none', py: 1.3, fontSize: 14, mt: 0.5, background: '#4caf50', '&:hover': { background: '#388e3c' } }}
                        onClick={() => {
                          setTransferAmount((e.amount * 0.02).toFixed(2));
                          setTransferDialogOpen(true);
                        }}
                      >
                        Transfer to E-Wallet
                      </Button>
                    )}
                  </Box>
                );
              })}
          </Box>
        ) : (
          <Box sx={{ textAlign: 'center', py: 5 }}>
            <Box sx={{ fontSize: 48, mb: 2, opacity: 0.6 }}>📊</Box>
            <Typography sx={{ color: '#90caf9', fontWeight: 600, fontSize: 15, mb: 0.8 }}>
              No Passive Income Yet
            </Typography>
            <Typography sx={{ color: '#b0bec5', fontSize: 12, lineHeight: 1.6 }}>
              Complete payback entries to start<br />earning 2% profit
            </Typography>
          </Box>
        )}
      </DialogContent>
      {/* Removed: Close button at the bottom, replaced by X icon at top right */}
    </Dialog>
  );
};

export default PassiveIncomeEarn;
