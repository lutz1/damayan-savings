
import React, { useEffect, useState, useMemo } from "react";
import {
  Box,
  Typography,
  Button,
  TextField,
  CircularProgress,
  Toolbar,
  InputAdornment,
  IconButton,
  Drawer,
  useMediaQuery,
} from "@mui/material";
import SearchIcon from '@mui/icons-material/Search';
import { useTheme } from "@mui/material/styles";
import { db } from "../../firebase";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import AppBottomNav from "../../components/AppBottomNav";
import Topbar from "../../components/Topbar";
import AdminSidebarToggle from "../../components/AdminSidebarToggle";
import bgImage from "../../assets/bg.jpg";

const getStatusColor = (expirationDate) => {
  const now = new Date();
  const exp = new Date(expirationDate);
  const diff = (exp - now) / (1000 * 60 * 60 * 24);
  if (diff < 0) return "#e53935"; // Expired - Red
  if (diff <= 2) return "#ffb300"; // Expiring soon - Yellow
  return "#1976d2"; // Normal
};


const AdminPaybackEntries = () => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [emailMsg, setEmailMsg] = useState({});
  const [sending, setSending] = useState({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [holdLoading, setHoldLoading] = useState({});
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  useEffect(() => setSidebarOpen(!isMobile), [isMobile]);
  // Filtered entries by search (username, email)
  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      const userStr = (e.user?.name || e.user?.username || e.userId || "")?.toLowerCase();
      const emailStr = (e.user?.email || "")?.toLowerCase();
      const searchStr = search.toLowerCase();
      return userStr.includes(searchStr) || emailStr.includes(searchStr);
    });
  }, [entries, search]);

  // Totals
  const totalAmount = filteredEntries.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalProfit = filteredEntries.reduce((sum, e) => sum + ((e.amount || 0) * 0.02), 0);

  // Find users with 3+ months delayed
  const delayedUsers = useMemo(() => {
    const now = new Date();
    return entries.filter(e => {
      if (!e.expirationDate) return false;
      const exp = new Date(e.expirationDate);
      const diffMonths = (now - exp) / (1000 * 60 * 60 * 24 * 30.44);
      return diffMonths >= 3 && !(e.user?.accountHold);
    });
  }, [entries]);

  // Hold account handler
  const handleHoldAccount = async (entry) => {
    setHoldLoading(prev => ({ ...prev, [entry.userId]: true }));
    try {
      // Update user document in Firestore
      await fetch(`/api/hold-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: entry.userId }),
      });
      alert('Account held successfully!');
      // Update local state
      setEntries(prev => prev.map(e => e.userId === entry.userId ? { ...e, user: { ...e.user, accountHold: true } } : e));
    } catch (err) {
      alert('Error holding account: ' + err.message);
    }
    setHoldLoading(prev => ({ ...prev, [entry.userId]: false }));
  };

  useEffect(() => {
    const fetchEntries = async () => {
      setLoading(true);
      const snap = await getDocs(collection(db, "paybackEntries"));
      const data = [];
      for (const docSnap of snap.docs) {
        const entry = docSnap.data();
        entry.id = docSnap.id;
        // Get user info
        const userSnap = await getDoc(doc(db, "users", entry.userId));
        entry.user = userSnap.exists() ? userSnap.data() : {};
        data.push(entry);
      }
      setEntries(data);
      setLoading(false);
    };
    fetchEntries();
  }, []);

  const handleSendEmail = async (entry) => {
    setSending((prev) => ({ ...prev, [entry.id]: true }));
    try {
      const res = await fetch("/api/send-payback-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: entry.userId,
          paybackEntryId: entry.id,
          subject: "Payback Entry Notification",
          message: emailMsg[entry.id] || "",
        }),
      });
      if (!res.ok) throw new Error("Failed to send email");
      alert("Email sent!");
      setEmailMsg((prev) => ({ ...prev, [entry.id]: "" }));
    } catch (err) {
      alert("Error: " + err.message);
    }
    setSending((prev) => ({ ...prev, [entry.id]: false }));
  };

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        backgroundImage: `linear-gradient(120deg, rgba(30, 41, 59, 0.92) 60%, rgba(33, 150, 243, 0.25)), url(${bgImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
        position: "relative",
        flexDirection: "column",
      }}
    >
      <Box sx={{ position: "fixed", width: "100%", zIndex: 1200 }}>
        <Topbar open={sidebarOpen} onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />
      </Box>
      <Toolbar />

      {!isMobile && (
        <AppBottomNav open={sidebarOpen} onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />
      )}

      {isMobile && (
        <>
          <AdminSidebarToggle onClick={() => setSidebarOpen((prev) => !prev)} />
          <Drawer
            anchor="left"
            open={sidebarOpen}
            onClose={() => setSidebarOpen((prev) => !prev)}
            ModalProps={{ keepMounted: true }}
            PaperProps={{
              sx: {
                background: "transparent",
                boxShadow: "none",
              },
            }}
          >
            <AppBottomNav layout="sidebar" open={sidebarOpen} onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />
          </Drawer>
        </>
      )}

      <Box sx={{ flex: 1, p: { xs: 1.5, md: 4 }, pt: { xs: 2, md: 4 }, maxWidth: 1400, mx: "auto", width: "100%", paddingLeft: isMobile ? 0 : sidebarOpen ? 280 : 0, transition: "all 0.3s ease" }}>
        <Typography variant="h4" sx={{ mb: 3, fontWeight: 800, color: "#fff", textShadow: "1px 1px 8px #000" }}>
          All Payback Entries
        </Typography>
        {/* 3 Months Delayed Section */}
        {delayedUsers.length > 0 && (
          <Box sx={{ mb: 3, background: 'rgba(229,57,53,0.13)', borderRadius: 3, p: 2, boxShadow: '0 2px 8px 0 #e5393522' }}>
            <Typography variant="h6" sx={{ color: '#e53935', fontWeight: 700, mb: 1 }}>
              3+ Months Delayed Accounts
            </Typography>
            {delayedUsers.map((entry) => (
              <Box key={entry.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Box>
                  <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>
                    User: {entry.user?.name || entry.user?.username || entry.userId}
                  </Typography>
                  <Typography sx={{ color: '#e3eaf7', fontWeight: 400, fontSize: 13 }}>
                    Email: {entry.user?.email || '-'}
                  </Typography>
                  <Typography sx={{ color: '#e53935', fontWeight: 500, fontSize: 13 }}>
                    Expired: {entry.expirationDate ? new Date(entry.expirationDate).toLocaleDateString() : '-'}
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  color="error"
                  disabled={holdLoading[entry.userId] || entry.user?.accountHold}
                  onClick={() => handleHoldAccount(entry)}
                  sx={{ fontWeight: 700, ml: 2 }}
                >
                  {holdLoading[entry.userId] ? 'Holding...' : entry.user?.accountHold ? 'Account Held' : 'Hold Account'}
                </Button>
              </Box>
            ))}
          </Box>
        )}
        {/* Search and Totals */}
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, mb: 2, alignItems: 'center' }}>
          <TextField
            variant="outlined"
            size="small"
            placeholder="Search by username or email"
            value={search}
            onChange={e => setSearch(e.target.value)}
            sx={{ minWidth: 220, maxWidth: 320 }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton>
                    <SearchIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <Typography sx={{ color: '#90caf9', fontWeight: 600, fontSize: 15 }}>
              Total Amount: ₱{totalAmount.toFixed(2)}
            </Typography>
            <Typography sx={{ color: '#81C784', fontWeight: 600, fontSize: 15 }}>
              Total 2% Profit: ₱{totalProfit.toFixed(2)}
            </Typography>
          </Box>
        </Box>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 200 }}>
            <CircularProgress color="info" />
          </Box>
        ) : (
          <Box
            sx={{
              background: 'linear-gradient(120deg, rgba(30,41,59,0.92) 60%, rgba(33,150,243,0.18))',
              borderRadius: 4,
              p: { xs: 2, sm: 3 },
              minHeight: 320,
              width: '100%',
              maxWidth: 900,
              boxShadow: '0 2px 16px 0 rgba(33,150,243,0.07)',
              mb: 4,
              mx: 'auto',
              height: { xs: '60vh', sm: '65vh', md: '70vh', lg: '75vh' },
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#1976d2', mb: 2, letterSpacing: 0.5, fontSize: 22 }}>
              Payback Entries
            </Typography>
            {filteredEntries.length === 0 ? (
              <Box display="flex" alignItems="center" justifyContent="center" height="80px">
                <Typography variant="h6" color="text.secondary" sx={{ fontSize: 16 }}>
                  No payback entries found.
                </Typography>
              </Box>
            ) : (
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
                {filteredEntries.map((entry, idx) => {
                  const color = getStatusColor(entry.expirationDate);
                  const isExpiring = color === "#ffb300";
                  const isExpired = color === "#e53935";
                  return (
                    <Box
                      key={entry.id}
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
                        User: {entry.user?.name || entry.user?.username || entry.userId}
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 0.5 }}>
                        <Typography sx={{ color: '#90caf9', fontWeight: 600, fontSize: 15, minWidth: 120 }}>
                          Amount: ₱{Number(entry.amount).toFixed(2)}
                        </Typography>
                        <Typography sx={{ color: '#b2dfdb', fontWeight: 500, fontSize: 14, minWidth: 120 }}>
                          Created: {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : '-'}
                        </Typography>
                        <Typography sx={{ color: '#b2dfdb', fontWeight: 500, fontSize: 14, minWidth: 120 }}>
                          Expiration: {entry.expirationDate ? new Date(entry.expirationDate).toLocaleDateString() : '-'}
                        </Typography>
                        <Typography sx={{ color: '#81C784', fontWeight: 600, fontSize: 15, minWidth: 120 }}>
                          2% Profit: ₱{(entry.amount * 0.02).toFixed(2)}
                        </Typography>
                        <Typography sx={{ color: '#90caf9', fontWeight: 500, fontSize: 14, minWidth: 180 }}>
                          Email: {entry.user?.email || '-'}
                        </Typography>
                      </Box>
                      {/* Hold Account Button for 3+ months delayed */}
                      {((new Date() - new Date(entry.expirationDate)) / (1000 * 60 * 60 * 24 * 30.44) >= 3 && !entry.user?.accountHold) && (
                        <Button
                          variant="contained"
                          color="error"
                          disabled={holdLoading[entry.userId]}
                          onClick={() => handleHoldAccount(entry)}
                          sx={{ fontWeight: 700, mt: 1, maxWidth: 180 }}
                        >
                          {holdLoading[entry.userId] ? 'Holding...' : 'Hold Account'}
                        </Button>
                      )}
                      {(isExpiring || isExpired) && (
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: 220, maxWidth: 320, mt: 1 }}>
                          <TextField
                            label="Email Announcement"
                            multiline
                            minRows={2}
                            fullWidth
                            value={emailMsg[entry.id] || ""}
                            onChange={(e) => setEmailMsg((prev) => ({ ...prev, [entry.id]: e.target.value }))}
                            sx={{ mb: 1, '& .MuiInputBase-root': { color: '#fff' }, '& .MuiInputLabel-root': { color: '#e3eaf7' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#3a5a8c' }, background: 'rgba(33,150,243,0.10)' }}
                          />
                          <Button
                            variant="contained"
                            color={isExpired ? "error" : "warning"}
                            disabled={sending[entry.id]}
                            onClick={() => handleSendEmail(entry)}
                            sx={{ fontWeight: 700, boxShadow: "0 2px 8px 0 rgba(229,115,115,0.10)" }}
                          >
                            {sending[entry.id] ? "Sending..." : "Send Email"}
                          </Button>
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>
        )}
      </Box>
      <Box sx={{ height: isMobile ? 0 : 80 }} />
    </Box>
  );
};

export default AdminPaybackEntries;
