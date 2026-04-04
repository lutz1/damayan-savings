import OverrideUplineRewardsDialog from "./components/dialogs/OverrideUplineRewardsDialog";
import RewardHistoryDialog from "./components/dialogs/RewardHistoryDialog";
/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { sendReferralTransferAvailableNotification } from "../../utils/referralNotifications";
import { sendOverrideTransferAvailableNotification } from "../../utils/overrideNotifications";
import { cleanupOldNotifications } from "../../utils/notifications";
import { syncAppBadgeCount } from "../../utils/appBadge";
import { memberPageTopInset, memberShellBackground, memberSoftPanelSx, memberGlassPanelSx, memberHeroBackground } from "./memberLayout";
import Alert from "@mui/material/Alert";
import {
  Box,
  Avatar,
  Toolbar,
  Typography,
  CircularProgress,
  Skeleton,
  Grid,
  Card,
  CardContent,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  TextField,
  MenuItem,
  Badge,
  Chip,
  Snackbar,
  Drawer,
  Divider,
  Tooltip,
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import SortIcon from "@mui/icons-material/Sort";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import SendMoneyIcon from "@mui/icons-material/Send";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import MonetizationOnIcon from "@mui/icons-material/MonetizationOn";
import PaymentIcon from "@mui/icons-material/Payment";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import HistoryIcon from "@mui/icons-material/History";
import CallReceivedIcon from "@mui/icons-material/CallReceived";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CelebrationIcon from "@mui/icons-material/Celebration";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ShareIcon from "@mui/icons-material/Share";
import HomeIcon from "@mui/icons-material/Home";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import RedeemIcon from "@mui/icons-material/Redeem";
import StorefrontIcon from "@mui/icons-material/Storefront";
import PersonIcon from "@mui/icons-material/Person";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import QueryStatsIcon from "@mui/icons-material/QueryStats";
import PersonPinIcon from "@mui/icons-material/PersonPin";
import TransferFundsDialog from "../../components/Topbar/dialogs/TransferFundsDialog";
import WithdrawDialog from "../../components/Topbar/dialogs/WithdrawDialog";
import PurchaseCodesDialog from "../../components/Topbar/dialogs/PurchaseCodesDialog";
import InviteEarnDialog from "../../components/Topbar/dialogs/InviteEarnDialog";
import EwalletHistoryDialog from "../../components/Topbar/dialogs/EwalletHistoryDialog";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  runTransaction
} from "firebase/firestore";
import { auth, db } from "../../firebase";
import { getUserAvatarInitial, getUserAvatarUrl } from "../../utils/userAvatar";
import { motion } from "framer-motion";
import NetworkGroupSales from "./components/dialogs/networkGroupsales";

const MemberDashboard = () => {
    const memberPalette = {
      navy: "#0b1f5e",
      royal: "#173a8a",
      cobalt: "#2156c9",
      white: "#ffffff",
      gold: "#d4af37",
      softGold: "#f2de9c",
      surface: "#f7f9fc",
      mist: "#eef3ff",
      slate: "#50607a",
      ink: "#191c1e",
    };

    const toAmountNumber = (value) => {
      if (typeof value === "number") return Number.isFinite(value) ? value : 0;
      if (typeof value === "string") {
        const normalized = value.replace(/[^0-9.-]/g, "");
        const parsed = parseFloat(normalized);
        return Number.isFinite(parsed) ? parsed : 0;
      }
      return 0;
    };

    // Animated count-up states for card values
    const [displayContribution, setDisplayContribution] = useState(0);
    const [displayCapitalShare, setDisplayCapitalShare] = useState(0);
    const [displayEarnings, setDisplayEarnings] = useState(0);
    const [displayOverride, setDisplayOverride] = useState(0);
    const [totalContribution, setTotalContribution] = useState(0);
    const [totalCapitalShare, setTotalCapitalShare] = useState(0);
    const [totalEarnings, setTotalEarnings] = useState(0);
    const [overrideEarnings, setOverrideEarnings] = useState(0);

    // Animate count-up for each card value
    useEffect(() => {
      let frame;
      let start = 100;
      let end = totalContribution;
      let duration = 800;
      let startTime;
      function animate(ts) {
        if (!startTime) startTime = ts;
        const progress = Math.min((ts - startTime) / duration, 1);
        const value = start + (end - start) * progress;
        setDisplayContribution(progress === 1 ? Math.round(end) : value);
        if (progress < 1) frame = requestAnimationFrame(animate);
      }
      if (start !== end) frame = requestAnimationFrame(animate);
      return () => frame && cancelAnimationFrame(frame);
    }, [totalContribution]);

    useEffect(() => {
      let frame;
      let start = 100;
      let end = totalCapitalShare;
      let duration = 800;
      let startTime;
      function animate(ts) {
        if (!startTime) startTime = ts;
        const progress = Math.min((ts - startTime) / duration, 1);
        const value = start + (end - start) * progress;
        setDisplayCapitalShare(progress === 1 ? Math.round(end) : value);
        if (progress < 1) frame = requestAnimationFrame(animate);
      }
      if (start !== end) frame = requestAnimationFrame(animate);
      return () => frame && cancelAnimationFrame(frame);
    }, [totalCapitalShare]);

    useEffect(() => {
      let frame;
      let start = 100;
      let end = totalEarnings;
      let duration = 800;
      let startTime;
      function animate(ts) {
        if (!startTime) startTime = ts;
        const progress = Math.min((ts - startTime) / duration, 1);
        const value = start + (end - start) * progress;
        setDisplayEarnings(progress === 1 ? Math.round(end) : value);
        if (progress < 1) frame = requestAnimationFrame(animate);
      }
      if (start !== end) frame = requestAnimationFrame(animate);
      return () => frame && cancelAnimationFrame(frame);
    }, [totalEarnings]);

    useEffect(() => {
      let frame;
      let start = 100;
      let end = overrideEarnings;
      let duration = 800;
      let startTime;
      function animate(ts) {
        if (!startTime) startTime = ts;
        const progress = Math.min((ts - startTime) / duration, 1);
        const value = start + (end - start) * progress;
        setDisplayOverride(progress === 1 ? Math.round(end) : value);
        if (progress < 1) frame = requestAnimationFrame(animate);
      }
      if (start !== end) frame = requestAnimationFrame(animate);
      return () => frame && cancelAnimationFrame(frame);
    }, [overrideEarnings]);
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [roleCounts, setRoleCounts] = useState({
    MD: 0,
    MS: 0,
    MI: 0,
    Agent: 0,
  });

  const [referrals, setReferrals] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedRole, setSelectedRole] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");

  // 💸 Referral Rewards
  const [rewardHistory, setRewardHistory] = useState([]);
  const notifiedRef = useRef(false);
const [rewardDialogOpen, setRewardDialogOpen] = useState(false);

// 💰 Override Earnings
const [overrideList, setOverrideList] = useState([]);
const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);

const [loadingTransfer, setLoadingTransfer] = useState(false);

const [groupSalesOpen, setGroupSalesOpen] = useState(false);

// Member dashboard wallet state
const [eWallet, setEWallet] = useState(0);
const [showBalance, setShowBalance] = useState(false);
const [dashDialog, setDashDialog] = useState(null);
const [availableCodes, setAvailableCodes] = useState([]);
const [rewardsUnavailableOpen, setRewardsUnavailableOpen] = useState(false);
const navigate = useNavigate();

// ─── Notifications ───────────────────────────────────────────────────────────
const [notifDrawerOpen, setNotifDrawerOpen] = useState(false);
const [notifications, setNotifications] = useState([]);
const [unreadCount, setUnreadCount] = useState(0);

useEffect(() => {
  syncAppBadgeCount(unreadCount);
}, [unreadCount]);

useEffect(() => {
  if (!user) return;

  const q = query(
    collection(db, "notifications"),
    where("userId", "==", user.uid)
  );

  const unsub = onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setNotifications(items);
      setUnreadCount(items.filter((n) => !n.read).length);
    },
    () => {}
  );

  return () => unsub();
}, [user]);

const handleOpenNotifications = () => {
  setNotifDrawerOpen(true);
  // Mark all as read in Firestore
  if (user) {
    notifications
      .filter((n) => !n.read)
      .forEach((n) => {
        updateDoc(doc(db, "notifications", n.id), { read: true }).catch(() => {});
      });
    setUnreadCount(0);
  }
};

const handleToggleSortOrder = () => {
  setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
};

const handleViewReferrals = (role) => {
  setSelectedRole(role);
  setOpenDialog(true);
};

const filteredReferrals = referrals
  .filter((ref) => {
    if (!selectedRole || ref.role !== selectedRole) return false;
    const name = (ref.name || "").toLowerCase();
    const username = (ref.username || "").toLowerCase();
    const term = searchTerm.toLowerCase();
    return name.includes(term) || username.includes(term);
  })
  .sort((a, b) => {
    const aVal = (a?.[sortField] || "").toString().toLowerCase();
    const bVal = (b?.[sortField] || "").toString().toLowerCase();
    if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
    if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });

useEffect(() => {
  let unsubscribeUser = null;
  let unsubscribeReferrals = null;
  let unsubscribeCodes = null;
  let unsubscribeCapital = null;
  let unsubscribePayback = null;

  const resetRoleCounts = () => {
    setRoleCounts({ MD: 0, MS: 0, MI: 0, Agent: 0 });
  };

  const normalizeRole = (rawRole) => {
    const upper = String(rawRole || "").trim().toUpperCase();

    if (upper === "MASTERMD" || upper === "MMD" || upper === "MANAGINGDIRECTOR" || upper === "MANAGING DIRECTOR") return "MD";
    if (upper === "MD") return "MD";

    if (upper === "MARKETINGSPECIALIST" || upper === "MARKETING SPECIALIST") return "MS";
    if (upper === "MS") return "MS";

    if (upper === "MARKETINGINFLUENCER" || upper === "MARKETING INFLUENCER") return "MI";
    if (upper === "MI") return "MI";

    return "Agent";
  };

  const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
    if (!currentUser) {
      setUser(null);
      setUserData(null);
      setReferrals([]);
      resetRoleCounts();
      setEWallet(0);
      setTotalContribution(0);
      setTotalCapitalShare(0);
      setAvailableCodes([]);
      setLoading(false);
      return;
    }

    setUser(currentUser);
    setLoading(true);
    cleanupOldNotifications(currentUser.uid).catch(() => {});

    if (unsubscribeUser) unsubscribeUser();
    if (unsubscribeReferrals) unsubscribeReferrals();
    if (unsubscribeCodes) unsubscribeCodes();
    if (unsubscribeCapital) unsubscribeCapital();
    if (unsubscribePayback) unsubscribePayback();

    const userRef = doc(db, "users", currentUser.uid);
    unsubscribeUser = onSnapshot(
      userRef,
      (userSnap) => {
        if (!userSnap.exists()) {
          setUserData(null);
          setLoading(false);
          return;
        }

        const data = userSnap.data() || {};
        setUserData({ id: userSnap.id, ...data });
        setEWallet(Number(data.eWallet) || 0);
        setLoading(false);

        if (unsubscribeReferrals) {
          unsubscribeReferrals();
          unsubscribeReferrals = null;
        }

        const username = String(data.username || "").trim();
        if (!username) {
          setReferrals([]);
          resetRoleCounts();
          return;
        }

        const referralsQ = query(collection(db, "users"), where("referredBy", "==", username));
        unsubscribeReferrals = onSnapshot(
          referralsQ,
          (refSnap) => {
            const nextReferrals = refSnap.docs.map((refDoc) => {
              const refData = refDoc.data() || {};
              return {
                id: refDoc.id,
                name: refData.name || "",
                username: refData.username || "",
                email: refData.email || "",
                contactNumber: refData.contactNumber || "",
                profilePicture: getUserAvatarUrl(refData),
                role: normalizeRole(refData.role),
              };
            });

            const counts = { MD: 0, MS: 0, MI: 0, Agent: 0 };
            nextReferrals.forEach((ref) => {
              counts[ref.role] = (counts[ref.role] || 0) + 1;
            });

            setReferrals(nextReferrals);
            setRoleCounts(counts);
          },
          () => {
            setReferrals([]);
            resetRoleCounts();
          }
        );
      },
      () => {
        setLoading(false);
      }
    );

    const codesQ = query(
      collection(db, "purchaseCodes"),
      where("userId", "==", currentUser.uid),
      where("used", "==", false)
    );

    unsubscribeCodes = onSnapshot(
      codesQ,
      (snap) => {
        setAvailableCodes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      () => {
        setAvailableCodes([]);
      }
    );

    const capitalQ = query(collection(db, "capitalShareEntries"), where("userId", "==", currentUser.uid));
    unsubscribeCapital = onSnapshot(
      capitalQ,
      (snap) => {
        const total = snap.docs.reduce((sum, d) => sum + toAmountNumber(d.data()?.amount), 0);
        setTotalCapitalShare(total);
      },
      () => {
        setTotalCapitalShare(0);
      }
    );

    const paybackQ = query(collection(db, "paybackEntries"), where("userId", "==", currentUser.uid));
    unsubscribePayback = onSnapshot(
      paybackQ,
      (snap) => {
        const total = snap.docs.reduce((sum, d) => sum + toAmountNumber(d.data()?.amount), 0);
        setTotalContribution(total);
      },
      () => {
        setTotalContribution(0);
      }
    );
  });

  return () => {
    if (unsubscribeUser) unsubscribeUser();
    if (unsubscribeReferrals) unsubscribeReferrals();
    if (unsubscribeCodes) unsubscribeCodes();
    if (unsubscribeCapital) unsubscribeCapital();
    if (unsubscribePayback) unsubscribePayback();
    unsubscribeAuth();
  };
}, []);

const handleTransferToWallet = async ({ amount, type, rewardId = null }) => {
  if (!user) return;
  if (!amount || amount <= 0) return alert("No funds to transfer.");

  const confirmed = window.confirm(
    `Are you sure you want to transfer ₱${amount.toLocaleString()} to your eWallet?`
  );
  if (!confirmed) return;

  try {
    setLoadingTransfer(true);

    if (type === "referral") {
      if (rewardId) {
        // Single reward transfer via Cloud Function
        const idToken = await user.getIdToken();
        
        const response = await fetch("https://us-central1-amayan-savings.cloudfunctions.net/transferReferralReward", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            rewardId,
            amount: rewardHistory.find(r => r.id === rewardId)?.amount || amount,
            clientRequestId: `referral_${rewardId}`,
          }),
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Transfer failed");
      } else {
        // Bulk transfer for all approved rewards via Cloud Function
        const userRef = doc(db, "users", user.uid);
        const idToken = await user.getIdToken();

        let totalAmount = 0;
        const approvedRewards = rewardHistory.filter(r => r.payoutReleased && !r.transferredAmount);

        for (const reward of approvedRewards) {
          const response = await fetch("https://us-central1-amayan-savings.cloudfunctions.net/transferReferralReward", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              rewardId: reward.id,
              amount: reward.amount,
              clientRequestId: `referral_${reward.id}`,
            }),
          });

          const result = await response.json();
          if (!response.ok) throw new Error(result.error || "Transfer failed");
          totalAmount += reward.amount;
        }

        if (totalAmount === 0) throw new Error("No rewards to transfer.");
      }
    } else if (type === "override") {
      if (rewardId) {
        const idToken = await user.getIdToken();
        
        const response = await fetch("https://us-central1-amayan-savings.cloudfunctions.net/transferOverrideReward", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${idToken}`,
          },
          body: JSON.stringify({ 
            overrideId: rewardId, 
            amount: amount || overrideList.find(o => o.id === rewardId)?.amount, 
            clientRequestId: `override_${rewardId}` 
          }),
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Transfer failed");
      } 
    }

    alert(`₱${amount.toLocaleString()} successfully transferred to eWallet!`);
  } catch (err) {
    console.error("Error transferring funds:", err);
    alert(err.message || "Failed to transfer funds.");
  } finally {
    setLoadingTransfer(false);
  }
};


// Listen for upline rewards where user is the upline
useEffect(() => {
  if (!user) return;

  // Listen to uplineRewards collection (₱65 from payback entries)
  const q1 = query(
    collection(db, "uplineRewards"),
    where("uplineId", "==", user.uid)
  );

  const unsubscribe1 = onSnapshot(q1, (snapshot) => {
    const uplineRewards = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      source: "uplineRewards", // Mark source for debugging
    }));

    // Listen to override collection (5% from capital share entries)
    const q2 = query(
      collection(db, "override"),
      where("uplineId", "==", user.uid)
    );

    const unsubscribe2 = onSnapshot(q2, (snapshot2) => {
      const overrideRewards = snapshot2.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        source: "override", // Mark source for debugging
      }));

      // Combine both reward types
      const allRewards = [...uplineRewards, ...overrideRewards];
      setOverrideList(allRewards);
    });

    return () => unsubscribe2();
  });

  return () => unsubscribe1();
}, [user]);


// Calculate upline reward earnings and send notification if claimable
const overrideNotifiedRef = useRef(false);
useEffect(() => {
  const now = new Date();
  
  // Calculate TOTAL from ALL rewards (for marketing purposes - show total earned, even if claimed)
  const total = overrideList.reduce((sum, reward) => {
    return sum + toAmountNumber(reward.amount);
  }, 0);
  
  setOverrideEarnings(total);

  // Notify if there are claimable rewards (dueDate/releaseDate passed and not claimed)
  let claimableTotal = 0;
  const hasClaimable = overrideList.some(reward => {
    let dueDate = reward.dueDate || reward.releaseDate;
    if (dueDate) {
      if (typeof dueDate === "object" && dueDate.seconds) {
        dueDate = new Date(dueDate.seconds * 1000);
      } else if (typeof dueDate === "string" || typeof dueDate === "number") {
        dueDate = new Date(dueDate);
      }
    }
    
    const isDue = dueDate && dueDate <= now;
    const isClaimed = reward.claimed || reward.status === "Credited";
    
    if (isDue && !isClaimed) {
      claimableTotal += toAmountNumber(reward.amount);
      return true;
    }
    return false;
  });
  
  if (hasClaimable && !overrideNotifiedRef.current && user) {
    sendOverrideTransferAvailableNotification(user.uid);
    overrideNotifiedRef.current = true;
  }
  if (!hasClaimable) {
    overrideNotifiedRef.current = false;
  }
}, [overrideList, user]);

  useEffect(() => {
    if (!user) return;

    // Query ALL rewards (both approved and pending approval)
    // to include System Bonus and other pending reward types
    const q = query(
      collection(db, "referralReward"),
      where("userId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const allRewards = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
      
      // Filter to show:
      // 1. All payoutReleased=true rewards (regardless of transferred status)
      // 2. All approved=true rewards (including pending payoutReleased)
      // 3. All System Bonus type rewards (even if not approved yet)
      const displayRewards = allRewards.filter(r => 
        r.payoutReleased === true || 
        r.approved === true || 
        r.type === "System Bonus"
      );
      
      // Filter out transferred rewards for the dialog (show only pending transfers)
      const pendingRewards = displayRewards.filter(r => !r.transferredAmount);
      setRewardHistory(pendingRewards);
      
      // Calculate total from ALL released rewards (including transferred ones)
      const total = allRewards.reduce((sum, r) => sum + toAmountNumber(r.amount), 0);
      setTotalEarnings(total);

      // Notify if there are available rewards to transfer and not already notified in this session
      const hasAvailable = pendingRewards.some(r => r.payoutReleased && !r.transferredAmount);
      if (hasAvailable && !notifiedRef.current) {
        await sendReferralTransferAvailableNotification(user.uid);
        notifiedRef.current = true;
      }
      if (!hasAvailable) {
        notifiedRef.current = false;
      }
    });

    return () => unsubscribe();
  }, [user]);

  const currentUserAvatar = getUserAvatarUrl(userData);
  const currentUserInitial = getUserAvatarInitial(userData);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: memberShellBackground,
        color: memberPalette.ink,
        pb: 14,
      }}
    >
      <Box sx={{ maxWidth: { xs: "100%", sm: 460 }, mx: "auto", px: { xs: 2.25, sm: 2.75 }, pt: { xs: memberPageTopInset, sm: 3 } }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2.6 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            {loading ? (
              <Skeleton variant="circular" width={42} height={42} />
            ) : (
              <Avatar
                onClick={() => navigate('/member/profile')}
                src={currentUserAvatar || undefined}
                sx={{
                  width: 42,
                  height: 42,
                  background: "linear-gradient(140deg, #e8edff 0%, #f6f8ff 100%)",
                  color: memberPalette.navy,
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 16,
                  border: "1px solid rgba(255,255,255,0.3)",
                  boxShadow: "0 8px 18px rgba(11,31,94,0.24)",
                  transition: "all 0.2s ease",
                  "&:hover": { transform: "scale(1.1)", boxShadow: "0 6px 16px rgba(11,31,94,0.24)" },
                }}
              >
                {currentUserInitial}
              </Avatar>
            )}
            <Box>
              <Typography sx={{ fontSize: 10, color: "rgba(255,255,255,0.78)", letterSpacing: 0.8, textTransform: "uppercase", fontWeight: 700, textShadow: "0 1px 4px rgba(11,31,94,0.45)" }}>
                Member hub
              </Typography>
              {loading ? (
                <Skeleton variant="text" width={140} height={32} sx={{ borderRadius: 1 }} />
              ) : (
                <Typography sx={{ fontSize: 21, color: "#ffffff", fontWeight: 800, lineHeight: 1.1, textShadow: "0 2px 8px rgba(11,31,94,0.45)" }}>
                  {userData?.name || userData?.username || "Member"}
                </Typography>
              )}
            </Box>
          </Box>
          <Tooltip title="Notifications">
            <IconButton onClick={handleOpenNotifications} sx={{ color: "#ffffff", textShadow: "0 1px 4px rgba(11,31,94,0.45)" }}>
              <Badge badgeContent={unreadCount > 0 ? unreadCount : null} color="error" max={9}
                sx={{ "& .MuiBadge-badge": { fontSize: 10, minWidth: 16, height: 16, top: 1, right: 1 } }}
              >
                {unreadCount > 0 ? <NotificationsActiveIcon /> : <NotificationsNoneIcon />}
              </Badge>
            </IconButton>
          </Tooltip>
        </Box>

        <Box
          sx={{
            background: memberHeroBackground,
            borderRadius: "32px 24px 30px 24px",
            border: "1px solid rgba(255,255,255,0.16)",
            p: { xs: 2.6, sm: 3.2 },
            color: "#fff",
            boxShadow: "0 22px 44px rgba(6, 18, 45, 0.28)",
            position: "relative",
            overflow: "hidden",
            mb: 3.2,
          }}
        >
          <Box
            sx={{
              position: "absolute",
              top: -50,
              right: -42,
              width: 170,
              height: 170,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.08)",
              filter: "blur(10px)",
            }}
          />
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background: "linear-gradient(120deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 32%)",
            }}
          />
          <Box sx={{ position: "relative", zIndex: 1 }}>
            <Typography sx={{ fontSize: 11, color: "rgba(255,255,255,0.72)", letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 800 }}>
              Wallet Overview
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mt: 0.8 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.6 }}>
                <Typography sx={{ fontSize: { xs: 29, sm: 33 }, fontWeight: 800, letterSpacing: -0.8, lineHeight: 1 }}>
                  {showBalance
                    ? `₱${(eWallet || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : "₱ ••••••"}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => setShowBalance((p) => !p)}
                  sx={{ color: "rgba(255,255,255,0.85)" }}
                >
                  {showBalance ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                </IconButton>
              </Box>
              <Button
                  onClick={() => navigate('/member/cash-in')}
                  sx={{
                    backgroundColor: "rgba(255,255,255,0.14)",
                    color: "#fff",
                    borderRadius: "999px",
                    border: "1px solid rgba(255,255,255,0.18)",
                    textTransform: "none",
                    fontSize: 12,
                    fontWeight: 700,
                    px: 2,
                    minWidth: "auto",
                    "&:hover": { backgroundColor: "rgba(255,255,255,0.22)" },
                  }}
                >
                  + Cash In
                </Button>
            </Box>

            <Box sx={{ mt: 2.4, p: 1.6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.10)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2 }}>
              <Box>
                <Typography sx={{ fontSize: 10, color: "rgba(255,255,255,0.76)", fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase" }}>Capital Share</Typography>
                <Typography sx={{ fontSize: 18, fontWeight: 800 }}>
                  ₱{Number(displayCapitalShare).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Typography>
              </Box>
              <Box sx={{ textAlign: "right" }}>
                <Typography sx={{ fontSize: 10, color: "rgba(255,255,255,0.76)", fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase" }}>Payback</Typography>
                <Typography sx={{ fontSize: 18, fontWeight: 800 }}>
                  ₱{Number(displayContribution).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>

        <Grid container spacing={1.6} sx={{ mb: 2.3 }}>
          {[
            { icon: <SendMoneyIcon />, label: "Send", dialog: "transfer" },
            { icon: <CallReceivedIcon />, label: "Withdraw", dialog: "withdraw" },
            { icon: <PaymentIcon />, label: "Purchase", dialog: "purchase" },
            { icon: <GroupAddIcon />, label: "Invite", dialog: "invite" },
            { icon: <HistoryIcon />, label: "History", dialog: "walletHistory" },
            { icon: <RedeemIcon />, label: "Rewards +", action: () => setRewardsUnavailableOpen(true) },
            { icon: <StorefrontIcon />, label: "Market Place", action: () => navigate('/member/marketplace') },
          ].map((action) => (
            <Grid item xs={3} key={action.label}>
              <Box
                onClick={() => (action.dialog ? setDashDialog(action.dialog) : action.action?.())}
                sx={{
                  textAlign: "center",
                  cursor: "pointer",
                  py: 1.2,
                  px: 0.5,
                  borderRadius: 3,
                  background: "linear-gradient(155deg, rgba(8,26,62,0.88) 0%, rgba(14,54,123,0.76) 100%)",
                  border: "1px solid rgba(217,233,255,0.14)",
                  boxShadow: "0 12px 24px rgba(4,16,40,0.24)",
                  "&:active": { transform: "scale(0.95)" },
                }}
              >
                <Box
                  sx={{
                    width: 50,
                    height: 50,
                    borderRadius: "16px",
                    color: memberPalette.white,
                    background: `linear-gradient(145deg, ${memberPalette.navy} 0%, ${memberPalette.cobalt} 100%)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    mx: "auto",
                    mb: 0.95,
                    boxShadow: "0 10px 18px rgba(16,42,99,0.18)",
                  }}
                >
                  {React.cloneElement(action.icon, { sx: { fontSize: 26 } })}
                </Box>
                <Typography sx={{ fontSize: 11, color: "#d9e9ff", fontWeight: 800, lineHeight: 1.25 }}>{action.label}</Typography>
              </Box>
            </Grid>
          ))}
        </Grid>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
          <Typography sx={{ fontSize: 17, fontWeight: 800, color: "#ffffff", mt: 1.6, mb: 1.8 }}>
            Earnings Analytics
          </Typography>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mb: 2.6 }}>
            {/* Referral Earnings — full width */}
              <Card
                sx={{
                  ...memberGlassPanelSx,
                  borderRadius: 3,
                  cursor: "pointer"
                }}
                onClick={() => setRewardDialogOpen(true)}
              >
                <CardContent sx={{ p: { xs: 1.5, sm: 2 }, display: "flex", alignItems: "center", justifyContent: "space-between", "&:last-child": { pb: { xs: 1.5, sm: 2 } } }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Box sx={{ width: 44, height: 44, borderRadius: 2, backgroundColor: "rgba(217,233,255,0.12)",
                      display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <GroupAddIcon sx={{ color: "#d9e9ff", fontSize: 24 }} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 11, color: "rgba(217,233,255,0.76)", fontWeight: 700 }}>Referral Earnings</Typography>
                      <Typography sx={{ fontSize: 26, fontWeight: 800, color: "#ffffff", lineHeight: 1.1, mt: 0.3 }}>
                        ₱{Number(displayEarnings).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Typography>
                    </Box>
                  </Box>
                  <Badge color="warning" variant="dot" overlap="circular"
                    invisible={!rewardHistory.some((r) => r.payoutReleased && !r.transferredAmount)}
                    anchorOrigin={{ vertical: "top", horizontal: "right" }}>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center",
                      width: 36, height: 36, borderRadius: "50%", backgroundColor: "rgba(217,233,255,0.12)" }}>
                      <VisibilityIcon sx={{ color: "#d9e9ff", fontSize: 20 }} />
                    </Box>
                  </Badge>
                </CardContent>
              </Card>

            {/* Override Earnings — full width */}
              <Card
                sx={{
                  ...memberGlassPanelSx,
                  borderRadius: 3,
                  border: "1px solid rgba(212,175,55,0.22)",
                  cursor: "pointer"
                }}
                onClick={() => setOverrideDialogOpen(true)}
              >
                <CardContent sx={{ p: { xs: 1.5, sm: 2 }, display: "flex", alignItems: "center", justifyContent: "space-between", "&:last-child": { pb: { xs: 1.5, sm: 2 } } }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Box sx={{ width: 44, height: 44, borderRadius: 2, backgroundColor: "rgba(212,175,55,0.18)",
                      display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <AccountTreeIcon sx={{ color: "#ffd483", fontSize: 24 }} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 11, color: "rgba(217,233,255,0.76)", fontWeight: 700 }}>Override Earnings</Typography>
                      <Typography sx={{ fontSize: 26, fontWeight: 800, color: "#ffd483", lineHeight: 1.1, mt: 0.3 }}>
                        ₱{Number(displayOverride).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Typography>
                    </Box>
                  </Box>
                  <Badge color="warning" variant="dot" overlap="circular"
                    invisible={!overrideList.some((reward) => {
                      let dueDate = reward.dueDate || reward.releaseDate;
                      if (dueDate) {
                        if (typeof dueDate === "object" && dueDate.seconds) dueDate = new Date(dueDate.seconds * 1000);
                        else if (typeof dueDate === "string" || typeof dueDate === "number") dueDate = new Date(dueDate);
                      }
                      return dueDate && dueDate <= new Date() && !(reward.claimed || reward.status === "Credited");
                    })}
                    anchorOrigin={{ vertical: "top", horizontal: "right" }}>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center",
                      width: 36, height: 36, borderRadius: "50%", backgroundColor: "rgba(212,175,55,0.14)" }}>
                      <VisibilityIcon sx={{ color: "#ffd483", fontSize: 20 }} />
                    </Box>
                  </Badge>
                </CardContent>
              </Card>
          </Box>

          <Box sx={{ background: "linear-gradient(145deg, rgba(8,23,52,0.92) 0%, rgba(16,42,99,0.88) 58%, rgba(33,86,201,0.78) 100%)", borderRadius: 3, p: 2.4, mb: 2.4, border: "1px solid rgba(255,255,255,0.10)", boxShadow: "0 18px 34px rgba(6,18,45,0.18)" }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.4 }}>
              <Typography sx={{ fontSize: 17, fontWeight: 800, color: "#ffffff" }}>Network Summary</Typography>
              <Button
                onClick={() => setGroupSalesOpen(true)}
                sx={{
                  fontSize: 10,
                  fontWeight: 700,
                  borderRadius: "999px",
                  px: 1.4,
                  py: 0.4,
                  color: "#ffffff",
                  backgroundColor: "rgba(255,255,255,0.12)",
                }}
              >
                Group Sales
              </Button>
            </Box>

            {loading ? (
              <Box sx={{ py: 2, display: "flex", justifyContent: "center" }}>
                <CircularProgress size={26} sx={{ color: "#105abf" }} />
              </Box>
            ) : userData ? (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.1 }}>
                {[
                  { role: "MD", label: "Managing Director", sub: "Tier 1 Elite", icon: <VerifiedUserIcon /> },
                  { role: "MS", label: "Marketing Specialist", sub: "Growth Focused", icon: <MonetizationOnIcon /> },
                  { role: "MI", label: "Marketing Influencer", sub: "Network Hub", icon: <QueryStatsIcon /> },
                  { role: "Agent", label: "General Agents", sub: "Base Network", icon: <PersonPinIcon /> },
                ].map((item) => (
                  <Box
                    key={item.role}
                    sx={{
                      borderRadius: 2,
                      background: "linear-gradient(145deg, rgba(255,255,255,0.92) 0%, rgba(243,246,255,0.96) 100%)",
                      px: 1.8,
                      py: 1.4,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: "50%",
                          backgroundColor: "rgba(11,31,94,0.08)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: memberPalette.navy,
                        }}
                      >
                        {React.cloneElement(item.icon, { sx: { fontSize: 21 } })}
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#1f2430" }}>{item.label}</Typography>
                        <Typography sx={{ fontSize: 11, color: "#6f7684" }}>{item.sub}</Typography>
                      </Box>
                    </Box>

                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                      <Box sx={{ textAlign: "right" }}>
                        <Typography sx={{ fontSize: 22, fontWeight: 800, color: memberPalette.navy, lineHeight: 1 }}>
                          {roleCounts[item.role]}
                        </Typography>
                        <Typography sx={{ fontSize: 10, color: "#8b95a5", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6 }}>Agents</Typography>
                      </Box>
                      <IconButton
                        size="small"
                        onClick={() => handleViewReferrals(item.role)}
                        sx={{ backgroundColor: "rgba(11,31,94,0.08)", "&:hover": { backgroundColor: "rgba(11,31,94,0.16)" } }}
                      >
                        <VisibilityIcon sx={{ color: memberPalette.navy, fontSize: 17 }} />
                      </IconButton>
                    </Box>
                  </Box>
                ))}
              </Box>
            ) : (
              <Typography sx={{ fontSize: 13, color: "rgba(217,233,255,0.74)", py: 1 }}>Unable to load user data.</Typography>
            )}
          </Box>

          <Box
            sx={{
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 3,
              p: 2.2,
              mb: 2.6,
              background: "linear-gradient(145deg, rgba(8,23,52,0.94) 0%, rgba(16,42,99,0.88) 62%, rgba(212,175,55,0.22) 100%)",
              boxShadow: "0 18px 34px rgba(6,18,45,0.18)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 1,
            }}
          >
            <Box>
              <Typography sx={{ fontSize: 15, fontWeight: 800, color: "#ffffff" }}>Expand Sanctuary</Typography>
              <Typography sx={{ fontSize: 12, color: "rgba(255,255,255,0.74)", mt: 0.3 }}>
                Share your referral link and grow your earning network.
              </Typography>
            </Box>
            <IconButton
              onClick={() => setDashDialog("invite")}
              sx={{
                width: 42,
                height: 42,
                borderRadius: 2,
                backgroundColor: memberPalette.gold,
                color: "#fff",
                "&:hover": { backgroundColor: "#c39a1e" },
              }}
            >
              <ShareIcon fontSize="small" />
            </IconButton>
          </Box>
        </motion.div>
      </Box>

      <Box
        sx={{
          position: "fixed",
          bottom: 0,
          left: 0,
          width: "100%",
          background: "linear-gradient(180deg, rgba(8,23,52,0.94) 0%, rgba(11,31,94,0.98) 100%)",
          backdropFilter: "blur(12px)",
          borderTopLeftRadius: 26,
          borderTopRightRadius: 26,
          borderTop: "1px solid rgba(255,255,255,0.10)",
          boxShadow: "0 -12px 32px rgba(6,18,45,0.22)",
          py: 1.1,
          zIndex: 20,
        }}
      >
        <Box sx={{ maxWidth: 460, mx: "auto", px: 1.5, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Button sx={{ minWidth: 0, color: "rgba(255,255,255,0.95)", display: "flex", flexDirection: "column", gap: 0.4 }}>
            <HomeIcon sx={{ fontSize: 22 }} />
            <Typography sx={{ fontSize: 10, fontWeight: 700, lineHeight: 1 }}>Home</Typography>
          </Button>
          <Button onClick={() => navigate('/member/income/payback')} sx={{ minWidth: 0, color: "rgba(255,255,255,0.66)", display: "flex", flexDirection: "column", gap: 0.4, '&:hover': { color: '#fff' } }}>
            <ReceiptLongIcon sx={{ fontSize: 22 }} />
            <Typography sx={{ fontSize: 10, fontWeight: 700, lineHeight: 1 }}>PAYBACK</Typography>
          </Button>
          <Button sx={{ minWidth: 0, color: "#fff", mt: -2.2, display: "flex", flexDirection: "column", gap: 0.7 }}>
            <Box sx={{ width: 52, height: 52, borderRadius: "18px", background: `linear-gradient(145deg, ${memberPalette.gold} 0%, #e6c565 100%)`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 12px 22px rgba(212,175,55,0.28)" }}>
              <QrCodeScannerIcon sx={{ fontSize: 28 }} />
            </Box>
            <Typography sx={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.72)", lineHeight: 1 }}>Scan</Typography>
          </Button>
          <Button onClick={() => navigate('/member/income/capital-share')} sx={{ minWidth: 0, color: "rgba(255,255,255,0.66)", display: "flex", flexDirection: "column", gap: 0.4, '&:hover': { color: '#fff' } }}>
            <RedeemIcon sx={{ fontSize: 22 }} />
            <Typography sx={{ fontSize: 10, fontWeight: 700, lineHeight: 1 }}>CAPITAL</Typography>
          </Button>
          <Button onClick={() => navigate('/member/profile')} sx={{ minWidth: 0, color: "rgba(255,255,255,0.66)", display: "flex", flexDirection: "column", gap: 0.4, '&:hover': { color: '#fff' } }}>
            <PersonIcon sx={{ fontSize: 22 }} />
            <Typography sx={{ fontSize: 10, fontWeight: 700, lineHeight: 1 }}>Profile</Typography>
          </Button>
        </Box>
      </Box>

      {/* ─────────────────── Quick Action Dialogs ─────────────────── */}
      {dashDialog === "transfer" && (
        <TransferFundsDialog open onClose={() => setDashDialog(null)} userData={userData} db={db} auth={auth} />
      )}
      {dashDialog === "withdraw" && (
        <WithdrawDialog open onClose={() => setDashDialog(null)} userData={userData} db={db} auth={auth} />
      )}
      {dashDialog === "purchase" && (
        <PurchaseCodesDialog open onClose={() => setDashDialog(null)} userData={userData} availableCodes={availableCodes} db={db} auth={auth} />
      )}
      {dashDialog === "invite" && (
        <InviteEarnDialog open onClose={() => setDashDialog(null)} userData={userData} availableCodes={availableCodes} db={db} auth={auth} />
      )}
      {dashDialog === "walletHistory" && (
        <EwalletHistoryDialog open onClose={() => setDashDialog(null)} db={db} auth={auth} />
      )}

      <Snackbar
        open={rewardsUnavailableOpen}
        autoHideDuration={2400}
        onClose={() => setRewardsUnavailableOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setRewardsUnavailableOpen(false)}
          severity="info"
          variant="filled"
          sx={{
            background: "linear-gradient(135deg, #0b1f5e 0%, #173a8a 100%)",
            color: "#fff",
            fontWeight: 700,
          }}
        >
          Not Available right now
        </Alert>
      </Snackbar>

      {/* 👁 Referrals Dialog */}
      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: { borderRadius: 3, overflow: "hidden", background: "linear-gradient(150deg, rgba(8,26,62,0.96) 0%, rgba(13,44,102,0.92) 100%)", border: "1px solid rgba(217,233,255,0.2)", color: "#fff" } }}
      >
        <DialogTitle sx={{ background: "rgba(8,31,76,0.75)", color: "#fff", p: 0, borderBottom: "1px solid rgba(217,233,255,0.15)" }}>
          <Box sx={{ px: 2.5, pt: 2.5, pb: 2 }}>
            <Typography sx={{ fontSize: 10, color: "rgba(255,255,255,0.72)", letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700 }}>
              Network View
            </Typography>
            <Typography sx={{ fontSize: 20, fontWeight: 800 }}>
              {selectedRole === "MD" ? "Managing Directors" :
               selectedRole === "MS" ? "Marketing Specialists" :
               selectedRole === "MI" ? "Marketing Influencers" : "General Agents"}
            </Typography>
            <Chip
              label={`${filteredReferrals.length} member${filteredReferrals.length !== 1 ? "s" : ""}`}
              size="small"
              sx={{ mt: 0.8, backgroundColor: "rgba(255,255,255,0.2)", color: "#fff", fontWeight: 700, fontSize: 11 }}
            />
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0, backgroundColor: "transparent" }}>
          <Box sx={{ px: 2, pt: 2, pb: 1, backgroundColor: "rgba(7,22,52,0.55)", borderBottom: "1px solid rgba(217,233,255,0.15)", display: "flex", gap: 1 }}>
            <TextField
              placeholder="Search name or username…"
              variant="outlined"
              fullWidth
              size="small"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: 2,
                  color: "#fff",
                  backgroundColor: "rgba(6,20,52,0.42)",
                  "& fieldset": { borderColor: "rgba(217,233,255,0.24)" },
                },
                "& .MuiInputBase-input::placeholder": { color: "rgba(217,233,255,0.68)", opacity: 1 },
              }}
            />
            <TextField
              select
              size="small"
              value={sortField}
              onChange={(e) => setSortField(e.target.value)}
              sx={{ minWidth: 110, "& .MuiOutlinedInput-root": { borderRadius: 2, color: "#fff", backgroundColor: "rgba(6,20,52,0.42)", "& fieldset": { borderColor: "rgba(217,233,255,0.24)" } } }}
            >
              <MenuItem value="name">Name</MenuItem>
              <MenuItem value="username">Username</MenuItem>
            </TextField>
            <IconButton onClick={handleToggleSortOrder} sx={{ color: "#d9e9ff", border: "1px solid rgba(217,233,255,0.24)", borderRadius: 2, px: 1 }}>
              <SortIcon sx={{ transform: sortOrder === "asc" ? "rotate(0deg)" : "rotate(180deg)", transition: "transform 0.3s" }} />
            </IconButton>
          </Box>
          {filteredReferrals.length === 0 ? (
            <Box sx={{ py: 6, textAlign: "center" }}>
              <Typography sx={{ fontSize: 13, color: "rgba(217,233,255,0.74)" }}>No members found.</Typography>
            </Box>
          ) : (
            <List disablePadding>
              {filteredReferrals.map((ref, i) => (
                <ListItem key={i} divider sx={{ px: 2, py: 1.4, backgroundColor: i % 2 === 0 ? "rgba(8,26,62,0.42)" : "rgba(7,22,52,0.58)", borderColor: "rgba(217,233,255,0.12)" }}>
                  <Avatar
                    src={getUserAvatarUrl(ref) || undefined}
                    sx={{
                      width: 38,
                      height: 38,
                      mr: 1.5,
                      flexShrink: 0,
                      background: "linear-gradient(135deg,#0f4ea8,#2f7de1)",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 15,
                    }}
                  >
                    {getUserAvatarInitial(ref, "?")}
                  </Avatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                        <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#ffffff" }}>
                          {ref.name || ref.username}
                        </Typography>
                        <Chip label={ref.role} size="small"
                          sx={{ fontSize: 9, fontWeight: 700, height: 18, px: 0.5,
                            backgroundColor: ref.role === "MD" ? "rgba(16,90,191,0.18)" : ref.role === "MS" ? "rgba(255,212,131,0.18)" : ref.role === "MI" ? "rgba(46,125,50,0.18)" : "rgba(217,233,255,0.12)",
                            color: ref.role === "MD" ? "#9fd5ff" : ref.role === "MS" ? "#ffd483" : ref.role === "MI" ? "#9ddfb1" : "#d9e9ff",
                          }}
                        />
                      </Box>
                    }
                    secondary={
                      <Typography component="span" sx={{ fontSize: 12, color: "rgba(217,233,255,0.68)" }}>
                        @{ref.username}{ref.email ? ` · ${ref.email}` : ""}
                      </Typography>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions sx={{ backgroundColor: "rgba(7,22,52,0.55)", borderTop: "1px solid rgba(217,233,255,0.14)", px: 2, py: 1.4 }}>
          <Button onClick={() => setOpenDialog(false)}
            sx={{ borderRadius: 2, fontWeight: 700, color: "#105abf", textTransform: "none",
              backgroundColor: "rgba(16,90,191,0.08)", px: 2.5, "&:hover": { backgroundColor: "rgba(16,90,191,0.14)" } }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* 🧾 Reward History Dialog */}
      <RewardHistoryDialog
        open={rewardDialogOpen}
        onClose={() => setRewardDialogOpen(false)}
        rewardHistory={rewardHistory}
        user={user}
        loadingTransfer={loadingTransfer}
        setLoadingTransfer={setLoadingTransfer}
        onTransferSuccess={() => {
          setTimeout(() => {
            console.log("[Dashboard] Reward transfer successful, data will refresh from Firestore");
          }, 500);
        }}
      />

      {/* 🧾 Override Upline Rewards Dialog */}
      <OverrideUplineRewardsDialog
        open={overrideDialogOpen}
        onClose={() => setOverrideDialogOpen(false)}
        overrideList={overrideList}
        user={user}
        loadingTransfer={loadingTransfer}
        setLoadingTransfer={setLoadingTransfer}
      />

      <NetworkGroupSales
        open={groupSalesOpen}
        onClose={() => setGroupSalesOpen(false)}
        username={userData?.username}
        user={userData}
      />

      {/* ─── Notifications Drawer ─────────────────────────── */}
      <Drawer
        anchor="right"
        open={notifDrawerOpen}
        onClose={() => setNotifDrawerOpen(false)}
        PaperProps={{
          sx: {
            width: { xs: "100vw", sm: 380 },
            borderTopLeftRadius: { xs: 0, sm: 20 },
            borderBottomLeftRadius: { xs: 0, sm: 20 },
            background: "linear-gradient(150deg, rgba(8,26,62,0.96) 0%, rgba(13,44,102,0.92) 100%)",
            color: "#fff",
            borderLeft: "1px solid rgba(217,233,255,0.18)",
          },
        }}
      >
        {/* Header */}
        <Box sx={{ background: "rgba(8,31,76,0.82)", borderBottom: "1px solid rgba(217,233,255,0.16)", px: 2.5, pt: 3.5, pb: 2.5 }}>
          <Typography sx={{ fontSize: 10, color: "rgba(255,255,255,0.72)", letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700 }}>Inbox</Typography>
          <Typography sx={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>Notifications</Typography>
          {unreadCount > 0 && (
            <Chip label={`${unreadCount} new`} size="small"
              sx={{ mt: 0.8, backgroundColor: "rgba(255,255,255,0.22)", color: "#fff", fontWeight: 700, fontSize: 11 }} />
          )}
        </Box>

        {/* List */}
        <Box sx={{ flex: 1, overflowY: "auto", p: 0 }}>
          {notifications.length === 0 ? (
            <Box sx={{ py: 8, textAlign: "center" }}>
              <NotificationsNoneIcon sx={{ fontSize: 48, color: "#c2c6d5", mb: 1 }} />
              <Typography sx={{ fontSize: 13, color: "rgba(217,233,255,0.74)" }}>No notifications yet.</Typography>
            </Box>
          ) : (
            notifications.map((n, idx) => {
              const isUnread = !n.read;
              const icon = n.type === "reward" ? <CelebrationIcon sx={{ fontSize: 20, color: "#105abf" }} />
                : n.type === "success" ? <CheckCircleOutlineIcon sx={{ fontSize: 20, color: "#2e7d32" }} />
                : <InfoOutlinedIcon sx={{ fontSize: 20, color: "#752a00" }} />;
              const ts = n.createdAt?.seconds
                ? new Date(n.createdAt.seconds * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                : "";
              return (
                <Box key={n.id}>
                  <Box sx={{
                    display: "flex", alignItems: "flex-start", gap: 1.5,
                    px: 2, py: 1.8,
                    backgroundColor: isUnread ? "rgba(36,103,202,0.2)" : "rgba(7,22,52,0.35)",
                    borderLeft: isUnread ? "3px solid #105abf" : "3px solid transparent",
                  }}>
                    <Box sx={{ width: 38, height: 38, borderRadius: "50%", backgroundColor: "rgba(217,233,255,0.12)",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, mt: 0.2 }}>
                      {icon}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontSize: 13, fontWeight: isUnread ? 700 : 600, color: "#ffffff", lineHeight: 1.3 }}>
                        {n.title || "Notification"}
                      </Typography>
                      {n.message && (
                        <Typography sx={{ fontSize: 12, color: "rgba(217,233,255,0.74)", mt: 0.3, lineHeight: 1.5 }}>
                          {n.message}
                        </Typography>
                      )}
                      {ts && (
                        <Typography sx={{ fontSize: 10, color: "rgba(217,233,255,0.58)", mt: 0.5, fontWeight: 600 }}>{ts}</Typography>
                      )}
                    </Box>
                    {isUnread && (
                      <Box sx={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#105abf", mt: 0.8, flexShrink: 0 }} />
                    )}
                  </Box>
                  <Divider sx={{ ml: 7 }} />
                </Box>
              );
            })
          )}
        </Box>

        {/* Footer */}
        <Box sx={{ p: 2, backgroundColor: "rgba(7,22,52,0.55)", borderTop: "1px solid rgba(217,233,255,0.14)" }}>
          <Button fullWidth onClick={() => setNotifDrawerOpen(false)}
            sx={{ borderRadius: 2.5, textTransform: "none", fontWeight: 700, color: "#d9e9ff",
              backgroundColor: "rgba(16,90,191,0.2)", py: 1.2, "&:hover": { backgroundColor: "rgba(16,90,191,0.3)" } }}>
            Close
          </Button>
        </Box>
      </Drawer>
    </Box>
  );
};

export default MemberDashboard;
