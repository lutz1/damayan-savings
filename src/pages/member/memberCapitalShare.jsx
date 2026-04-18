// src/pages/MemberCapitalShare.jsx
import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Card,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Backdrop,
  Grid,
  Toolbar,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
// 🔹 CHANGE: react-big-calendar imports

import MemberBottomNav from "../../components/MemberBottomNav";
import { auth, db } from "../../firebase";
import ProfitHistoryDialog from "./components/dialogs/ProfitHistoryDialog";
import DetailedProfitClaimsHistory from "./components/dialogs/DetailedProfitClaimsHistory";
import CapitalShareProfitBreakdown from "./components/dialogs/CapitalShareProfitBreakdown";
import AddCapitalShareDialog from "./components/dialogs/AddCapitalShareDialog";
import EntryDetailsDialog from "./components/dialogs/EntryDetailsDialog";
import CapitalShareVoucherDialog from "./components/dialogs/CapitalShareVoucherDialog";
import WalkInBranchDialog from "./components/dialogs/WalkInBranchDialog";
import OFWRewardsDialog from "./components/dialogs/OFWRewardsDialog";
import CapitalShareTransactions from "./components/CapitalShareTransactions";
import { memberPageTopInset, memberShellBackground, memberGlassPanelSx, memberHeroBackground } from "./memberLayout";


const MIN_AMOUNT = 1000;


const MemberCapitalShare = () => {
  const memberPalette = {
    navy: "#0a1f44",
    royal: "#0f4ea8",
    azure: "#2f7de1",
    cloud: "#d9e9ff",
    gold: "#d4af37",
    softText: "rgba(217,233,255,0.76)",
  };

  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [codes, setCodes] = useState([]);
  const [selectedCode, setSelectedCode] = useState("");
  const [openDialog, setOpenDialog] = useState(false);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [amount, setAmount] = useState("");

  // Removed unused historyDialogOpen state
  const [transactionHistory, setTransactionHistory] = useState([]);
  const [capitalAmount, setCapitalAmount] = useState(0);
  const [monthlyProfit, setMonthlyProfit] = useState(0);
  const [profitHistoryOpen, setProfitHistoryOpen] = useState(false);
  const [profitBreakdownOpen, setProfitBreakdownOpen] = useState(false);
  const [detailedProfitHistoryOpen, setDetailedProfitHistoryOpen] = useState(false);
  const [profitConfirmOpen, setProfitConfirmOpen] = useState(false);
  const [selectedProfitEntry, setSelectedProfitEntry] = useState(null);
  const [profitTransferLoading, setProfitTransferLoading] = useState(false);
  const [claimingPeriodKey, setClaimingPeriodKey] = useState(null);
  const [entryDetailsOpen, setEntryDetailsOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [addingEntry, setAddingEntry] = useState(false);
  const [voucherDialogOpen, setVoucherDialogOpen] = useState(false);
  const [walkInBranchDialogOpen, setWalkInBranchDialogOpen] = useState(false);
  const [ofwRewardsDialogOpen, setOfwRewardsDialogOpen] = useState(false);
  const [voucherType, setVoucherType] = useState("WALK_IN");
  const [savingVoucherType, setSavingVoucherType] = useState(false);
  const [voucherRewardConfigs, setVoucherRewardConfigs] = useState([]);


  const handleToggleSidebar = () => setSidebarOpen((prev) => !prev);

  const fetchUserData = useCallback(async (currentUser) => {
    try {
      const userRef = doc(db, "users", currentUser.uid);
      const voucherRef = doc(db, "capitalShareVouchers", currentUser.uid);
      const [snap, voucherSnap] = await Promise.all([getDoc(userRef), getDoc(voucherRef)]);
      if (snap.exists()) {
        const data = snap.data();
        const voucherData = voucherSnap.exists() ? voucherSnap.data() : null;
        const savedVoucherType = voucherData?.voucherType || data.capitalShareVoucherType;
        const hasConfirmedVoucherType = savedVoucherType === "WALK_IN" || savedVoucherType === "OFW";
        
        // ✅ CHECK: Validate if activation has expired after 1 year
        let activationExpired = false;
        let voucherEligible = false; // Only true if activated after Mar 4, 2026
        
        if (data.capitalShareActive && data.capitalActivatedAt) {
          const activatedAt = data.capitalActivatedAt.toDate ? data.capitalActivatedAt.toDate() : new Date(data.capitalActivatedAt);
          const expirationDate = new Date(activatedAt);
          expirationDate.setFullYear(expirationDate.getFullYear() + 1);
          
          const now = new Date();
          const voucherCutoffDate = new Date("2026-03-04"); // Implementation date
          
          // Check if activation is expired
          if (now > expirationDate) {
            activationExpired = true;
          }
          
          // Check if activated after voucher implementation date
          if (activatedAt >= voucherCutoffDate) {
            voucherEligible = true;
          }
        }
        
        setUserData({ ...data, activationExpired, voucherEligible, voucherData: voucherData || null });

        if (hasConfirmedVoucherType) {
          setVoucherType(savedVoucherType);
          setVoucherDialogOpen(false);
          setWalkInBranchDialogOpen(false);
        } else if (data.capitalShareActive && !activationExpired && voucherEligible && !hasConfirmedVoucherType) {
          // Only show voucher dialog for NEW activations (after Mar 4, 2026) that haven't confirmed yet
          setVoucherType("WALK_IN");
          setVoucherDialogOpen(true);
        } else {
          setVoucherDialogOpen(false);
          setWalkInBranchDialogOpen(false);
        }

        // Fetch available codes if activation is expired OR not active
        if (!data.capitalShareActive || activationExpired) {
          const codesRef = collection(db, "purchaseCodes");
          const q = query(
            codesRef,
            where("userId", "==", currentUser.uid),
            where("used", "==", false),
            where("type", "==", "Activate Capital Share")
          );
          const querySnap = await getDocs(q);
          const codeList = querySnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
          setCodes(codeList);
        }
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  const processMonthlyProfit = useCallback(async () => {
    if (!user) return;
    try {
      const entriesRef = collection(db, "capitalShareEntries");
      const q = query(
        entriesRef,
        where("userId", "==", user.uid)
      );
      const snap = await getDocs(q);
      const now = new Date();

      const updates = [];

      const toDateSafe = (value) => {
        if (!value) return null;
        if (typeof value.toDate === "function") return value.toDate();
        const parsed = value instanceof Date ? value : new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      };

      const addCalendarMonths = (baseDate, monthsToAdd) => {
        const result = new Date(baseDate);
        const originalDay = result.getDate();
        result.setDate(1);
        result.setMonth(result.getMonth() + monthsToAdd);
        const lastDayOfTargetMonth = new Date(
          result.getFullYear(),
          result.getMonth() + 1,
          0
        ).getDate();
        result.setDate(Math.min(originalDay, lastDayOfTargetMonth));
        return result;
      };

      const snapToMonthlyAnniversary = (createdAt, candidateDate) => {
        let closest = null;
        let closestDiff = Number.POSITIVE_INFINITY;

        for (let month = 1; month <= 12; month += 1) {
          const scheduleDate = addCalendarMonths(createdAt, month);
          const diff = Math.abs(scheduleDate.getTime() - candidateDate.getTime());
          if (diff < closestDiff) {
            closest = scheduleDate;
            closestDiff = diff;
          }
        }

        // Normalize only small drifts from old fixed-30-day schedules.
        return closestDiff <= 3 * 24 * 60 * 60 * 1000 ? closest : candidateDate;
      };

      snap.docs.forEach((docEntry) => {
        const data = docEntry.data();

        const createdAt = toDateSafe(data.createdAt) || toDateSafe(data.date);
        if (!createdAt) return;

        const firstDueDate = addCalendarMonths(createdAt, 1);
        const rawNextProfitDate = toDateSafe(data.nextProfitDate);
        let nextProfitDate = rawNextProfitDate || firstDueDate;
        nextProfitDate = snapToMonthlyAnniversary(createdAt, nextProfitDate);
        if (nextProfitDate < firstDueDate) {
          nextProfitDate = firstDueDate;
        }

        const nextProfitDateChanged =
          !rawNextProfitDate ||
          rawNextProfitDate.getTime() !== nextProfitDate.getTime();

        const expireDate = new Date(createdAt);
        expireDate.setFullYear(expireDate.getFullYear() + 1);

        if (now > expireDate || now < nextProfitDate) {
          if (nextProfitDateChanged) {
            updates.push({
              id: docEntry.id,
              nextProfitDate,
            });
          }
          return;
        }

        let profitBase = 0;
        if (data.transferredAmount && data.transferredAmount > 0) {
          profitBase = data.lockInPortion || 0;
        } else {
          profitBase = data.amount || 0;
        }

        if (profitBase <= 0) return;

        let monthsDue = 0;
        const nextDateAfterAccrual = new Date(nextProfitDate);
        while (nextDateAfterAccrual <= now && nextDateAfterAccrual <= expireDate) {
          monthsDue += 1;
          const nextMonthDate = addCalendarMonths(nextDateAfterAccrual, 1);
          nextDateAfterAccrual.setTime(nextMonthDate.getTime());
        }

        if (monthsDue <= 0) return;

        // 🔹 Skip if already claimed - don't re-accumulate profit
        if (data.profitStatus === "Claimed") return;

        const totalProfitToAdd = profitBase * 0.05 * monthsDue;
        updates.push({
          id: docEntry.id,
          newProfit: (data.profit || 0) + totalProfitToAdd,
          nextProfitDate: nextDateAfterAccrual,
          profitStatus: "Pending",
        });
      });

      for (const u of updates) {
        const entryRef = doc(db, "capitalShareEntries", u.id);
        const payload = {
          nextProfitDate: u.nextProfitDate,
        };
        if (typeof u.newProfit === "number") {
          payload.profit = u.newProfit;
        }
        if (u.profitStatus) {
          payload.profitStatus = u.profitStatus;
        }
        await updateDoc(entryRef, payload);
      }
    } catch (err) {
      console.error("Error processing monthly profit:", err);
    }
  }, [user]);

  const fetchTransactionHistory = useCallback(async () => {
  if (!user) return;
  try {
    await processMonthlyProfit();

    const q = query(
      collection(db, "capitalShareEntries"),
      where("userId", "==", user.uid)
    );
    const depositsQuery = query(
      collection(db, "deposits"),
      where("userId", "==", user.uid)
    );

    const [snap, depositsSnap] = await Promise.all([getDocs(q), getDocs(depositsQuery)]);

    const monthlyTransfersByEntry = {};
    depositsSnap.docs.forEach((depositDoc) => {
      const depositData = depositDoc.data();
      if (depositData.type !== "Monthly Profit Transfer") return;
      if (!depositData.sourceEntryId) return;

      const rawClaimedAt = depositData.createdAt;
      const claimedAt =
        rawClaimedAt && typeof rawClaimedAt.toDate === "function"
          ? rawClaimedAt.toDate()
          : rawClaimedAt instanceof Date
            ? rawClaimedAt
            : rawClaimedAt
              ? new Date(rawClaimedAt)
              : null;

      if (!claimedAt || Number.isNaN(claimedAt.getTime())) return;

      if (!monthlyTransfersByEntry[depositData.sourceEntryId]) {
        monthlyTransfersByEntry[depositData.sourceEntryId] = [];
      }

      monthlyTransfersByEntry[depositData.sourceEntryId].push({
        amount: Number(depositData.amount || 0),
        claimedAt,
        periodKey: depositData.periodKey || null,
      });
    });

    Object.keys(monthlyTransfersByEntry).forEach((entryId) => {
      monthlyTransfersByEntry[entryId].sort((a, b) => a.claimedAt.getTime() - b.claimedAt.getTime());
    });
    
    // 🔹 Sort entries by createdAt in JavaScript (ascending)
    const sortedDocs = snap.docs.sort((a, b) => {
      const dateA = a.data().createdAt?.toDate?.() || new Date(0);
      const dateB = b.data().createdAt?.toDate?.() || new Date(0);
      return dateA.getTime() - dateB.getTime();
    });

    const now = new Date();
    let totalCapital = 0;
    let totalProfit = 0;
    const calendarData = [];
    
    // 🔹 Retroactively assign lock-in to old entries if missing
    const entriesToUpdate = [];
    
    sortedDocs.forEach((docSnap) => {
      const data = docSnap.data();
      
      if (!data.lockInPortion) {
        // Calculate lock-in: 25% of the added amount
        const lockInPortion = (data.amount || 0) * 0.25;
        const transferablePortion = (data.amount || 0) - lockInPortion;
        
        entriesToUpdate.push({
          docRef: docSnap.ref,
          lockInPortion,
          transferablePortion,
          transferableAfterDate: data.transferableAfterDate || new Date(data.createdAt.toDate().getTime() + 30 * 24 * 60 * 60 * 1000),
        });
      }
    });
    
    // Update old entries in background (non-blocking)
    if (entriesToUpdate.length > 0) {
      entriesToUpdate.forEach(async (update) => {
        await updateDoc(update.docRef, {
          lockInPortion: update.lockInPortion,
          transferablePortion: update.transferablePortion,
          transferableAfterDate: update.transferableAfterDate,
        });
      });
    }

    const history = snap.docs.map((docSnap) => {
      const data = docSnap.data();
      const entry = { id: docSnap.id, ...data };
      
      // 🔹 Apply retroactive lock-in if missing
      if (!entry.lockInPortion) {
        const updateInfo = entriesToUpdate.find(u => u.docRef.id === docSnap.id);
        if (updateInfo) {
          entry.lockInPortion = updateInfo.lockInPortion;
          entry.transferablePortion = updateInfo.transferablePortion;
          entry.transferableAfterDate = updateInfo.transferableAfterDate;
        }
      }

      if (entry.nextProfitDate && typeof entry.nextProfitDate.toDate === "function") {
        entry.nextProfitDate = entry.nextProfitDate.toDate();
      } else if (entry.nextProfitDate && !(entry.nextProfitDate instanceof Date)) {
        const parsedNextProfit = new Date(entry.nextProfitDate);
        entry.nextProfitDate = Number.isNaN(parsedNextProfit.getTime()) ? null : parsedNextProfit;
      }
      if (entry.createdAt && typeof entry.createdAt.toDate === "function") {
        entry.createdAt = entry.createdAt.toDate();
      } else if (entry.createdAt && !(entry.createdAt instanceof Date)) {
        const parsedCreatedAt = new Date(entry.createdAt);
        entry.createdAt = Number.isNaN(parsedCreatedAt.getTime()) ? null : parsedCreatedAt;
      }
      if (entry.date && typeof entry.date.toDate === "function") {
        entry.date = entry.date.toDate();
      } else if (entry.date && !(entry.date instanceof Date)) {
        const parsedDate = new Date(entry.date);
        entry.date = Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
      }
      if (entry.transferableAfterDate && typeof entry.transferableAfterDate.toDate === "function") {
        entry.transferableAfterDate = entry.transferableAfterDate.toDate();
      } else if (entry.transferableAfterDate && typeof entry.transferableAfterDate === "number") {
        entry.transferableAfterDate = new Date(entry.transferableAfterDate);
      }

      // Merge claim history from deposits to preserve legacy monthly claims without periodKey.
      const depositClaimHistory = monthlyTransfersByEntry[entry.id] || [];
      const existingClaimHistory = Array.isArray(entry.profitClaimHistory)
        ? entry.profitClaimHistory.map((claim) => ({
            periodKey: claim?.periodKey || null,
            amount: Number(claim?.amount || 0),
            claimedAt:
              claim?.claimedAt && typeof claim.claimedAt.toDate === "function"
                ? claim.claimedAt.toDate()
                : claim?.claimedAt instanceof Date
                  ? claim.claimedAt
                  : claim?.claimedAt
                    ? new Date(claim.claimedAt)
                    : null,
          })).filter((claim) => claim.claimedAt && !Number.isNaN(claim.claimedAt.getTime()))
        : [];

      if (depositClaimHistory.length > 0 || existingClaimHistory.length > 0) {
        const merged = [...existingClaimHistory, ...depositClaimHistory];
        merged.sort((a, b) => a.claimedAt.getTime() - b.claimedAt.getTime());
        entry.profitClaimHistory = merged;
      }

      entry.profitStatus = entry.profitStatus || "Pending";
      entry.profit = entry.profit || 0;

      const createdAt = entry.createdAt || new Date();
      const expireDate = new Date(createdAt);
      expireDate.setFullYear(expireDate.getFullYear() + 1);
      const isActive = now <= expireDate;

      if (isActive) {
        // ✅ Include full amount
        totalCapital += entry.amount || 0;

        // 🧮 Sum unclaimed profit
        if (entry.profitStatus !== "Claimed") {
          totalProfit += entry.profit || 0;
        }

        // 📅 Calendar entry
        calendarData.push({
          date: new Date(entry.date),
          profitReady: entry.nextProfitDate <= now,
          createdAt: createdAt,
        });
      }

      return entry;
    });
    
    // 🔹 Reverse to descending order for display
    history.reverse();

    setTransactionHistory(history);
    setCapitalAmount(totalCapital);
    setMonthlyProfit(totalProfit);
    // setCalendarEntries(calendarData); // Calendar removed
  } catch (err) { 
    console.error("Error fetching capital share data:", err);
  }
}, [user, processMonthlyProfit]);

  const fetchVoucherRewardConfigs = useCallback(async () => {
    try {
      const configSnap = await getDocs(collection(db, "voucherRewardConfigs"));
      const configs = configSnap.docs
        .map((configDoc) => ({ id: configDoc.id, ...configDoc.data() }))
        .filter((cfg) => cfg.active !== false)
        .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
      setVoucherRewardConfigs(configs);
    } catch (err) {
      console.error("Error fetching voucher reward configs:", err);
      setVoucherRewardConfigs([]);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        await Promise.all([
          fetchUserData(currentUser),
          fetchTransactionHistory(),
          fetchVoucherRewardConfigs(),
        ]);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [fetchUserData, fetchTransactionHistory, fetchVoucherRewardConfigs]);

  const handleActivate = async () => {
    if (!selectedCode) return alert("Please select a code to activate Capital Share.");
    try {
      setLoading(true);
      const codeRef = doc(db, "purchaseCodes", selectedCode);
      await updateDoc(codeRef, { used: true, usedAt: serverTimestamp() });

      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        capitalShareActive: true,
        capitalActivatedAt: serverTimestamp(),
      });

      alert("✅ Capital Share successfully activated!");
      setSelectedCode("");
      await fetchUserData(user);
      setVoucherType("WALK_IN");
      setVoucherDialogOpen(true);
    } catch (err) {
      console.error(err);
      alert("Activation failed.");
    } finally {
      setLoading(false);
      setOpenDialog(false);
    }
  };

  const saveVoucherType = useCallback(async (type, extraFields = {}, options = {}) => {
    if (!user) return false;
    const shouldCloseDialogs = options.closeDialogs ?? true;
    const shouldShowAlert = options.showAlert ?? true;
    const shouldRefreshUserData = options.refreshUserData ?? true;

    try {
      setSavingVoucherType(true);
      const fallbackVoucherCode = `VCR-${Date.now()}-${type === "OFW" ? "OFW" : "WALK"}-X`;
      const resolvedVoucherCode = extraFields.voucherCode || fallbackVoucherCode;
      
      // Get Firebase ID token
      const idToken = await user.getIdToken();
      // Include typeKey for unique idempotency across multiple vouchers
      const typeKeySuffix = extraFields.selectedVoucherTypeKey ? `_${extraFields.selectedVoucherTypeKey}` : "";
      const clientRequestId = `${user.uid}_${Date.now()}${typeKeySuffix}_${Math.random().toString(36).slice(2, 8)}`;

      // Call Cloud Function to create capital share voucher
      const response = await fetch(
        "https://us-central1-amayan-savings.cloudfunctions.net/createCapitalShareVoucher",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            voucherType: type,
            voucherCode: resolvedVoucherCode,
            voucherIssuedAt: extraFields.voucherIssuedAt ? extraFields.voucherIssuedAt.toISOString() : new Date().toISOString(),
            branchId: extraFields.branchId || null,
            branchName: extraFields.branchName || "",
            branchAddress: extraFields.branchAddress || "",
            branchEmail: extraFields.branchEmail || "",
            voucherKind: extraFields.voucherKind || null, // Track voucher kind (RICE, MEAT, POINTS, etc.)
            voucherStatus: extraFields.voucherStatus || "ACTIVE",
            claimablePercent: Number(extraFields.claimablePercent || 100),
            pointsConvertPercent: Number(extraFields.pointsConvertPercent || 0),
            holdReason: extraFields.holdReason || "",
            sourceRewardLabel: extraFields.sourceRewardLabel || "",
            splitGroupId: extraFields.splitGroupId || null,
            rewardConfigId: extraFields.rewardConfigId || null,
            clientRequestId,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save voucher");
      }

      const result = await response.json();
      console.log("✅ Voucher saved:", result);

      if (shouldCloseDialogs) {
        setVoucherDialogOpen(false);
        setWalkInBranchDialogOpen(false);
      }
      if (shouldRefreshUserData) {
        await fetchUserData(user);
      }
      if (shouldShowAlert) {
        alert(`✅ Voucher status saved: ${type === "WALK_IN" ? "Walk-In" : "OFW"}`);
      }
      return true;
    } catch (err) {
      console.error("Failed to save voucher status:", err);
      alert("❌ Failed to save voucher status.");
      return false;
    } finally {
      setSavingVoucherType(false);
    }
  }, [fetchUserData, user]);

  const handleOfwSelect = () => {
    setVoucherType("OFW");
    setOfwRewardsDialogOpen(true);
    setVoucherDialogOpen(false);
  };

  const handleWalkInBranchConfirm = async (branch) => {
    setVoucherType("WALK_IN");
    return true;
  };

  const handleVoucherDone = async (voucherPayload) => {
    if (!voucherPayload?.voucherType) return false;

    if (voucherPayload.selectedRewards && Array.isArray(voucherPayload.selectedRewards)) {
      const splitGroupId = `split_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      for (let rewardIndex = 0; rewardIndex < voucherPayload.selectedRewards.length; rewardIndex += 1) {
        const reward = voucherPayload.selectedRewards[rewardIndex];

        if (reward.rewardType === "POINTS_SPLIT" && Array.isArray(reward.splitTargets)) {
          for (let targetIndex = 0; targetIndex < reward.splitTargets.length; targetIndex += 1) {
            const target = reward.splitTargets[targetIndex];
            const targetKind = String(target.voucherKind || "POINTS").toUpperCase();
            const voucherCode = target.voucherCode || `VCR-${Date.now()}-WALK-${targetKind.slice(0, 1)}`;

            const success = await saveVoucherType("WALK_IN", {
              ...voucherPayload,
              voucherCode,
              voucherKind: targetKind,
              voucherStatus: target.voucherStatus || "HOLD",
              claimablePercent: Number(target.claimablePercent || 0),
              pointsConvertPercent: Number(target.pointsConvertPercent ?? 0),
              holdReason: target.holdReason || `${reward.label || "Points Reward"} split hold`,
              sourceRewardLabel: reward.label || "Points Reward",
              splitGroupId,
              rewardConfigId: reward.configId || null,
              branchId: target.branchId || null,
              branchName: target.branchName || "",
              branchAddress: target.branchAddress || "",
              branchEmail: target.branchEmail || "",
              selectedVoucherTypeKey: `${reward.configId || rewardIndex}_${targetKind}_${targetIndex}`,
            }, {
              closeDialogs: false,
              showAlert: false,
              refreshUserData: false,
            });

            if (!success) return false;
          }
          continue;
        }

        const rewardKind = String(reward.voucherKind || "GEN").toUpperCase();
        const success = await saveVoucherType("WALK_IN", {
          ...voucherPayload,
          voucherCode: reward.voucherCode,
          voucherKind: rewardKind,
          voucherStatus: reward.voucherStatus || "ACTIVE",
          claimablePercent: Number(reward.claimablePercent || 100),
          holdReason: reward.holdReason || "",
          sourceRewardLabel: reward.label || "Voucher Reward",
          rewardConfigId: reward.configId || null,
          branchId: reward.branchId || null,
          branchName: reward.branchName || "",
          branchAddress: reward.branchAddress || "",
          branchEmail: reward.branchEmail || "",
          selectedVoucherTypeKey: `${reward.configId || rewardIndex}_${rewardKind}`,
        }, {
          closeDialogs: false,
          showAlert: false,
          refreshUserData: false,
        });

        if (!success) return false;
      }

      setWalkInBranchDialogOpen(false);
      await fetchUserData(user);
      return true;
    }
    
    // Check if there are multiple selected vouchers (for Walk-In with voucher selection)
    if (voucherPayload.selectedVoucherTypes && Array.isArray(voucherPayload.selectedVoucherTypes)) {
      // Create a voucher for each selected type
      for (const voucherTypeKey of voucherPayload.selectedVoucherTypes) {
        // Determine the display type and kind
        let typeToSave = voucherPayload.voucherType;
        let kindLabel = voucherTypeKey;
        
        // For points rewards, extract the kind
        if (voucherTypeKey.includes("POINTS")) {
          kindLabel = "POINTS";
        }
        
        const success = await saveVoucherType(typeToSave, {
          ...voucherPayload,
          voucherKind: kindLabel,
          selectedVoucherTypeKey: voucherTypeKey,
        }, {
          closeDialogs: false,
          showAlert: false,
          refreshUserData: false,
        });
        
        if (!success) return false;
      }
      
      // After all vouchers are saved, refresh data and close dialogs
      setWalkInBranchDialogOpen(false);
      await fetchUserData(user);
      return true;
    }
    
    // Original single voucher flow
    return await saveVoucherType(voucherPayload.voucherType, voucherPayload, {
      closeDialogs: true,
      showAlert: false,
      refreshUserData: true,
    });
  };

  const handleAddEntry = async () => {
    if (addingEntry) return;
    const entryAmount = Number(amount);
    const walletBalance = Number(userData?.eWallet || 0);
    if (!entryAmount || entryAmount < MIN_AMOUNT)
      return alert(`Minimum amount is ₱${MIN_AMOUNT}`);
    if (entryAmount > walletBalance)
      return alert("Insufficient wallet balance.");

    try {
      setAddingEntry(true);
      // 🔹 Get ID token
      const idToken = await user.getIdToken();
      const clientRequestId = `cs_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

      // 🔹 Call Cloud Function to create capital share entry (secure, idempotent)
      const response = await fetch(
        "https://us-central1-amayan-savings.cloudfunctions.net/addCapitalShare",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            amount: entryAmount,
            entryDate: selectedDate.toISOString(),
            referredBy: userData?.referredBy || null,
            clientRequestId,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        return alert(`❌ ${result.error || "Failed to add entry"}`);
      }

      alert("✅ Capital Share entry added successfully!");
      setAmount("");
      setOpenAddDialog(false);
      await fetchUserData(user);
      await fetchTransactionHistory();
    } catch (err) {
      console.error("Error adding capital share entry:", err);
      alert("❌ Failed to add entry.");
    } finally {
      setAddingEntry(false);
    }
  };

  const handleTransferProfitEntry = async (entry) => {
    console.log("🔍 handleTransferProfitEntry called with:", entry);
    
    // Validation
    if (!entry || !entry.id) {
      console.error("❌ Invalid entry:", entry);
      return alert("❌ Invalid entry. Please try again.");
    }

    console.log("Entry ID:", entry.id);
    console.log("Profit value:", entry.profit);
    console.log("Profit status:", entry.profitStatus);

    if (entry.profitStatus === "Claimed") {
      console.warn("Already claimed:", entry.id);
      return alert("✅ This profit has already been claimed.");
    }

    if (!entry.profit || entry.profit <= 0) {
      console.error("❌ Invalid profit amount:", entry.profit);
      return alert("⏳ No profit available yet. Please wait for the next profit cycle.");
    }

    // Prevent duplicate submissions
    if (claimingPeriodKey) {
      console.warn("Claim already in progress for period:", claimingPeriodKey);
      return alert("⏳ A claim is already in progress. Please wait...");
    }

    const periodKey = entry.periodKey || `${entry.id}_legacy`;
    setClaimingPeriodKey(periodKey);
    setProfitTransferLoading(true);
    const timeoutId = setTimeout(() => {
      setClaimingPeriodKey(null);
      setProfitTransferLoading(false);
      alert("❌ Request timeout. Please try again.");
    }, 30000); // 30 second timeout

    try {
      const idToken = await user.getIdToken();
      const profitAmount = Number(entry.profit) || 0;

      console.log("Profit amount (converted):", profitAmount, "Type:", typeof profitAmount);

      if (profitAmount <= 0) {
        console.error("❌ Invalid profit amount after conversion:", profitAmount);
        throw new Error("Profit amount is invalid");
      }

      const requestPayload = {
        entryId: entry.id,
        amount: profitAmount,
        periodKey,
        clientRequestId: `profit_${entry.id}_${Date.now()}`,
      };

      console.log("📤 Sending to Cloud Function:", requestPayload);

      const response = await fetch("https://us-central1-amayan-savings.cloudfunctions.net/transferProfit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          entryId: entry.id,
          amount: profitAmount,
          periodKey,
          clientRequestId: `profit_${entry.id}_${Date.now()}`,
        }),
      });

      clearTimeout(timeoutId);
      console.log("📥 Cloud Function response status:", response.status);
      
      const result = await response.json();
      console.log("📥 Cloud Function response body:", result);

      if (!response.ok) {
        setClaimingPeriodKey(null);
        setProfitTransferLoading(false);
        const errorMsg = result.error || result.message || "Profit transfer failed.";
        console.error("❌ Cloud Function error response:", { status: response.status, error: result });
        return alert(`❌ ${errorMsg}`);
      }

      // Success
      console.log("✅ Profit claim successful!");
      alert(`✅ ₱${profitAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} has been credited to your e-wallet!`);
      
      // Refresh data
      console.log("🔄 Refreshing user data...");
      setClaimingPeriodKey(null);
      setProfitTransferLoading(false);
      setDetailedProfitHistoryOpen(false);
      await fetchUserData(user);
      await fetchTransactionHistory();
      console.log("✅ Data refreshed");
    } catch (err) {
      clearTimeout(timeoutId);
      setClaimingPeriodKey(null);
      setProfitTransferLoading(false);
      console.error("❌ Profit transfer error:", err.message, err);
      alert("❌ Network error. Please check your connection and try again.");
    }
  };

  const handleTransferCapitalToWallet = async (entry) => {
    const now = new Date();
    const transferableAfterDate = entry.transferableAfterDate instanceof Date
      ? entry.transferableAfterDate
      : entry.transferableAfterDate?.toDate?.();

    // Check if past transferable date
    if (!transferableAfterDate || now < transferableAfterDate) {
      return alert("❌ This entry is not yet transferable. Please wait until the 1-month period has passed.");
    }

    // Check if there's transferable portion
    if (!entry.transferablePortion || entry.transferablePortion <= 0) {
      return alert("❌ No transferable portion available for this entry.");
    }

    // Check if already transferred
    if (entry.transferredAmount && entry.transferredAmount >= entry.transferablePortion) {
      return alert("❌ This entry has already been fully transferred.");
    }

    const transferAmount = entry.transferablePortion - (entry.transferredAmount || 0);

    try {
      const idToken = await user.getIdToken();
      const response = await fetch("https://us-central1-amayan-savings.cloudfunctions.net/transferCapitalShare", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          entryId: entry.id,
          amount: transferAmount,
          clientRequestId: `capshare_${entry.id}`,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        return alert(`❌ ${result.error || "Transfer failed."}`);
      }

      alert(`✅ Transferred ₱${transferAmount.toLocaleString()} to wallet.\n\n💰 Monthly profit continues on remaining lock-in.`);
      await fetchUserData(user);
      await fetchTransactionHistory();
    } catch (err) {
      console.error("Capital share transfer error:", err);
      alert("❌ Transfer failed.");
    }
  };

  if (loading)
    return (
      <Backdrop open>
        <CircularProgress color="inherit" />
      </Backdrop>
    );

  // Removed: handleSelectEvent (no longer used)

  // Removed: eventStyleGetter (no longer used)

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        background: memberShellBackground,
        position: "relative",
        '&::before': {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(180deg, rgba(6,20,52,0.62) 0%, rgba(8,26,62,0.2) 36%, rgba(8,26,62,0) 58%)',
          zIndex: 0,
        },
      }}
    >
      <MemberBottomNav />

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 4 },
          pt: { xs: memberPageTopInset, sm: 3 },
          pb: { xs: 12, sm: 12, md: 12 },
          color: "white",
          overflowY: "auto",
          maxHeight: "100vh",
          position: "relative",
          width: "100%",
          transition: "all 0.3s ease",
        }}
      >
        {/* Header Section */}
        <Box sx={{ mb: 4, width: '100%', maxWidth: 900, ...memberGlassPanelSx, borderRadius: 3, p: { xs: 2, sm: 2.6 }, border: '1px solid rgba(217,233,255,0.2)', background: memberHeroBackground }}>
          <Typography variant={isMobile ? "h5" : "h4"} sx={{ fontWeight: 900, letterSpacing: 0.4, mb: 1, color: '#fff' }}>
            Capital Share Portfolio
          </Typography>
          <Typography variant="h6" sx={{ color: memberPalette.softText, fontWeight: 500, mb: 0 }}>
            <Box component="span" sx={{ color: '#fff', fontWeight: 700 }}>Grow Capital</Box>
            <Box component="span" sx={{ mx: 1, color: memberPalette.gold }}>•</Box>
            <Box component="span" sx={{ color: '#fff', fontWeight: 700 }}>Earn Monthly Profit</Box>
            <Box component="span" sx={{ mx: 1, color: memberPalette.gold }}>•</Box>
            <Box component="span" sx={{ color: '#fff', fontWeight: 700 }}>Manage Shares</Box>
          </Typography>
        </Box>



        <Grid container spacing={2.5} sx={{ mb: 4, width: '100%', maxWidth: 900, flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
          {/* Capital Share Card - full width on mobile */}
          <Grid item xs={12} md={12} sx={{ mb: { xs: 2, md: 0 }, display: 'flex', width: '100%' }}>
            <Card
              sx={{
                background: `linear-gradient(135deg, rgba(10,31,68,0.84), rgba(15,78,168,0.42), rgba(212,175,55,0.18))`,
                backdropFilter: "blur(14px)",
                border: `1px solid rgba(212,175,55,0.34)`,
                borderRadius: "18px",
                p: 3,
                width: '100%',
                minWidth: 0,
                boxShadow: "0 14px 30px rgba(4,16,40,0.28)",
                transition: "transform 0.3s, box-shadow 0.3s",
                position: "relative",
                overflow: "hidden",
                '&::before': {
                  content: '""',
                  position: "absolute",
                  top: 0,
                  right: 0,
                  width: "100px",
                  height: "100px",
                  background: `radial-gradient(circle, rgba(212,175,55,0.25), transparent)`,
                  borderRadius: "50%",
                },
                '&:hover': {
                  transform: "translateY(-6px)",
                  boxShadow: `0 22px 40px rgba(212,175,55,0.3)`,
                  border: `1px solid rgba(212,175,55,0.52)`,
                },
              }}
            >
              <Box sx={{ position: "relative", zIndex: 1 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
                  <Box sx={{ fontSize: "2.5rem" }}>💰</Box>
                </Box>
                <Typography variant="body2" sx={{ opacity: 1, mb: 1, color: "#fff", fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, textShadow: '1px 1px 4px #000' }}>
                  Capital Share
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, color: memberPalette.gold, mb: 1, lineHeight: 1, textShadow: '1px 1px 4px #000' }}>
                  ₱{Number(capitalAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Typography>
                {capitalAmount > 0 && (
                  <Box sx={{ mt: 1.5 }}>
                    {(() => {
                      const totalLockIn = transactionHistory.reduce((sum, t) => sum + (t.lockInPortion || 0), 0);
                      return (
                        <>
                          <Typography variant="body2" sx={{ color: memberPalette.softText, fontWeight: 600, fontSize: 13, mb: 0.5 }}>
                            🔒 Total Lock-in: ₱{totalLockIn.toLocaleString()}
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#81C784', fontWeight: 600, fontSize: 13 }}>
                            📦 Net Transferable: ₱{(capitalAmount - totalLockIn).toLocaleString()}
                          </Typography>
                        </>
                      );
                    })()}
                  </Box>
                )}
                {userData?.capitalShareActive && (
                  <Box sx={{ mt: 2, p: 1.5, bgcolor: 'rgba(79, 195, 247, 0.1)', borderRadius: 1, border: '1px solid rgba(79, 195, 247, 0.3)' }}>
                    {(() => {
                      const activatedAt = userData?.capitalActivatedAt?.toDate?.() || (userData?.capitalActivatedAt ? new Date(userData.capitalActivatedAt) : null);
                      if (!activatedAt) return null;
                      const expirationDate = new Date(activatedAt);
                      expirationDate.setFullYear(expirationDate.getFullYear() + 1);
                      const now = new Date();
                      const daysRemaining = Math.ceil((expirationDate - now) / (1000 * 60 * 60 * 24));
                      const isExpired = now > expirationDate;
                      
                      return (
                        <>
                          <Typography variant="body2" sx={{ color: '#FFB74D', fontWeight: 600, fontSize: 12, mb: 0.5 }}>
                            ⏰ Activation Status
                          </Typography>
                          <Typography variant="body2" sx={{ color: isExpired ? '#EF5350' : '#81C784', fontWeight: 600, fontSize: 12 }}>
                            {isExpired ? '❌ Expired' : `✅ Active (${daysRemaining} days remaining)`}
                          </Typography>
                        </>
                      );
                    })()}
                  </Box>
                )}
              </Box>
            </Card>
          </Grid>
          {/* Monthly Profit Card - responsive */}
          <Grid item xs={12} md={6} sx={{ display: 'flex', width: '100%' }}>
            <Card
              sx={{
                background: `linear-gradient(120deg, rgba(10,31,68,0.78) 48%, rgba(15,78,168,0.46) 100%)`,
                backdropFilter: "blur(14px)",
                border: `1px solid rgba(217,226,255,0.35)`,
                borderRadius: "18px",
                p: 3,
                width: '100%',
                minWidth: 0,
                boxShadow: "0 14px 30px rgba(4,16,40,0.28)",
                transition: "transform 0.3s, box-shadow 0.3s",
                position: "relative",
                overflow: "hidden",
                '&::before': {
                  content: '""',
                  position: "absolute",
                  top: 0,
                  right: 0,
                  width: "100px",
                  height: "100px",
                  background: `radial-gradient(circle, rgba(212,175,55,0.20), transparent)`,
                  borderRadius: "50%",
                },
                '&:hover': {
                  transform: "translateY(-6px)",
                  boxShadow: `0 22px 40px rgba(15,78,168,0.32)`,
                  border: `1px solid rgba(217,226,255,0.55)` ,
                },
              }}
            >
              <Box sx={{ position: "relative", zIndex: 1 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
                  <Box sx={{ fontSize: "2.5rem" }}>📈</Box>
                </Box>
                <Typography variant="body2" sx={{ opacity: 1, mb: 1, color: "#fff", fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, textShadow: '1px 1px 4px #000' }}>
                  Unclaimed Profit (5%)
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.7, mb: 2, color: "#FFB74D", fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3 }}>
                  Total from all active entries
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, color: "#e8eefe", mb: 2, lineHeight: 1, textShadow: '1px 1px 4px #000' }}>
                  ₱{Number(monthlyProfit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  sx={{ width: "100%", fontWeight: 700, borderRadius: 1.5, textTransform: 'none', px: 2, py: 0.8, fontSize: 13, borderColor: "#90CAF9", color: "#90CAF9" }}
                  onClick={() => setDetailedProfitHistoryOpen(true)}
                >
                  View Detailed History
                </Button>
              </Box>
            </Card>
          </Grid>
          {/* Add Capital Share Button */}
          <Grid item xs={12} md={6} sx={{ display: 'flex', width: '100%' }}>
            <Card
              sx={{
                ...memberGlassPanelSx,
                background: `linear-gradient(140deg, rgba(8,26,62,0.86) 0%, rgba(12,46,106,0.76) 100%)`,
                border: "1px solid rgba(217,233,255,0.2)",
                borderRadius: 3,
                p: 3,
                minHeight: 220,
                width: '100%',
                maxWidth: 900,
                boxShadow: '0 14px 30px rgba(4,16,40,0.28)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
              }}
            >
              <Typography variant="body2" sx={{ opacity: 1, mb: 1, color: memberPalette.cloud, fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Instruction
              </Typography>
              <Typography variant="body2" sx={{ mt: 1, mb: 2, color: memberPalette.softText, fontWeight: 600, fontSize: 13 }}>
                📝 To add a capital share entry:
              </Typography>
              <Typography variant="body2" sx={{ mb: 1, color: memberPalette.softText, fontWeight: 600, fontSize: 13 }}>
                1. Click "Add Capital Share" button below
              </Typography>
              <Typography variant="body2" sx={{ mb: 1, color: memberPalette.softText, fontWeight: 600, fontSize: 13 }}>
                2. Select the date and enter amount (min ₱1,000)
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, color: memberPalette.softText, fontWeight: 600, fontSize: 13 }}>
                3. Confirm to deduct from your E-Wallet
              </Typography>
              <Button
                variant="contained"
                color="primary"
                fullWidth
                sx={{ mt: 1, fontWeight: 700, borderRadius: 2, textTransform: 'none', px: 2.5, py: 1, fontSize: 15, background: `linear-gradient(135deg, ${memberPalette.azure}, ${memberPalette.royal})` }}
                onClick={() => {
                  if (!userData?.capitalShareActive) {
                    alert("Activate Capital Share first.");
                    return;
                  }
                  if (userData?.activationExpired) {
                    alert("⚠️ Your Capital Share activation has expired. Please activate a new code to add new entries.");
                    setOpenDialog(true);
                    return;
                  }
                  setSelectedDate(new Date());
                  setOpenAddDialog(true);
                }}
              >
                Add Capital Share
              </Button>
              {/* Moved Transaction History Button Below */}
              </Card>
          </Grid>
        </Grid>




        {/* Add Capital Share Dialog */}
        <AddCapitalShareDialog
          open={openAddDialog}
          onClose={() => setOpenAddDialog(false)}
          amount={amount}
          setAmount={setAmount}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          userData={userData}
          MIN_AMOUNT={MIN_AMOUNT}
          onConfirm={handleAddEntry}
        />

        {/* Activation Overlay - Only show if NOT activated at all */}
        {!userData?.capitalShareActive && !userData?.activationExpired && (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              backgroundColor: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9,
            }}
          >
            <Card sx={{ p: 4, width: 400, textAlign: "center" }}>
              <Typography variant="h6" gutterBottom>
                🧩 Capital Share Not Activated
              </Typography>
              {codes.length > 0 ? (
                <>
                  <Typography variant="body2" color="text.secondary">
                    You have available <strong>Activate Capital Share</strong> codes.
                  </Typography>
                  <Button sx={{ mt: 2 }} variant="contained" onClick={() => setOpenDialog(true)}>
                    Activate Now
                  </Button>
                </>
              ) : (
                <>
                  <Typography variant="body2" color="text.secondary">
                    You don’t have an activation code yet.
                  </Typography>
                  <Button
                    sx={{ mt: 2 }}
                    variant="contained"
                    color="secondary"
                    onClick={() => alert("Please purchase an 'Activate Capital Share' code first.")}
                  >
                    Purchase Code
                  </Button>
                </>
              )}
            </Card>
          </Box>
        )}

        {/* Activate Dialog */}
        <Dialog open={openDialog} onClose={() => setOpenDialog(false)} fullWidth maxWidth="xs" PaperProps={{
          sx: {
            background: "linear-gradient(150deg, rgba(8,26,62,0.96) 0%, rgba(13,44,102,0.92) 100%)",
            backdropFilter: "blur(14px)",
            border: "1px solid rgba(217,233,255,0.22)",
          }
        }}>
          <DialogTitle sx={{ bgcolor: "rgba(8,31,76,0.75)", color: "#d9e9ff", fontWeight: 700, borderBottom: "1px solid rgba(217,233,255,0.15)" }}>Activate Capital Share</DialogTitle>
          <DialogContent sx={{ bgcolor: "transparent", mt: 2 }}>
            <Box sx={{ mb: 2, p: 1.5, bgcolor: 'rgba(255, 193, 7, 0.1)', border: '1px solid rgba(255, 193, 7, 0.3)', borderRadius: 1 }}>
              <Typography variant="body2" sx={{ mb: 1, color: "#FFB74D", fontWeight: 600 }}>
                ⏰ Activation Valid for 1 Year
              </Typography>
              <Typography variant="body2" sx={{ color: "#b0bec5", fontWeight: 500, fontSize: 12, lineHeight: 1.6 }}>
                • Your activation will be valid for 1 year from the activation date
              </Typography>
              <Typography variant="body2" sx={{ color: "#b0bec5", fontWeight: 500, fontSize: 12, lineHeight: 1.6 }}>
                • You can add capital share entries during this 1-year period
              </Typography>
              <Typography variant="body2" sx={{ color: "#b0bec5", fontWeight: 500, fontSize: 12, lineHeight: 1.6 }}>
                • To continue after 1 year, activate a new code to renew
              </Typography>
              <Typography variant="body2" sx={{ color: "#b0bec5", fontWeight: 500, fontSize: 12, lineHeight: 1.6, mt: 1 }}>
                • When you renew, you'll get a new capital share voucher
              </Typography>
            </Box>
            <TextField
              select
              fullWidth
              SelectProps={{ native: true }}
              value={selectedCode}
              onChange={(e) => setSelectedCode(e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { color: '#d9e9ff', background: 'rgba(6,20,52,0.42)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(217,233,255,0.35)' }, '& .MuiInputBase-input': { color: '#d9e9ff' } }}
              inputProps={{ style: { color: '#b0bec5' } }}
            >
              <option value="">-- Select Code --</option>
              {codes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}
                </option>
              ))}
            </TextField>
          </DialogContent>
          <DialogActions sx={{ borderTop: "1px solid rgba(217,233,255,0.15)", pt: 2 }}>
            <Button onClick={() => setOpenDialog(false)} sx={{ fontWeight: 700, borderRadius: 1.5, textTransform: 'none', color: '#d9e9ff' }}>Cancel</Button>
            <Button variant="contained" onClick={handleActivate} sx={{ fontWeight: 700, borderRadius: 1.5, textTransform: 'none', background: `linear-gradient(135deg, ${memberPalette.azure}, ${memberPalette.royal})` }}>
              Activate
            </Button>
          </DialogActions>
        </Dialog>

        <CapitalShareVoucherDialog
          open={voucherDialogOpen}
          onClose={() => setVoucherDialogOpen(false)}
          voucherType={voucherType}
          onVoucherTypeChange={setVoucherType}
          onWalkInClick={() => {
            setWalkInBranchDialogOpen(true);
            setVoucherDialogOpen(false);
          }}
          onOfwClick={handleOfwSelect}
        />

        <WalkInBranchDialog
          open={walkInBranchDialogOpen}
          adminRewardConfigs={voucherRewardConfigs}
          onClose={() => {
            setWalkInBranchDialogOpen(false);
            setVoucherDialogOpen(true);
          }}
          onConfirmDone={handleVoucherDone}
          saving={savingVoucherType}
          onDone={() => {
            setWalkInBranchDialogOpen(false);
            setVoucherDialogOpen(false);
          }}
          onViewVouchers={() => {
            setWalkInBranchDialogOpen(false);
            setVoucherDialogOpen(false);
            navigate("/member/vouchers");
          }}
        />

        <OFWRewardsDialog
          open={ofwRewardsDialogOpen}
          onClose={() => {
            setOfwRewardsDialogOpen(false);
            setVoucherDialogOpen(true);
          }}
          onConfirmDone={handleVoucherDone}
          saving={savingVoucherType}
          onDone={() => {
            setOfwRewardsDialogOpen(false);
            setVoucherDialogOpen(false);
          }}
          onViewVouchers={() => {
            setOfwRewardsDialogOpen(false);
            setVoucherDialogOpen(false);
            navigate("/member/vouchers");
          }}
        />

        {/* History Dialog */}
        {/* Capital Share Transactions Section - always visible below Add Capital Share */}
        <CapitalShareTransactions
          transactionHistory={transactionHistory}
          onViewDetails={(entry) => {
            setEntryDetailsOpen(true);
            setSelectedEntry(entry);
          }}
          onTransferCapital={handleTransferCapitalToWallet}
          totalLockIn={transactionHistory.reduce((sum, t) => sum + (t.lockInPortion || 0), 0)}
        />

        {/* Monthly Profit History Dialog */}
        <ProfitHistoryDialog
          open={profitHistoryOpen}
          onClose={() => setProfitHistoryOpen(false)}
          transactionHistory={transactionHistory}
          transferLoading={profitTransferLoading}
          onTransferProfit={(entry) => {
            setSelectedProfitEntry(entry);
            setProfitConfirmOpen(true);
          }}
        />

        {/* Capital Share Profit Breakdown Dialog */}
        <CapitalShareProfitBreakdown
          open={profitBreakdownOpen}
          onClose={() => setProfitBreakdownOpen(false)}
          transactionHistory={transactionHistory}
        />

        {/* Detailed Profit Claims History Dialog */}
        <DetailedProfitClaimsHistory
          open={detailedProfitHistoryOpen}
          onClose={() => setDetailedProfitHistoryOpen(false)}
          transactionHistory={transactionHistory}
          onTransferProfit={handleTransferProfitEntry}
          transferLoading={profitTransferLoading}
          claimingPeriodKey={claimingPeriodKey}
        />

        {/* Confirm Profit Transfer Dialog */}
        <Dialog
          open={profitConfirmOpen}
          onClose={() => {
            setProfitConfirmOpen(false);
            setSelectedProfitEntry(null);
          }}
          fullWidth
          maxWidth="xs"
          PaperProps={{
            sx: {
              background: "linear-gradient(150deg, rgba(8,26,62,0.96) 0%, rgba(13,44,102,0.92) 100%)",
              backdropFilter: "blur(14px)",
              border: "1px solid rgba(217,233,255,0.22)",
            }
          }}
        >
          <DialogTitle sx={{ bgcolor: "rgba(8,31,76,0.75)", color: "#d9e9ff", fontWeight: 700, borderBottom: "1px solid rgba(217,233,255,0.15)" }}>Confirm Transfer</DialogTitle>
          <DialogContent sx={{ bgcolor: "transparent", mt: 2 }}>
            <Typography sx={{ color: '#d9e9ff' }}>
              Transfer profit of ₱{Number(selectedProfitEntry?.profit || 0).toLocaleString()} to your wallet?
            </Typography>
          </DialogContent>
          <DialogActions sx={{ borderTop: "1px solid rgba(217,233,255,0.15)", pt: 2 }}>
            <Button
              onClick={() => {
                setProfitConfirmOpen(false);
                setSelectedProfitEntry(null);
              }}
              disabled={profitTransferLoading}
              sx={{ fontWeight: 700, borderRadius: 1.5, textTransform: 'none', color: '#d9e9ff' }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              disabled={profitTransferLoading}
              onClick={async () => {
                if (!selectedProfitEntry) return;
                setProfitTransferLoading(true);
                try {
                  await handleTransferProfitEntry(selectedProfitEntry);
                  setProfitConfirmOpen(false);
                  setSelectedProfitEntry(null);
                } finally {
                  setProfitTransferLoading(false);
                }
              }}
              sx={{ fontWeight: 700, borderRadius: 1.5, textTransform: 'none', background: `linear-gradient(135deg, ${memberPalette.azure}, ${memberPalette.royal})` }}
            >
              {profitTransferLoading ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                "Confirm"
              )}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Entry Details Dialog */}
        <EntryDetailsDialog
          open={entryDetailsOpen}
          onClose={() => {
            setEntryDetailsOpen(false);
            setSelectedEntry(null);
          }}
          selectedEntry={selectedEntry}
        />
      </Box>

      <style>{`
        .active-entry {
          background: rgba(76, 175, 80, 0.3) !important;
          border-radius: 50%;
        }
        .profit-ready {
          background: rgba(255, 193, 7, 0.5) !important;
          border-radius: 50%;
        }
      `}</style>
    </Box>
  );
};

export default MemberCapitalShare;