// src/pages/admin/adminVoucherRecords.jsx
import React, { useEffect, useState } from "react";
import {
  Box,
  Toolbar,
  Typography,
  Card,
  CardContent,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  CircularProgress,
  Tooltip,
  useMediaQuery,
  Drawer,
  TextField,
  InputAdornment,
  Paper,
  Chip,
  Pagination,
  TableContainer,
  Button,
  MenuItem,
  FormControlLabel,
  Switch,
  IconButton,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CardGiftcardIcon from "@mui/icons-material/CardGiftcard";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { collection, query, onSnapshot, doc, getDoc, addDoc, deleteDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../firebase";
import { motion } from "framer-motion";
import Topbar from "../../components/Topbar";
import AppBottomNav from "../../components/AppBottomNav";
import AdminSidebarToggle from "../../components/AdminSidebarToggle";

const AdminVoucherRecords = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [voucherData, setVoucherData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [accessDenied, setAccessDenied] = useState(false);
  const [rewardConfigs, setRewardConfigs] = useState([]);
  const [savingConfig, setSavingConfig] = useState(false);
  const [newConfig, setNewConfig] = useState({
    label: "",
    rewardType: "VOUCHER",
    voucherKind: "RICE",
    branchName: "",
    branchAddress: "",
    branchEmail: "",
    active: true,
    splitRicePointsPercent: 50,
    splitMeatPointsPercent: 50,
  });

  const isMobile = useMediaQuery("(max-width:900px)");
  useEffect(() => setSidebarOpen(!isMobile), [isMobile]);

  const handleToggleSidebar = () => setSidebarOpen(prev => !prev);

  // Fetch all voucher records from capitalShareVouchers collection
  useEffect(() => {
    let unsubscribeVouchers = null;
    let unsubscribeConfigs = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        setVoucherData([]);
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      const role = String(localStorage.getItem("userRole") || "").trim().toUpperCase();
      if (!["ADMIN", "CEO"].includes(role)) {
        setVoucherData([]);
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      setAccessDenied(false);
      setLoading(true);

      const q = query(collection(db, "capitalShareVouchers"));
      const configQ = query(collection(db, "voucherRewardConfigs"));
      unsubscribeVouchers = onSnapshot(
        q,
        async (snap) => {
          const tempData = [];

          // Safely convert Firestore timestamps to Date objects
          const convertToDate = (value) => {
            if (!value) return null;
            if (value instanceof Date) return value;
            if (typeof value.toDate === "function") return value.toDate();
            try {
              const date = new Date(value);
              return isNaN(date.getTime()) ? null : date;
            } catch {
              return null;
            }
          };

          for (const docRef of snap.docs) {
            const userId = docRef.id;
            const voucherData = docRef.data();

            // Fetch user info to get merchant/user details
            const userSnap = await getDoc(doc(db, "users", userId));
            const userData = userSnap.exists() ? userSnap.data() : {};

            // Flatten voucher records with user info
            if (voucherData.vouchers && Array.isArray(voucherData.vouchers)) {
              voucherData.vouchers.forEach((voucher, index) => {
                tempData.push({
                  id: `${userId}_${index}`,
                  userId,
                  voucherId: voucher.voucherCode,
                  voucherType: voucher.voucherType,
                  voucherStatus: voucher.voucherStatus,
                  voucherKind: voucher.voucherKind || "",
                  claimablePercent: Number(voucher.claimablePercent || 100),
                  holdReason: voucher.holdReason || "",
                  branchName: voucher.branchName || "N/A",
                  branchAddress: voucher.branchAddress || "N/A",
                  branchEmail: voucher.branchEmail || "N/A",
                  issuedAt: convertToDate(voucher.voucherIssuedAt),
                  createdAt: convertToDate(voucher.createdAt),
                  userName: userData.name || "Unknown",
                  userEmail: userData.email || "Unknown",
                  userRole: userData.role || "MEMBER",
                });
              });
            }
          }

          setVoucherData(tempData);
          setLoading(false);
        },
        (err) => {
          console.error("Error fetching voucher records:", err);
          if (err?.code === "permission-denied") {
            setAccessDenied(true);
          }
          setLoading(false);
        }
      );

      unsubscribeConfigs = onSnapshot(
        configQ,
        (snap) => {
          const configs = snap.docs
            .map((configDoc) => ({ id: configDoc.id, ...configDoc.data() }))
            .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
          setRewardConfigs(configs);
        },
        (err) => {
          console.error("Error fetching voucher reward configs:", err);
        }
      );
    });

    return () => {
      if (unsubscribeVouchers) unsubscribeVouchers();
      if (unsubscribeConfigs) unsubscribeConfigs();
      unsubscribeAuth();
    };
  }, []);

  const parsePercent = (value) => {
    const num = Number(value);
    if (Number.isNaN(num)) return 0;
    if (num < 0) return 0;
    if (num > 100) return 100;
    return num;
  };

  const buildDefaultSplitTargets = () => {
    const ricePointsPercent = parsePercent(newConfig.splitRicePointsPercent);
    const meatPointsPercent = parsePercent(newConfig.splitMeatPointsPercent);
    return [
      {
        voucherKind: "RICE",
        claimablePercent: 100 - ricePointsPercent,
        pointsConvertPercent: ricePointsPercent,
        voucherStatus: "HOLD",
      },
      {
        voucherKind: "MEAT",
        claimablePercent: 100 - meatPointsPercent,
        pointsConvertPercent: meatPointsPercent,
        voucherStatus: "HOLD",
      },
    ].filter((target) => target.claimablePercent > 0);
  };

  const resetConfigForm = () => {
    setNewConfig({
      label: "",
      rewardType: "VOUCHER",
      voucherKind: "RICE",
      branchName: "",
      branchAddress: "",
      branchEmail: "",
      active: true,
      splitRicePointsPercent: 50,
      splitMeatPointsPercent: 50,
    });
  };

  const validateSplitTargets = (splitTargets) => {
    if (!splitTargets.length) {
      return "Please configure at least one split target above 0%.";
    }

    const hasInvalidTarget = splitTargets.some((target) => {
      const claimablePercent = Number(target.claimablePercent || 0);
      const pointsConvertPercent = Number(target.pointsConvertPercent || 0);
      return claimablePercent + pointsConvertPercent !== 100;
    });

    if (hasInvalidTarget) {
      return "Each split target must total exactly 100% between points and voucher.";
    }

    return "";
  };

  const handleCreateConfig = async () => {
    try {
      setSavingConfig(true);
      const role = String(localStorage.getItem("userRole") || "").trim().toUpperCase();
      if (!["ADMIN", "CEO"].includes(role)) {
        alert("Only ADMIN/CEO can create voucher reward configs.");
        return;
      }

      const label = String(newConfig.label || "").trim();
      if (!label) {
        alert("Please enter a reward label.");
        return;
      }

      const rewardType = String(newConfig.rewardType || "VOUCHER").toUpperCase();
      const payload = {
        label,
        rewardType,
        active: newConfig.active !== false,
        sortOrder: rewardConfigs.length,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (rewardType === "VOUCHER") {
        payload.voucherKind = String(newConfig.voucherKind || "").toUpperCase();
        payload.branchName = String(newConfig.branchName || "").trim();
        payload.branchAddress = String(newConfig.branchAddress || "").trim();
        payload.branchEmail = String(newConfig.branchEmail || "").trim().toLowerCase();
      } else {
        const splitTargets = buildDefaultSplitTargets();
        const splitValidationError = validateSplitTargets(splitTargets);
        if (splitValidationError) {
          alert(splitValidationError);
          return;
        }
        payload.splitTargets = splitTargets;
      }

      await addDoc(collection(db, "voucherRewardConfigs"), payload);
      resetConfigForm();
    } catch (err) {
      console.error("Failed to create voucher reward config:", err);
      alert("Failed to create voucher reward config.");
    } finally {
      setSavingConfig(false);
    }
  };

  const handleCreateDefaultRewardSet = async () => {
    try {
      setSavingConfig(true);
      const role = String(localStorage.getItem("userRole") || "").trim().toUpperCase();
      if (!["ADMIN", "CEO"].includes(role)) {
        alert("Only ADMIN/CEO can create voucher reward configs.");
        return;
      }

      const existingKeys = new Set(
        rewardConfigs.map((cfg) => {
          const type = String(cfg.rewardType || "VOUCHER").toUpperCase();
          const label = String(cfg.label || "").trim().toLowerCase();
          return `${type}::${label}`;
        })
      );

      const defaults = [
        {
          label: "Rice Voucher",
          rewardType: "VOUCHER",
          voucherKind: "RICE",
          branchName: "",
          branchAddress: "",
          branchEmail: "",
          active: true,
        },
        {
          label: "Meat Voucher",
          rewardType: "VOUCHER",
          voucherKind: "MEAT",
          branchName: "",
          branchAddress: "",
          branchEmail: "",
          active: true,
        },
        {
          label: "Points Reward",
          rewardType: "POINTS_SPLIT",
          splitTargets: buildDefaultSplitTargets(),
          active: true,
        },
      ];

      const splitValidationError = validateSplitTargets(buildDefaultSplitTargets());
      if (splitValidationError) {
        alert(splitValidationError);
        return;
      }

      let created = 0;
      let skipped = 0;

      for (let i = 0; i < defaults.length; i += 1) {
        const item = defaults[i];
        const key = `${item.rewardType}::${String(item.label || "").trim().toLowerCase()}`;
        if (existingKeys.has(key)) {
          skipped += 1;
          continue;
        }

        await addDoc(collection(db, "voucherRewardConfigs"), {
          ...item,
          sortOrder: rewardConfigs.length + created,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        created += 1;
      }

      if (created > 0) {
        resetConfigForm();
      }
      alert(`Default reward set created: ${created}. Skipped existing: ${skipped}.`);
    } catch (err) {
      console.error("Failed to create default reward set:", err);
      alert("Failed to create default reward set.");
    } finally {
      setSavingConfig(false);
    }
  };

  const handleToggleConfigActive = async (configItem) => {
    try {
      await updateDoc(doc(db, "voucherRewardConfigs", configItem.id), {
        active: !(configItem.active !== false),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Failed to toggle reward config:", err);
      alert("Failed to update reward config status.");
    }
  };

  const handleDeleteConfig = async (configId) => {
    try {
      await deleteDoc(doc(db, "voucherRewardConfigs", configId));
    } catch (err) {
      console.error("Failed to delete reward config:", err);
      alert("Failed to delete reward config.");
    }
  };

  // Filter and paginate data
  const filteredData = voucherData.filter((item) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      item.voucherId.toLowerCase().includes(searchLower) ||
      item.userName.toLowerCase().includes(searchLower) ||
      item.userEmail.toLowerCase().includes(searchLower) ||
      item.voucherType.toLowerCase().includes(searchLower) ||
      item.branchName.toLowerCase().includes(searchLower)
    );
  });

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);

  const formatDate = (date) => {
    if (!date) return "N/A";
    try {
      // Check if it's a valid date
      if (date instanceof Date && isNaN(date.getTime())) {
        return "N/A";
      }
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    } catch (err) {
      console.error("Date formatting error:", err, "Date value:", date);
      return "N/A";
    }
  };

  const getVoucherTypeColor = (type) => {
    if (type === "OFW") return "#10b981";
    if (type === "WALK_IN") return "#3b82f6";
    return "#6b7280";
  };

  const getStatusColor = (status) => {
    if (status === "ACTIVE") return "#22c55e";
    if (status === "HOLD") return "#f59e0b";
    if (status === "REDEEMED") return "#f59e0b";
    if (status === "USED") return "#f59e0b";
    if (status === "EXPIRED") return "#ef4444";
    return "#6b7280";
  };

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        backgroundColor: "#1a1a1a",
        position: "relative",
      }}
    >
      {/* Topbar */}
      <Box sx={{ position: "fixed", width: "100%", zIndex: 1200 }}>
        <Topbar open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
      </Box>

      {/* Sidebar */}
      {!isMobile && (
        <Box sx={{ zIndex: 5 }}>
          <AppBottomNav open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
        </Box>
      )}

      {isMobile && (
        <>
          <AdminSidebarToggle onClick={handleToggleSidebar} />
          <Drawer
            anchor="left"
            open={sidebarOpen}
            onClose={handleToggleSidebar}
            ModalProps={{ keepMounted: true }}
            PaperProps={{
              sx: {
                background: "transparent",
                boxShadow: "none",
              },
            }}
          >
            <AppBottomNav open={sidebarOpen} onToggleSidebar={handleToggleSidebar} layout="sidebar" />
          </Drawer>
        </>
      )}

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: isMobile ? 1.5 : 4,
          mt: 0,
          pb: { xs: 3, sm: 12, md: 12 },
          color: "white",
          zIndex: 1,
          width: "100%",
          paddingLeft: 0,
          transition: "all 0.3s ease",
          position: "relative",
        }}
      >
        <Toolbar />

        {/* Header Card */}
        <Card
          component={motion.div}
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          sx={{
            mb: 3,
            background: "linear-gradient(135deg, rgba(16,185,129,0.15), rgba(59,130,246,0.1))",
            border: "1px solid rgba(16,185,129,0.2)",
            borderRadius: 3,
          }}
        >
          <CardContent sx={{ pb: 2, px: isMobile ? 1.5 : 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: isMobile ? 1 : 2, mb: 2, flexDirection: isMobile ? "column" : "row", textAlign: isMobile ? "center" : "left" }}>
              <CardGiftcardIcon sx={{ fontSize: isMobile ? 24 : 32, color: "#10b981" }} />
              <Box>
                <Typography variant={isMobile ? "h6" : "h5"} sx={{ fontWeight: 700, color: "#fff" }}>
                  Voucher Record Management
                </Typography>
                <Typography variant={isMobile ? "caption" : "body2"} sx={{ color: "rgba(255,255,255,0.7)" }}>
                  Audit voucher records issued to members for capital share rewards
                </Typography>
              </Box>
            </Box>
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.6)", mt: 1 }}>
              📊 Total Records: <strong>{filteredData.length}</strong>
            </Typography>
          </CardContent>
        </Card>

        {/* Search Bar */}
        {!accessDenied && (
          <Card
            component={motion.div}
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.25 }}
            sx={{
              mb: 3,
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: 2,
            }}
          >
            <CardContent>
              <Typography variant="h6" sx={{ color: "#fff", fontWeight: 700, mb: 2 }}>
                Reward Config Builder
              </Typography>
              <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.75)", mb: 2 }}>
                Create vouchers that appear in member "Select Your Rewards" after selecting status.
              </Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" }, gap: 2 }}>
                <TextField
                  label="Reward Label"
                  value={newConfig.label}
                  onChange={(e) => setNewConfig((prev) => ({ ...prev, label: e.target.value }))}
                  fullWidth
                  InputLabelProps={{ sx: { color: "rgba(255,255,255,0.7)" } }}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      color: "#fff",
                      "& fieldset": { borderColor: "rgba(255,255,255,0.2)" },
                    },
                  }}
                />
                <TextField
                  select
                  label="Reward Type"
                  value={newConfig.rewardType}
                  onChange={(e) => setNewConfig((prev) => ({ ...prev, rewardType: e.target.value }))}
                  fullWidth
                  InputLabelProps={{ sx: { color: "rgba(255,255,255,0.7)" } }}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      color: "#fff",
                      "& fieldset": { borderColor: "rgba(255,255,255,0.2)" },
                    },
                  }}
                >
                  <MenuItem value="VOUCHER">Voucher</MenuItem>
                  <MenuItem value="POINTS_SPLIT">Points Reward Split</MenuItem>
                </TextField>

                {newConfig.rewardType === "VOUCHER" ? (
                  <>
                    <TextField
                      select
                      label="Voucher Kind"
                      value={newConfig.voucherKind}
                      onChange={(e) => setNewConfig((prev) => ({ ...prev, voucherKind: e.target.value }))}
                      fullWidth
                      InputLabelProps={{ sx: { color: "rgba(255,255,255,0.7)" } }}
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          color: "#fff",
                          "& fieldset": { borderColor: "rgba(255,255,255,0.2)" },
                        },
                      }}
                    >
                      <MenuItem value="RICE">Rice</MenuItem>
                      <MenuItem value="MEAT">Meat</MenuItem>
                    </TextField>
                    <TextField
                      label="Branch Name"
                      value={newConfig.branchName}
                      onChange={(e) => setNewConfig((prev) => ({ ...prev, branchName: e.target.value }))}
                      fullWidth
                      InputLabelProps={{ sx: { color: "rgba(255,255,255,0.7)" } }}
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          color: "#fff",
                          "& fieldset": { borderColor: "rgba(255,255,255,0.2)" },
                        },
                      }}
                    />
                    <TextField
                      label="Branch Address"
                      value={newConfig.branchAddress}
                      onChange={(e) => setNewConfig((prev) => ({ ...prev, branchAddress: e.target.value }))}
                      fullWidth
                      InputLabelProps={{ sx: { color: "rgba(255,255,255,0.7)" } }}
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          color: "#fff",
                          "& fieldset": { borderColor: "rgba(255,255,255,0.2)" },
                        },
                      }}
                    />
                    <TextField
                      label="Branch Email"
                      value={newConfig.branchEmail}
                      onChange={(e) => setNewConfig((prev) => ({ ...prev, branchEmail: e.target.value }))}
                      fullWidth
                      InputLabelProps={{ sx: { color: "rgba(255,255,255,0.7)" } }}
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          color: "#fff",
                          "& fieldset": { borderColor: "rgba(255,255,255,0.2)" },
                        },
                      }}
                    />
                  </>
                ) : (
                  <>
                    <TextField
                      label="Rice Points %"
                      type="number"
                      value={newConfig.splitRicePointsPercent}
                      onChange={(e) => setNewConfig((prev) => ({ ...prev, splitRicePointsPercent: e.target.value }))}
                      fullWidth
                      InputLabelProps={{ sx: { color: "rgba(255,255,255,0.7)" } }}
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          color: "#fff",
                          "& fieldset": { borderColor: "rgba(255,255,255,0.2)" },
                        },
                      }}
                    />
                    <TextField
                      label="Meat Points %"
                      type="number"
                      value={newConfig.splitMeatPointsPercent}
                      onChange={(e) => setNewConfig((prev) => ({ ...prev, splitMeatPointsPercent: e.target.value }))}
                      fullWidth
                      InputLabelProps={{ sx: { color: "rgba(255,255,255,0.7)" } }}
                      sx={{
                        "& .MuiOutlinedInput-root": {
                          color: "#fff",
                          "& fieldset": { borderColor: "rgba(255,255,255,0.2)" },
                        },
                      }}
                    />
                    <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.7)", gridColumn: { xs: "1", md: "1 / -1" } }}>
                      Voucher claimable value is computed automatically as 100% minus the points value.
                    </Typography>
                  </>
                )}
              </Box>

              <Box sx={{ mt: 2, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={newConfig.active !== false}
                      onChange={(e) => setNewConfig((prev) => ({ ...prev, active: e.target.checked }))}
                    />
                  }
                  label={<Typography sx={{ color: "rgba(255,255,255,0.8)" }}>Active</Typography>}
                />
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                  <Button variant="outlined" disabled={savingConfig} onClick={handleCreateDefaultRewardSet}>
                    {savingConfig ? "Saving..." : "Create Default Reward Set"}
                  </Button>
                  <Button variant="contained" disabled={savingConfig} onClick={handleCreateConfig}>
                    {savingConfig ? "Saving..." : "Create Reward Config"}
                  </Button>
                </Box>
              </Box>

              <Box sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 1 }}>
                {rewardConfigs.length === 0 ? (
                  <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.6)" }}>
                    No reward config yet.
                  </Typography>
                ) : (
                  rewardConfigs.map((configItem) => (
                    <Box
                      key={configItem.id}
                      sx={{
                        p: 1.5,
                        borderRadius: 1.5,
                        border: "1px solid rgba(255,255,255,0.14)",
                        background: "rgba(255,255,255,0.04)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 1,
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ color: "#fff", fontWeight: 700 }}>
                          {configItem.label}
                        </Typography>
                        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.72)", display: "block" }}>
                          {String(configItem.rewardType || "VOUCHER").toUpperCase() === "POINTS_SPLIT"
                            ? (configItem.splitTargets || [])
                                .map((target) => {
                                  const claimable = Number(target.claimablePercent || 0);
                                  const pointsConvert = Number(target.pointsConvertPercent ?? 100 - claimable);
                                  return `${pointsConvert}% points + ${claimable}% ${String(target.voucherKind || "").toUpperCase()} voucher`;
                                })
                                .join(" + ")
                            : `${String(configItem.voucherKind || "").toUpperCase()} Voucher`}
                        </Typography>
                      </Box>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <Chip
                          label={configItem.active === false ? "INACTIVE" : "ACTIVE"}
                          onClick={() => handleToggleConfigActive(configItem)}
                          sx={{
                            cursor: "pointer",
                            background: configItem.active === false ? "#6b7280" : "#22c55e",
                            color: "#fff",
                            fontWeight: 700,
                          }}
                        />
                        <IconButton onClick={() => handleDeleteConfig(configItem.id)} sx={{ color: "#fecaca" }}>
                          <DeleteOutlineIcon />
                        </IconButton>
                      </Box>
                    </Box>
                  ))
                )}
              </Box>
            </CardContent>
          </Card>
        )}

        <Card
          component={motion.div}
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          sx={{
            mb: 3,
            background: "rgba(255, 255, 255, 0.08)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: 2,
          }}
        >
          <CardContent>
            <TextField
              fullWidth
              placeholder="Search by Voucher ID, User Name, Email, Type, or Branch..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: "rgba(255,255,255,0.5)" }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  color: "#fff",
                  "& fieldset": {
                    borderColor: "rgba(255,255,255,0.2)",
                  },
                  "&:hover fieldset": {
                    borderColor: "rgba(255,255,255,0.3)",
                  },
                },
              }}
            />
          </CardContent>
        </Card>

        {/* Data Table */}
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress />
          </Box>
        ) : accessDenied ? (
          <Card sx={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)", borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" sx={{ color: "#fecaca", fontWeight: 700, mb: 1 }}>
                Access Denied
              </Typography>
              <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.85)" }}>
                Your account does not have permission to view voucher records. Ensure your Firestore role is set to ADMIN or CEO.
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Desktop Table View */}
            {!isMobile && (
              <TableContainer
                component={Paper}
                sx={{
                  background: "rgba(255, 255, 255, 0.05)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: 2,
                  mb: 3,
                  overflow: "auto",
                }}
              >
                <Table>
                  <TableHead>
                    <TableRow sx={{ background: "rgba(255,255,255,0.08)" }}>
                      <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Voucher ID</TableCell>
                      <TableCell sx={{ color: "#fff", fontWeight: 700 }}>User Name</TableCell>
                      <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Email</TableCell>
                      <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Type</TableCell>
                      <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Status</TableCell>
                      <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Claim</TableCell>
                      <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Branch / Details</TableCell>
                      <TableCell sx={{ color: "#fff", fontWeight: 700 }}>Issued Date</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginatedData.length > 0 ? (
                      paginatedData.map((record, idx) => (
                        <TableRow
                          key={record.id}
                          sx={{
                            background: idx % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent",
                            borderBottom: "1px solid rgba(255,255,255,0.08)",
                            "&:hover": {
                              background: "rgba(255,255,255,0.06)",
                            },
                          }}
                        >
                          <TableCell sx={{ color: "rgba(255,255,255,0.9)" }}>
                            <Tooltip title={record.voucherId}>
                              <Typography variant="body2" sx={{ fontWeight: 600, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" }}>
                                {record.voucherId}
                              </Typography>
                            </Tooltip>
                          </TableCell>
                          <TableCell sx={{ color: "rgba(255,255,255,0.9)" }}>
                            <Typography variant="body2">{record.userName}</Typography>
                          </TableCell>
                          <TableCell sx={{ color: "rgba(255,255,255,0.8)", fontSize: "0.85rem" }}>
                            <Tooltip title={record.userEmail}>
                              <Typography variant="caption" sx={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>
                                {record.userEmail}
                              </Typography>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={record.voucherType === "OFW" ? "OFW" : "Walk-In"}
                              sx={{
                                background: getVoucherTypeColor(record.voucherType),
                                color: "#fff",
                                fontWeight: 600,
                                fontSize: "0.75rem",
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={record.voucherStatus}
                              sx={{
                                background: getStatusColor(record.voucherStatus),
                                color: "#fff",
                                fontWeight: 600,
                                fontSize: "0.75rem",
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ color: "rgba(255,255,255,0.8)", fontSize: "0.82rem" }}>
                            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.9)", display: "block" }}>
                              {record.claimablePercent}% {record.voucherKind ? String(record.voucherKind).toUpperCase() : ""}
                            </Typography>
                            {record.holdReason ? (
                              <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)", display: "block" }}>
                                {record.holdReason}
                              </Typography>
                            ) : null}
                          </TableCell>
                          <TableCell sx={{ color: "rgba(255,255,255,0.8)", fontSize: "0.85rem" }}>
                            <Tooltip title={`Address: ${record.branchAddress}\nEmail: ${record.branchEmail}`}>
                              <Typography variant="caption" sx={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>
                                {record.branchName || "(Remote / OFW)"}
                              </Typography>
                            </Tooltip>
                          </TableCell>
                          <TableCell sx={{ color: "rgba(255,255,255,0.8)", fontSize: "0.85rem" }}>
                            {formatDate(record.issuedAt)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} sx={{ textAlign: "center", py: 4, color: "rgba(255,255,255,0.5)" }}>
                          <Typography variant="body2">No voucher records found</Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {/* Mobile Card View */}
            {isMobile && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mb: 3 }}>
                {paginatedData.length > 0 ? (
                  paginatedData.map((record) => (
                    <Card
                      key={record.id}
                      sx={{
                        background: "rgba(255, 255, 255, 0.08)",
                        border: "1px solid rgba(255, 255, 255, 0.12)",
                        borderRadius: 2,
                        p: 1.5,
                      }}
                    >
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                        {/* Voucher ID and Status */}
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }}>Voucher ID</Typography>
                            <Tooltip title={record.voucherId}>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: "#fff", wordBreak: "break-word" }}>
                                {record.voucherId}
                              </Typography>
                            </Tooltip>
                          </Box>
                          <Chip
                            label={record.voucherStatus}
                            sx={{
                              background: getStatusColor(record.voucherStatus),
                              color: "#fff",
                              fontWeight: 600,
                              fontSize: "0.65rem",
                              height: 20,
                            }}
                          />
                        </Box>

                        {/* User Info */}
                        <Box>
                          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }}>User</Typography>
                          <Typography variant="body2" sx={{ color: "#fff" }}>{record.userName}</Typography>
                          <Tooltip title={record.userEmail}>
                            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.7)", display: "block", wordBreak: "break-word" }}>
                              {record.userEmail}
                            </Typography>
                          </Tooltip>
                        </Box>

                        {/* Type and Branch */}
                        <Box sx={{ display: "flex", gap: 2 }}>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }}>Type</Typography>
                            <Chip
                              label={record.voucherType === "OFW" ? "OFW" : "Walk-In"}
                              sx={{
                                background: getVoucherTypeColor(record.voucherType),
                                color: "#fff",
                                fontWeight: 600,
                                fontSize: "0.65rem",
                                height: 20,
                                display: "block",
                                width: "fit-content",
                                mt: 0.5,
                              }}
                            />
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }}>Branch</Typography>
                            <Tooltip title={`Address: ${record.branchAddress}\nEmail: ${record.branchEmail}`}>
                              <Typography variant="caption" sx={{ color: "#fff", display: "block", wordBreak: "break-word" }}>
                                {record.branchName || "(Remote / OFW)"}
                              </Typography>
                            </Tooltip>
                          </Box>
                        </Box>

                        {/* Issued Date */}
                        <Box>
                          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }}>Issued Date</Typography>
                          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.8)", display: "block" }}>
                            {formatDate(record.issuedAt)}
                          </Typography>
                        </Box>
                      </Box>
                    </Card>
                  ))
                ) : (
                  <Card sx={{ background: "rgba(255, 255, 255, 0.08)", border: "1px solid rgba(255, 255, 255, 0.12)", borderRadius: 2, p: 3, textAlign: "center" }}>
                    <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.5)" }}>No voucher records found</Typography>
                  </Card>
                )}
              </Box>
            )}

            {/* Pagination */}
            {filteredData.length > itemsPerPage && (
              <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
                <Pagination
                  count={totalPages}
                  page={currentPage}
                  onChange={(_, page) => setCurrentPage(page)}
                  sx={{
                    "& .MuiPaginationItem-root": {
                      color: "rgba(255,255,255,0.7)",
                      borderColor: "rgba(255,255,255,0.2)",
                    },
                    "& .MuiPaginationItem-root.Mui-selected": {
                      background: "#10b981",
                      color: "#fff",
                    },
                  }}
                />
              </Box>
            )}

            {/* Summary Stats */}
            <Card
              component={motion.div}
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              sx={{
                mt: 3,
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: 2,
              }}
            >
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 700, color: "#fff", mb: 2 }}>
                  📈 Summary Statistics
                </Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "1fr 1fr 1fr" }, gap: 2 }}>
                  <Box sx={{ p: 2, background: "rgba(16,185,129,0.1)", borderRadius: 1, border: "1px solid rgba(16,185,129,0.2)" }}>
                    <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.7)" }}>OFW Vouchers</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: "#10b981" }}>
                      {voucherData.filter(v => v.voucherType === "OFW").length}
                    </Typography>
                  </Box>
                  <Box sx={{ p: 2, background: "rgba(59,130,246,0.1)", borderRadius: 1, border: "1px solid rgba(59,130,246,0.2)" }}>
                    <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.7)" }}>Walk-In Vouchers</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: "#3b82f6" }}>
                      {voucherData.filter(v => String(v.voucherType || "").startsWith("WALK_IN")).length}
                    </Typography>
                  </Box>
                  <Box sx={{ p: 2, background: "rgba(34,197,94,0.1)", borderRadius: 1, border: "1px solid rgba(34,197,94,0.2)" }}>
                    <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.7)" }}>Active Vouchers</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: "#22c55e" }}>
                      {voucherData.filter(v => v.voucherStatus === "ACTIVE").length}
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </>
        )}
      </Box>
    </Box>
  );
};

export default AdminVoucherRecords;
