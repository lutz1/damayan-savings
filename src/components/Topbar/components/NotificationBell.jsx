import React, { useState, useEffect } from "react";
import { IconButton, Badge, Tooltip, Popover, Box, Typography, Fade } from "@mui/material";
import DoneAllIcon from '@mui/icons-material/DoneAll';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import DeleteIcon from '@mui/icons-material/Delete';
import NotificationsIcon from "@mui/icons-material/Notifications";
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db, auth } from "../../../firebase";

const NotificationBell = ({ onReferralTransferClick, onOverrideTransferClick }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [markAllLoading, setMarkAllLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    let unsubscribe = null;
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        const q = query(
          collection(db, "notifications"),
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc")
        );
        unsubscribe = onSnapshot(q, (snap) => {
          const notifs = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
          setNotifications(notifs);
          setUnreadCount(notifs.filter((n) => !n.read).length);
        });
      }
    });
    return () => {
      if (unsubscribe) unsubscribe();
      unsubscribeAuth();
    };
  }, []);

  const handleOpen = (event) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);
  const open = Boolean(anchorEl);

  return (
    <>
      <Tooltip title="Notifications" arrow>
        <IconButton color="inherit" onClick={handleOpen} size="large" sx={{
          bgcolor: open ? 'rgba(255,255,255,0.10)' : 'transparent',
          border: open ? '1.5px solid #FFD54F' : 'none',
          transition: 'all 0.2s',
        }}>
          <Badge badgeContent={unreadCount} color="error" max={99} sx={{
            '& .MuiBadge-badge': {
              fontWeight: 700,
              fontSize: 12,
              boxShadow: '0 2px 8px 0 rgba(255,213,79,0.15)',
            }
          }}>
            <NotificationsIcon sx={{ color: open ? '#FFD54F' : '#fff', fontSize: 26 }} />
          </Badge>
        </IconButton>
      </Tooltip>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        TransitionComponent={Fade}
        PaperProps={{
          sx: {
            mt: 1,
            minWidth: 320,
            maxWidth: 380,
            background: 'rgba(30,41,59,0.97)',
            color: '#fff',
            borderRadius: 3,
            boxShadow: '0 8px 32px 0 rgba(31,38,135,0.37)',
            border: '1.5px solid #FFD54F',
            p: 0,
          }
        }}
      >
        <Box px={2} py={1.5} sx={{ borderBottom: '1px solid rgba(255,255,255,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#FFD54F', letterSpacing: 0.5 }}>
            Notifications
          </Typography>
          <button
            disabled={selectedIds.length === 0 || markAllLoading}
            onClick={async () => {
              setMarkAllLoading(true);
              try {
                for (const id of selectedIds) {
                  await deleteDoc(doc(db, "notifications", id));
                }
                setSelectedIds([]);
              } catch (e) { /* ignore */ }
              setMarkAllLoading(false);
            }}
            style={{ background: '#FFD54F', color: '#222', border: 'none', borderRadius: 4, padding: '4px 12px', fontWeight: 600, cursor: selectedIds.length === 0 ? 'default' : 'pointer', opacity: selectedIds.length === 0 ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <DeleteIcon fontSize="small" style={{ marginRight: 4 }} /> Delete selected
          </button>
        </Box>
        <Box sx={{ maxHeight: 340, overflowY: 'auto', p: 0 }}>
          {notifications.length === 0 ? (
            <Box px={2} py={2}>
              <Typography variant="body2" sx={{ color: '#FFD54F', opacity: 0.8 }}>
                No notifications
              </Typography>
            </Box>
          ) : (
            notifications.slice(0, 8).map((notif) => {
              return (
                <Box
                  key={notif.id}
                  sx={{
                    px: 2,
                    py: 1.2,
                    background: !notif.read ? 'rgba(255,213,79,0.08)' : 'transparent',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    cursor: notif.read ? 'default' : 'pointer',
                    transition: 'background 0.2s',
                    opacity: notif.read ? 0.6 : 1,
                    pointerEvents: notif.read ? 'none' : 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    '&:hover': { background: !notif.read ? 'rgba(255,213,79,0.15)' : 'transparent' },
                  }}
                  onClick={notif.read ? undefined : async (e) => {
                    // If the click originated from the checkbox, do nothing
                    if (e.target.type === 'checkbox') return;
                    handleClose();
                    // Mark as read in Firestore
                    if (!notif.read) {
                      try {
                        await updateDoc(doc(db, "notifications", notif.id), { read: true });
                      } catch (e) { /* ignore */ }
                    }
                    if (notif.type === 'referral-transfer' && typeof onReferralTransferClick === 'function') {
                      onReferralTransferClick();
                    }
                    if (notif.type === 'override-transfer' && typeof onOverrideTransferClick === 'function') {
                      onOverrideTransferClick();
                    }
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(notif.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      setSelectedIds((prev) =>
                        e.target.checked
                          ? [...prev, notif.id]
                          : prev.filter((id) => id !== notif.id)
                      );
                    }}
                    style={{ marginRight: 8 }}
                  />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2" fontWeight={notif.read ? 500 : 700} sx={{ color: notif.read ? '#fff' : '#FFD54F', fontSize: 14, mb: 0.2 }}>
                      {notif.title || notif.message || 'Notification'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#B3E5FC', opacity: 0.8 }}>
                      {notif.createdAt?.seconds
                        ? new Date(notif.createdAt.seconds * 1000).toLocaleString()
                        : ''}
                    </Typography>
                  </Box>
                </Box>
              );
            })
          )}
        </Box>
        <Box px={2} py={1} sx={{ borderTop: '1px solid rgba(255,255,255,0.10)', display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <input
            type="checkbox"
            id="mark-all-read"
            checked={unreadCount === 0}
            disabled={unreadCount === 0 || markAllLoading}
            onChange={async () => {
              setMarkAllLoading(true);
              try {
                const unread = notifications.filter(n => !n.read);
                for (const n of unread) {
                  await updateDoc(doc(db, "notifications", n.id), { read: true });
                }
              } catch (e) { /* ignore */ }
              setMarkAllLoading(false);
            }}
            style={{ marginRight: 8 }}
          />
          <label htmlFor="mark-all-read" style={{ color: '#FFD54F', fontSize: 13, cursor: unreadCount === 0 ? 'default' : 'pointer', opacity: unreadCount === 0 ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 4 }}>
            <DoneAllIcon fontSize="small" style={{ marginRight: 4 }} /> Mark all as read
          </label>

          <button
            disabled={notifications.length === 0 || markAllLoading}
            onClick={async () => {
              setMarkAllLoading(true);
              try {
                for (const n of notifications) {
                  await deleteDoc(doc(db, "notifications", n.id));
                }
              } catch (e) { /* ignore */ }
              setMarkAllLoading(false);
            }}
            style={{ marginLeft: 16, background: '#FFD54F', color: '#222', border: 'none', borderRadius: 4, padding: '4px 12px', fontWeight: 600, cursor: notifications.length === 0 ? 'default' : 'pointer', opacity: notifications.length === 0 ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <DeleteSweepIcon fontSize="small" style={{ marginRight: 4 }} /> Delete all
          </button>
        </Box>
        {notifications.length > 8 && (
          <Box px={2} py={1} textAlign="center">
            <Typography variant="caption" sx={{ color: '#FFD54F', opacity: 0.8 }}>
              View all...
            </Typography>
          </Box>
        )}
      </Popover>
    </>
  );
};

export default NotificationBell;
