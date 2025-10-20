// src/pages/admin/AdminUserManagement.jsx
import React, { useEffect, useState } from "react";
import {
  Box,
  Toolbar,
  Typography,
  Card,
  CardContent,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  useMediaQuery,
} from "@mui/material";
import { motion } from "framer-motion";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  doc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { db, secondaryAuth } from "../../firebase";
import Topbar from "../../components/Topbar";
import Sidebar from "../../components/Sidebar";
import bgImage from "../../assets/bg.jpg";

const AdminUserManagement = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [roleFilter, setRoleFilter] = useState("All");
  const [users, setUsers] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [newUser, setNewUser] = useState({
    username: "",
    name: "",
    email: "",
    contactNumber: "",
    address: "",
    role: "Member",
    referredBy: "",
    referrerRole: "",
  });

  const isMobile = useMediaQuery("(max-width:768px)");
  const handleToggleSidebar = () => setSidebarOpen((prev) => !prev);

  // 🔥 Fetch users
  useEffect(() => {
    setLoading(true);
    let q = query(collection(db, "users"), orderBy("createdAt", "desc"));
    if (roleFilter !== "All") {
      q = query(collection(db, "users"), where("role", "==", roleFilter));
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const userList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setUsers(userList);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching users:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [roleFilter]);

  // 🔥 Fetch pending invites
  useEffect(() => {
    const q = collection(db, "pendingInvites");
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPendingInvites(
        snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      );
    });
    return () => unsubscribe();
  }, []);

  // ✅ Create user manually
  const handleCreateUser = async () => {
    const {
      username,
      name,
      email,
      contactNumber,
      address,
      role,
      referredBy,
      referrerRole,
    } = newUser;

    if (!username || !name || !email || !contactNumber || !address || !role) {
      alert("Please fill in all fields.");
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        email,
        "password123"
      );

      const uid = userCredential.user.uid;

      await setDoc(doc(db, "users", uid), {
        username,
        name,
        email,
        contactNumber,
        address,
        role,
        referredBy,
        referrerRole,
        createdAt: serverTimestamp(),
      });

      alert("✅ User created successfully!");
      setOpenDialog(false);
      await secondaryAuth.signOut();
      setNewUser({
        username: "",
        name: "",
        email: "",
        contactNumber: "",
        address: "",
        role: "Member",
        referredBy: "",
        referrerRole: "",
      });
    } catch (error) {
      console.error("🔥 Error adding user:", error);
      alert("Error creating user: " + error.message);
    }
  };

  // ✅ Approve pending invite
  const handleApproveInvite = async (invite) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        invite.email,
        "password123"
      );

      const uid = userCredential.user.uid;

      await setDoc(doc(db, "users", uid), {
        username: invite.username,
        name: invite.fullName,
        email: invite.email,
        contactNumber: invite.contact,
        address: invite.address,
        role: invite.role,
        referredBy: invite.upline,
        createdAt: serverTimestamp(),
      });

      await deleteDoc(doc(db, "pendingInvites", invite.id));
      await secondaryAuth.signOut();

      alert(`✅ ${invite.fullName} has been approved as ${invite.role}!`);
    } catch (err) {
      console.error("Error approving invite:", err);
      alert("Failed to approve invite: " + err.message);
    }
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
          backgroundColor: "rgba(0,0,0,0.15)",
          zIndex: 0,
        },
      }}
    >
      {/* 🔝 Topbar */}
      <Box sx={{ position: "fixed", width: "100%", zIndex: 10 }}>
        <Topbar open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
      </Box>

      {/* 🧭 Sidebar */}
      <Box sx={{ zIndex: 5 }}>
        <Sidebar open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
      </Box>

      {/* 🧩 Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: isMobile ? 2 : 4,
          mt: 8,
          color: "white",
          zIndex: 1,
          width: `calc(100% - ${sidebarOpen ? 240 : 60}px)`,
          transition: "all 0.3s ease",
          position: "relative",
        }}
      >
        <Toolbar />

        {/* Header */}
        <Box
          sx={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "stretch" : "center",
            justifyContent: "space-between",
            mb: 3,
            gap: 2,
          }}
        >
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              textShadow: "1px 1px 3px rgba(0,0,0,0.4)",
            }}
          >
            👥 User Management
          </Typography>

          <Button
            variant="contained"
            onClick={() => setOpenDialog(true)}
            sx={{
              backgroundColor: "#1976d2",
              "&:hover": { backgroundColor: "#1565c0" },
              width: isMobile ? "100%" : "auto",
            }}
          >
            + Create User
          </Button>
        </Box>

        {/* 🔽 Role Filter */}
        <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 3 }}>
          <FormControl
            size="small"
            sx={{
              minWidth: isMobile ? "100%" : 200,
              background: "rgba(255,255,255,0.1)",
              borderRadius: "8px",
            }}
          >
            <InputLabel sx={{ color: "white" }}>Filter by Role</InputLabel>
            <Select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              label="Filter by Role"
              sx={{
                color: "white",
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: "rgba(255,255,255,0.3)",
                },
                "&:hover .MuiOutlinedInput-notchedOutline": {
                  borderColor: "white",
                },
              }}
            >
              <MenuItem value="All">All</MenuItem>
              <MenuItem value="CEO">Chief Executive Officer (CEO)</MenuItem>
              <MenuItem value="MasterMD">Master Marketing Director (MasterMD)</MenuItem>
              <MenuItem value="MD">Marketing Director (MD)</MenuItem>
              <MenuItem value="MS">Marketing Supervisor (MS)</MenuItem>
              <MenuItem value="MI">Marketing Incharge (MI)</MenuItem>
              <MenuItem value="AGENT">Agent</MenuItem>
              <MenuItem value="Member">Member</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* 📋 User List */}
        <Card
          sx={{
            background: "rgba(255,255,255,0.12)",
            backdropFilter: "blur(12px)",
            borderRadius: "20px",
            boxShadow: "0 6px 25px rgba(0,0,0,0.25)",
            overflow: "hidden",
          }}
        >
          <CardContent>
            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
                <CircularProgress sx={{ color: "white" }} />
              </Box>
            ) : users.length === 0 ? (
              <Typography align="center" sx={{ color: "rgba(255,255,255,0.7)", py: 3 }}>
                No users found for selected role.
              </Typography>
            ) : (
              <TableContainer component={Paper} sx={{ background: "transparent", color: "white" }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>Username</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>Name</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>Email</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>Role</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>Contact</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>Address</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>Joined</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>Referred By</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {users.map((user) => (
                      <motion.tr
                        key={user.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <TableCell sx={{ color: "white" }}>{user.username || "—"}</TableCell>
                        <TableCell sx={{ color: "white" }}>{user.name || "N/A"}</TableCell>
                        <TableCell sx={{ color: "white" }}>{user.email}</TableCell>
                        <TableCell sx={{ color: "white" }}>{user.role}</TableCell>
                        <TableCell sx={{ color: "white" }}>{user.contactNumber || "—"}</TableCell>
                        <TableCell sx={{ color: "white" }}>{user.address || "—"}</TableCell>
                        <TableCell sx={{ color: "white" }}>
                          {user.createdAt?.toDate
                            ? user.createdAt.toDate().toLocaleDateString()
                            : "—"}
                        </TableCell>
                        <TableCell sx={{ color: "white" }}>{user.referredBy || "—"}</TableCell>
                      </motion.tr>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>

        {/* 🕓 Pending Invites */}
        <Typography variant="h5" sx={{ mt: 5, mb: 2, fontWeight: 600 }}>
          ⏳ Pending Invites
        </Typography>
        <Card
          sx={{
            background: "rgba(255,255,255,0.12)",
            backdropFilter: "blur(12px)",
            borderRadius: "20px",
            boxShadow: "0 6px 25px rgba(0,0,0,0.25)",
            overflow: "hidden",
          }}
        >
          <CardContent>
            {pendingInvites.length === 0 ? (
              <Typography align="center" sx={{ color: "rgba(255,255,255,0.7)", py: 3 }}>
                No pending invites.
              </Typography>
            ) : (
              <TableContainer component={Paper} sx={{ background: "transparent", color: "white" }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>Full Name</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>Email</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>Role</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>Upline</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pendingInvites.map((invite) => (
                      <TableRow key={invite.id}>
                        <TableCell sx={{ color: "white" }}>{invite.fullName}</TableCell>
                        <TableCell sx={{ color: "white" }}>{invite.email}</TableCell>
                        <TableCell sx={{ color: "white" }}>{invite.role}</TableCell>
                        <TableCell sx={{ color: "white" }}>{invite.upline}</TableCell>
                        <TableCell>
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            onClick={() => handleApproveInvite(invite)}
                          >
                            Approve
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>

        {/* 🧾 Create User Dialog */}
        <Dialog open={openDialog} onClose={() => setOpenDialog(false)} fullWidth maxWidth="sm">
          <DialogTitle>Create New User</DialogTitle>
          <DialogContent>
            <TextField
              label="Username"
              value={newUser.username}
              onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
              fullWidth
              margin="normal"
            />
            <TextField
              label="Full Name"
              value={newUser.name}
              onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
              fullWidth
              margin="normal"
            />
            <TextField
              label="Email"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              fullWidth
              margin="normal"
            />
            <TextField
              label="Contact Number"
              value={newUser.contactNumber}
              onChange={(e) => setNewUser({ ...newUser, contactNumber: e.target.value })}
              fullWidth
              margin="normal"
            />
            <TextField
              label="Address"
              value={newUser.address}
              onChange={(e) => setNewUser({ ...newUser, address: e.target.value })}
              fullWidth
              margin="normal"
            />
            <FormControl fullWidth margin="normal">
              <InputLabel>Role</InputLabel>
              <Select
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                label="Role"
              >
                <MenuItem value="CEO">Chief Executive Officer (CEO)</MenuItem>
                <MenuItem value="MasterMD">Master Marketing Director (MasterMD)</MenuItem>
                <MenuItem value="MD">Marketing Director (MD)</MenuItem>
                <MenuItem value="MS">Marketing Supervisor (MS)</MenuItem>
                <MenuItem value="MI">Marketing Incharge (MI)</MenuItem>
                <MenuItem value="AGENT">Agent</MenuItem>
                <MenuItem value="Member">Member</MenuItem>
              </Select>
            </FormControl>

            <TextField
              label="Referred By (Username)"
              value={newUser.referredBy}
              onChange={(e) => setNewUser({ ...newUser, referredBy: e.target.value })}
              fullWidth
              margin="normal"
            />
            <FormControl fullWidth margin="normal">
              <InputLabel>Referrer Role</InputLabel>
              <Select
                value={newUser.referrerRole}
                onChange={(e) => setNewUser({ ...newUser, referrerRole: e.target.value })}
                label="Referrer Role"
              >
                <MenuItem value="CEO">Chief Executive Officer (CEO)</MenuItem>
                <MenuItem value="MasterMD">Master Marketing Director (MasterMD)</MenuItem>
                <MenuItem value="MD">Marketing Director (MD)</MenuItem>
                <MenuItem value="MS">Marketing Supervisor (MS)</MenuItem>
                <MenuItem value="MI">Marketing Incharge (MI)</MenuItem>
                <MenuItem value="AGENT">Agent</MenuItem>
                <MenuItem value="Member">Member</MenuItem>
              </Select>
            </FormControl>

            <Typography variant="body2" sx={{ mt: 1, color: "gray" }}>
              Default password: <b>password123</b>
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDialog(false)} color="error">
              Cancel
            </Button>
            <Button onClick={handleCreateUser} variant="contained" color="primary">
              Create
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
};

export default AdminUserManagement;