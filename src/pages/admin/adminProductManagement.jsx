import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Toolbar,
  Typography,
  Card,
  Stack,
  Button,
  Chip,
  CircularProgress,
  Drawer,
  useMediaQuery,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import {
  Search as SearchIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Schedule as ScheduleIcon,
  Storefront as StorefrontIcon,
} from "@mui/icons-material";
import { collection, onSnapshot, query, where, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import Topbar from "../../components/Topbar";
import AppBottomNav from "../../components/AppBottomNav";
import AdminSidebarToggle from "../../components/AdminSidebarToggle";
import bgImage from "../../assets/bg.jpg";

const statusConfig = {
  PENDING: { label: "Pending Review", color: "warning", icon: <ScheduleIcon fontSize="small" /> },
  APPROVED: { label: "Approved", color: "success", icon: <CheckCircleIcon fontSize="small" /> },
  REJECTED: { label: "Rejected", color: "error", icon: <CancelIcon fontSize="small" /> },
};

const AdminProductManagement = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [merchantMap, setMerchantMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("PENDING");
  const [pendingCount, setPendingCount] = useState(0);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingProduct, setRejectingProduct] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const isMobile = useMediaQuery("(max-width:900px)");
  useEffect(() => setSidebarOpen(!isMobile), [isMobile]);
  const handleToggleSidebar = () => setSidebarOpen((prev) => !prev);

  useEffect(() => {
    const unsubMerchants = onSnapshot(
      query(collection(db, "users"), where("role", "==", "MERCHANT")),
      (snap) => {
        const map = {};
        snap.docs.forEach((d) => {
          const data = d.data();
          map[d.id] = data.storeName || data.name || data.username || data.email || d.id;
        });
        setMerchantMap(map);
      },
      (err) => {
        console.error("Merchants listener error:", err);
      }
    );

    return () => unsubMerchants();
  }, []);

  useEffect(() => {
    let productsQuery;
    if (filterStatus === "ALL") {
      productsQuery = query(collection(db, "products"));
    } else {
      productsQuery = query(collection(db, "products"), where("approvalStatus", "==", filterStatus));
    }

    const unsubProducts = onSnapshot(
      productsQuery,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            const aTime = a.updatedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
            const bTime = b.updatedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
            return bTime - aTime;
          });
        setProducts(list);
        setLoading(false);
      },
      (err) => {
        console.error("Products listener error:", err);
        setLoading(false);
      }
    );

    return () => {
      unsubProducts();
    };
  }, [filterStatus]);

  useEffect(() => {
    const unsubPending = onSnapshot(
      query(collection(db, "products"), where("approvalStatus", "==", "PENDING")),
      (snap) => {
        setPendingCount(snap.size);
      },
      (err) => {
        console.error("Pending approvals count error:", err);
      }
    );

    return () => unsubPending();
  }, []);

  const getApprovalStatus = (product) => {
    const status = (product.approvalStatus || "PENDING").toUpperCase();
    if (status === "APPROVED") return "APPROVED";
    if (status === "REJECTED") return "REJECTED";
    return "PENDING";
  };

  const filteredProducts = useMemo(() => {
    let list = products.filter((p) => p.status !== "deleted");

    if (filterStatus !== "ALL") {
      list = list.filter((p) => getApprovalStatus(p) === filterStatus);
    }

    if (searchQuery.trim()) {
      const queryText = searchQuery.trim().toLowerCase();
      list = list.filter((p) => {
        const name = (p.name || "").toLowerCase();
        const category = (p.category || "").toLowerCase();
        const merchant = (merchantMap[p.merchantId] || "").toLowerCase();
        return name.includes(queryText) || category.includes(queryText) || merchant.includes(queryText);
      });
    }

    return list;
  }, [products, filterStatus, searchQuery, merchantMap]);

  const handleApprove = async (product) => {
    await updateDoc(doc(db, "products", product.id), {
      approvalStatus: "APPROVED",
      status: "active",
      approvedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  const openRejectDialog = (product) => {
    setRejectingProduct(product);
    setRejectReason(product?.rejectionReason || "");
    setRejectDialogOpen(true);
  };

  const closeRejectDialog = () => {
    setRejectDialogOpen(false);
    setRejectingProduct(null);
    setRejectReason("");
  };

  const handleReject = async () => {
    if (!rejectingProduct) return;

    await updateDoc(doc(db, "products", rejectingProduct.id), {
      approvalStatus: "REJECTED",
      status: "inactive",
      rejectionReason: rejectReason.trim(),
      rejectedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    closeRejectDialog();
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
      <Box sx={{ position: "fixed", width: "100%", zIndex: 1200 }}>
        <Topbar open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
      </Box>

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
            PaperProps={{ sx: { background: "transparent", boxShadow: "none" } }}
          >
            <AppBottomNav layout="sidebar" open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
          </Drawer>
        </>
      )}

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: isMobile ? 2 : 4,
          mt: 0,
          pb: { xs: 3, sm: 12, md: 12 },
          color: "white",
          zIndex: 1,
          width: "100%",
          paddingLeft: isMobile ? 0 : sidebarOpen ? 280 : 0,
          transition: "all 0.3s ease",
        }}
      >
        <Toolbar />
        <Stack spacing={2} sx={{ mb: 3 }}>
          <Typography
            variant={isMobile ? "h5" : "h4"}
            sx={{ fontWeight: 700, textShadow: "1px 1px 3px rgba(0,0,0,0.4)" }}
          >
            Product Management
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography sx={{ color: "rgba(255,255,255,0.8)" }}>
              Product approvals
            </Typography>
            <Chip
              label={`${pendingCount} Pending`}
              color="error"
              size="small"
              sx={{
                fontWeight: 700,
                borderRadius: 999,
                "& .MuiChip-label": { px: 1 },
              }}
            />
          </Stack>
        </Stack>

        <Card
          sx={{
            background: "rgba(255,255,255,0.12)",
            backdropFilter: "blur(15px)",
            borderRadius: 3,
            boxShadow: "0 8px 20px rgba(0,0,0,0.3)",
            p: 2,
            mb: 3,
          }}
        >
          <Stack spacing={2} direction={isMobile ? "column" : "row"} alignItems={isMobile ? "stretch" : "center"}>
            <TextField
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search product, category, merchant"
              size="small"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: "rgba(255,255,255,0.7)" }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                flex: 1,
                "& .MuiInputBase-root": {
                  color: "white",
                  background: "rgba(0,0,0,0.25)",
                },
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: "rgba(255,255,255,0.2)",
                },
              }}
            />
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {["ALL", "PENDING", "APPROVED", "REJECTED"].map((status) => (
                <Chip
                  key={status}
                  label={status === "ALL" ? "All" : statusConfig[status].label}
                  onClick={() => setFilterStatus(status)}
                  color={filterStatus === status ? "primary" : "default"}
                  variant={filterStatus === status ? "filled" : "outlined"}
                  sx={{
                    color: filterStatus === status ? "#0f172a" : "white",
                    borderColor: "rgba(255,255,255,0.3)",
                  }}
                />
              ))}
            </Stack>
          </Stack>
        </Card>

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : filteredProducts.length === 0 ? (
          <Typography sx={{ color: "rgba(255,255,255,0.8)" }}>
            No products found.
          </Typography>
        ) : (
          <Stack spacing={2}>
            {filteredProducts.map((product) => {
              const statusKey = getApprovalStatus(product);
              const status = statusConfig[statusKey];
              return (
                <Card
                  key={product.id}
                  sx={{
                    background: "rgba(255,255,255,0.12)",
                    backdropFilter: "blur(15px)",
                    borderRadius: 3,
                    boxShadow: "0 8px 20px rgba(0,0,0,0.3)",
                    p: 2,
                    color: "white",
                  }}
                >
                  <Stack direction={isMobile ? "column" : "row"} spacing={2} alignItems={isMobile ? "stretch" : "center"}>
                    <Box
                      component="img"
                      src={product.image || "/icons/icon-192x192.png"}
                      alt={product.name}
                      sx={{
                        width: isMobile ? "100%" : 88,
                        height: isMobile ? 180 : 88,
                        borderRadius: 2,
                        objectFit: "cover",
                        bgcolor: "rgba(255,255,255,0.1)",
                      }}
                    />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                        <Box>
                          <Typography sx={{ fontWeight: 700 }} noWrap>
                            {product.name || "Untitled Product"}
                          </Typography>
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                            <StorefrontIcon sx={{ fontSize: 16, color: "rgba(255,255,255,0.7)" }} />
                            <Typography sx={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.7)" }} noWrap>
                              {merchantMap[product.merchantId] || "Unknown merchant"}
                            </Typography>
                          </Stack>
                        </Box>
                        <Typography sx={{ fontWeight: 700, color: "#38bdf8" }}>
                          ₱{Number(product.price || 0).toFixed(2)}
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.5 }}>
                        <Chip
                          icon={status.icon}
                          label={status.label}
                          color={status.color}
                          size="small"
                          sx={{ textTransform: "uppercase", fontWeight: 700 }}
                        />
                        {product.category && (
                          <Chip
                            label={product.category}
                            size="small"
                            variant="outlined"
                            sx={{ color: "rgba(255,255,255,0.8)", borderColor: "rgba(255,255,255,0.3)" }}
                          />
                        )}
                      </Stack>
                    </Box>
                  </Stack>

                  <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
                    <Button
                      fullWidth
                      variant="outlined"
                      color="error"
                      onClick={() => openRejectDialog(product)}
                      sx={{
                        borderRadius: 2,
                        fontWeight: 700,
                        borderColor: "rgba(239,68,68,0.6)",
                        color: "#fecaca",
                        "&:hover": { borderColor: "#f87171", background: "rgba(239,68,68,0.1)" },
                      }}
                    >
                      Reject
                    </Button>
                    <Button
                      fullWidth
                      variant="contained"
                      color="info"
                      onClick={() => handleApprove(product)}
                      sx={{
                        borderRadius: 2,
                        fontWeight: 700,
                        color: "#0f172a",
                      }}
                    >
                      Approve
                    </Button>
                  </Stack>
                </Card>
              );
            })}
          </Stack>
        )}
      </Box>

      <Dialog open={rejectDialogOpen} onClose={closeRejectDialog} fullWidth maxWidth="sm">
        <DialogTitle>Reject Product</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {rejectingProduct?.name || "Selected product"}
            </Typography>
            <TextField
              label="Reason for rejection (optional)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              multiline
              minRows={3}
              placeholder="Add reason for merchant to review and update"
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeRejectDialog}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleReject}>
            Confirm Reject
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdminProductManagement;
