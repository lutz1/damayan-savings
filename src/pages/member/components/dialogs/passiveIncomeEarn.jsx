import React from "react";
import {
  Dialog,
  DialogContent,
  Button,
  Box,
  Typography,
  CircularProgress
} from "@mui/material";

const PassiveIncomeEarn = ({ open, onClose, paybackEntries, setTransferAmount, setTransferDialogOpen, loadingTransferId }) => {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { background: `linear-gradient(120deg, rgba(30, 41, 59, 0.95), rgba(33, 47, 61, 0.9))`, backdropFilter: "blur(14px)", border: `1px solid rgba(79, 195, 247, 0.2)`, borderRadius: 2, boxShadow: '0 4px 24px rgba(0,0,0,0.3)', overflow: 'hidden', maxWidth: { xs: '100%', sm: 500, md: 500 } } }}>
      {/* Reduced header with X button */}
      <Box sx={{
        bgcolor: 'rgba(31, 150, 243, 0.15)',
        color: '#4FC3F7',
        px: { xs: 1.5, sm: 2 },
        py: 1.2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        position: 'relative',
        zIndex: 1,
        borderBottom: '1px solid rgba(79, 195, 247, 0.2)',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
          <Box sx={{ fontSize: 24, mb: 0 }}>📈</Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, fontSize: 14, letterSpacing: 0.3, color: '#4FC3F7', textShadow: '0 2px 12px rgba(0,0,0,0.3)' }}>
            Passive Income Earn
          </Typography>
        </Box>
        <Button
          onClick={onClose}
          sx={{ minWidth: 0, p: 0.3, color: '#4FC3F7', bgcolor: 'transparent', '&:hover': { bgcolor: 'rgba(79, 195, 247, 0.15)' } }}
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </Button>
      </Box>
      <DialogContent
        dividers
        sx={{
          px: { xs: 1.2, sm: 2 },
          py: 1.2,
          background: 'transparent',
          position: 'relative',
          minHeight: 160,
          borderBottomLeftRadius: 2,
          borderBottomRightRadius: 2,
          zIndex: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          overflowX: 'hidden',
          borderTop: 'none',
        }}
      >
        {paybackEntries.length > 0 ? (
          <Box
            sx={{
              width: '100%',
              maxWidth: 560,
              mx: 'auto',
              maxHeight: 320,
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
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 1,
                      p: 1,
                      mb: 0.7,
                      borderRadius: 1.5,
                      background: 'rgba(33, 47, 61, 0.6)',
                      border: '1px solid rgba(79, 195, 247, 0.2)',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                        background: 'rgba(33, 47, 61, 0.8)',
                        border: '1px solid rgba(79, 195, 247, 0.4)',
                        boxShadow: '0 4px 12px rgba(79, 195, 247, 0.15)',
                      },
                    }}
                  >
                    {/* Amount */}
                    <Box sx={{ minWidth: 'auto', flex: 0 }}>
                      <Typography sx={{ fontWeight: 800, fontSize: 20, color: '#4FC3F7', lineHeight: 1 }}>
                        ₱{profit.toFixed(0)}
                      </Typography>
                    </Box>
                    
                    {/* Dates compact */}
                    <Box sx={{ display: 'flex', gap: 0.8, flex: 1, justifyContent: 'center', fontSize: 10, color: '#b0bec5' }}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography sx={{ fontSize: 8, color: '#90CAF9', fontWeight: 600, mb: 0.1 }}>Made</Typography>
                        <Typography sx={{ fontSize: 11 }}>
                          {(() => {
                            const val = e.createdAt || e.created;
                            if (!val) return 'N/A';
                            if (typeof val === 'string') {
                              const d = new Date(val);
                              return isNaN(d) ? val : d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
                            }
                            if (val.toDate) return val.toDate().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
                            if (val instanceof Date) return val.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
                            return 'N/A';
                          })()}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography sx={{ fontSize: 8, color: '#90CAF9', fontWeight: 600, mb: 0.1 }}>Release</Typography>
                        <Typography sx={{ fontSize: 11 }}>
                          {expirationDate ? expirationDate.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }) : "N/A"}
                        </Typography>
                      </Box>
                    </Box>
                    
                    {/* Status badge compact */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, px: 0.8, py: 0.3, borderRadius: 1, background: `${statusColor}15`, border: `1px solid ${statusColor}40`, minWidth: 'fit-content', flex: 0 }}>
                      <Typography sx={{ fontSize: 12, color: statusColor, fontWeight: 600 }}>{statusIcon}</Typography>
                      <Typography sx={{ fontSize: 9, color: statusColor, fontWeight: 600, letterSpacing: 0.2 }}>
                        {statusLabel}
                      </Typography>
                    </Box>
                    {/* Transfer Button */}
                    {canTransfer && (
                      <Button
                        variant="contained"
                        size="small"
                        disabled={loadingTransferId === e.id}
                        sx={{ fontWeight: 700, borderRadius: 1, textTransform: 'none', py: 0.5, px: 1, fontSize: 10, bgcolor: '#4CAF50', color: '#fff', minWidth: 'fit-content', flex: 0, whiteSpace: 'nowrap', '&:hover': { bgcolor: '#388e3c' }, '&:disabled': { bgcolor: 'rgba(76, 175, 80, 0.5)', color: 'rgba(255,255,255,0.7)' } }}
                        onClick={() => {
                          setTransferAmount((e.amount * 0.02).toFixed(2));
                          setTransferDialogOpen(true);
                        }}
                      >
                        {loadingTransferId === e.id ? (
                          <CircularProgress size={12} color="inherit" sx={{ mr: 0.5 }} />
                        ) : null}
                        {loadingTransferId === e.id ? 'Processing...' : 'Transfer'}
                      </Button>
                    )}
                  </Box>
                );
              })}
          </Box>
        ) : (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Box sx={{ fontSize: 36, mb: 1, opacity: 0.6 }}>📊</Box>
            <Typography sx={{ color: '#4FC3F7', fontWeight: 600, fontSize: 13, mb: 0.4 }}>
              No Passive Income
            </Typography>
            <Typography sx={{ color: '#b0bec5', fontSize: 10, lineHeight: 1.4 }}>
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
