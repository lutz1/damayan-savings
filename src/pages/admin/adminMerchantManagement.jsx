// src/pages/admin/adminMerchantManagement.jsx
import React, { useEffect, useState } from "react";
import {
  Box,
  Toolbar,
  Typography,
  Card,
  CardContent,
  Switch,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  CircularProgress,
  Tooltip,
  useMediaQuery,
} from "@mui/material";
import StoreIcon from "@mui/icons-material/Store";
import { collection, query, where, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { motion } from "framer-motion";
import Topbar from "../../components/Topbar";
import AppBottomNav from "../../components/AppBottomNav";
import bgImage from "../../assets/bg.jpg";

const AdminMerchantManagement = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [merchants, setMerchants] = useState([]);
  const [loading, setLoading] = useState(true);

  const isMobile = useMediaQuery("(max-width:900px)");

  const handleToggleSidebar = () => setSidebarOpen(prev => !prev);

  useEffect(() => {
    const q = query(collection(db, "users"), where("role", "==", "MERCHANT"));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setMerchants(list);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const toggleMerchant = async (id, current) => {
    await updateDoc(doc(db, "users", id), { active: !current });
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
      <Box sx={{ position: "fixed", width: "100%", zIndex: 10 }}>
        <Topbar open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
      </Box>

      {/* Sidebar */}
      <Box sx={{ zIndex: 5 }}>
        <AppBottomNav open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
      </Box>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: isMobile ? 2 : 4,
          mt: 0,
          color: "white",
          zIndex: 1,
          width: `calc(100% - ${sidebarOpen ? 240 : 60}px)`,
          transition: "all 0.3s ease",
        }}
      >
        <Toolbar />
        <Typography
          variant={isMobile ? "h5" : "h4"}
          gutterBottom
          sx={{
            fontWeight: 700,
            letterSpacing: 0.5,
            mb: 3,
            textShadow: "1px 1px 3px rgba(0,0,0,0.4)",
          }}
        >
          🏪 Merchant Management
        </Typography>

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : isMobile ? (
          // Mobile/Tablet: Stacked cards
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {merchants.map((m) => (
              <Card
                key={m.id}
                sx={{
                  background: "rgba(255,255,255,0.12)",
                  backdropFilter: "blur(15px)",
                  borderRadius: 3,
                  boxShadow: "0 8px 20px rgba(0,0,0,0.3)",
                  p: 2,
                  color: "white",
                }}
              >
                <Typography variant="h6" sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                  <StoreIcon color={m.active ? "success" : "disabled"} />
                  {m.name}
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  📧 {m.email}
                </Typography>
                <Typography variant="body2" sx={{ mb: 1, display: "flex", alignItems: "center", gap: 1 }}>
                  Status: 
                  <Tooltip title={m.active ? "Deactivate Merchant" : "Activate Merchant"}>
                    <Switch
                      checked={m.active ?? true}
                      onChange={() => toggleMerchant(m.id, m.active)}
                      color="success"
                      size="small"
                    />
                  </Tooltip>
                </Typography>
                <Typography variant="body2">Products: {m.productCount || 0}</Typography>
              </Card>
            ))}
          </Box>
        ) : (
          // Desktop: Table
          <Card
            sx={{
              background: "rgba(255,255,255,0.12)",
              backdropFilter: "blur(15px)",
              borderRadius: 3,
              boxShadow: "0 8px 20px rgba(0,0,0,0.3)",
            }}
          >
            <CardContent>
              <Table sx={{ minWidth: 650, color: "white" }}>
                <TableHead sx={{ background: "rgba(0,0,0,0.2)" }}>
                  <TableRow>
                    {["Merchant", "Email", "Status", "Products"].map((h) => (
                      <TableCell
                        key={h}
                        sx={{ color: "white", fontWeight: 600, py: 1.5 }}
                        align={h === "Status" || h === "Products" ? "center" : "left"}
                      >
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>

                <TableBody>
                  {merchants.map((m) => (
                    <motion.tr
                      key={m.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ scale: 1.02 }}
                      style={{ cursor: "pointer" }}
                    >
                      <TableCell sx={{ py: 1.5 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <StoreIcon color={m.active ? "success" : "disabled"} />
                          {m.name}
                        </Box>
                      </TableCell>

                      <TableCell sx={{ py: 1.5 }}>{m.email}</TableCell>

                      <TableCell align="center" sx={{ py: 1.5 }}>
                        <Tooltip title={m.active ? "Deactivate Merchant" : "Activate Merchant"}>
                          <Switch
                            checked={m.active ?? true}
                            onChange={() => toggleMerchant(m.id, m.active)}
                            color="success"
                          />
                        </Tooltip>
                      </TableCell>

                      <TableCell align="center" sx={{ py: 1.5 }}>
                        {m.productCount || 0}
                      </TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </Box>
    </Box>
  );
};

export default AdminMerchantManagement;