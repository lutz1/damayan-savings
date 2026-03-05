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
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CardGiftcardIcon from "@mui/icons-material/CardGiftcard";
import { collection, query, onSnapshot, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../firebase";
import { motion } from "framer-motion";
import Topbar from "../../components/Topbar";
import AppBottomNav from "../../components/AppBottomNav";
import AdminSidebarToggle from "../../components/AdminSidebarToggle";
import bgImage from "../../assets/bg.jpg";

const AdminVoucherRecords = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [voucherData, setVoucherData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [accessDenied, setAccessDenied] = useState(false);

  const isMobile = useMediaQuery("(max-width:900px)");
  useEffect(() => setSidebarOpen(!isMobile), [isMobile]);

  const handleToggleSidebar = () => setSidebarOpen(prev => !prev);

  // Fetch all voucher records from capitalShareVouchers collection
  useEffect(() => {
    let unsubscribeVouchers = null;

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
    });

    return () => {
      if (unsubscribeVouchers) unsubscribeVouchers();
      unsubscribeAuth();
    };
  }, []);

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
    if (status === "REDEEMED") return "#f59e0b";
    if (status === "EXPIRED") return "#ef4444";
    return "#6b7280";
  };

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        backgroundImage: `url(${bgImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        position: "relative",
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.1)",
          zIndex: 0,
        },
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
              },
            }}
          >
            <AppBottomNav open={sidebarOpen} onToggleSidebar={handleToggleSidebar} layout="sidebar" />
          </Drawer>
        </>
      )}

      {/* Main Content */}
      <Box
        component={motion.div}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          pt: 8,
          pb: 4,
          px: { xs: 1, sm: 2, md: 4 },
          position: "relative",
          zIndex: 1,
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
          <CardContent sx={{ pb: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
              <CardGiftcardIcon sx={{ fontSize: 32, color: "#10b981" }} />
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 700, color: "#fff" }}>
                  Voucher Record Management
                </Typography>
                <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.7)" }}>
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
                      <TableCell colSpan={7} sx={{ textAlign: "center", py: 4, color: "rgba(255,255,255,0.5)" }}>
                        <Typography variant="body2">No voucher records found</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>

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
                      {voucherData.filter(v => v.voucherType === "WALK_IN").length}
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
