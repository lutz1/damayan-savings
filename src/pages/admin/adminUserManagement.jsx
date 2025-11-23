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
  TablePagination,
  useMediaQuery,
} from "@mui/material";
import { motion } from "framer-motion";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
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
  getDocs,
  limit,
  addDoc,
  updateDoc
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
  const [searchQuery, setSearchQuery] = useState("");
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

  // Pagination states
  // 2️⃣ Filter users based on searchQuery (before pagination)
  const filteredUsers = users.filter((user) =>
    Object.values(user)
      .join(" ")
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const isMobile = useMediaQuery("(max-width:768px)");
  const handleToggleSidebar = () => setSidebarOpen((prev) => !prev);

  const handleExportExcel = () => {
  if (!users || users.length === 0) {
    alert("No users to export!");
    return;
  }

  // Prepare data
  const exportData = filteredUsers.map(({ username, name, email, role, referredBy }) => ({
    Username: username,
    Name: name,
    Email: email,
    Role: role,
    "Referred By": referredBy || "—",
  }));

  // Create worksheet
  const worksheet = XLSX.utils.json_to_sheet(exportData);

  // Create workbook and append worksheet
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Users");

  // Generate Excel file and download
  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const data = new Blob([excelBuffer], { type: "application/octet-stream" });
  saveAs(data, "Users.xlsx");
};

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
        const userList = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
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
      setPendingInvites(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
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
    const uplineUsername = invite.referredBy || invite.inviterUsername || invite.uplineUsername;

    if (!uplineUsername) {
      alert("Upline username missing. Cannot approve invite.");
      return;
    }

    // 🔍 Get inviter (direct referrer)
    const inviterQuery = query(
      collection(db, "users"),
      where("username", "==", uplineUsername),
      limit(1)
    );
    const inviterSnap = await getDocs(inviterQuery);

    if (inviterSnap.empty) {
      alert("Inviter not found in users collection.");
      return;
    }

    const inviterDoc = inviterSnap.docs[0];
    const referrerId = inviterDoc.id;
    const referrerRole = inviterDoc.data().role || "";
    const referrerUsername = inviterDoc.data().username || "";
    const inviterUpline = inviterDoc.data().referredBy || null; // for network chain

    // 🧩 Create Firebase Auth user for invitee
    const userCredential = await createUserWithEmailAndPassword(
      secondaryAuth,
      invite.inviteeEmail,
      "password123"
    );
    const uid = userCredential.user.uid;

    // 🗂️ Create user in Firestore
    await setDoc(doc(db, "users", uid), {
      username: invite.inviteeUsername,
      name: invite.inviteeName,
      email: invite.inviteeEmail,
      contactNumber: invite.contactNumber || "",
      address: invite.address || "",
      role: invite.role,
      referredBy: uplineUsername,
      referrerRole,
      referralReward: false,
      createdAt: serverTimestamp(),
    });

    // =========================================================
    // 💰 DIRECT INVITE REWARD
    const directRewardMap = {
      Agent: 120,
      MI: 140,
      MS: 160,
      MD: 210,
    };
    const directRewardAmount = directRewardMap[invite.role] || 0;

    const directRewardQuery = query(
      collection(db, "referralReward"),
      where("userId", "==", referrerId),
      where("source", "==", invite.inviteeUsername),
      where("type", "==", "Direct Invite Reward"),
      limit(1)
    );

    const directSnap = await getDocs(directRewardQuery);

    if (!directSnap.empty) {
      const directDocRef = doc(db, "referralReward", directSnap.docs[0].id);
      await updateDoc(directDocRef, {
        approved: true,
        payoutReleased: true,
        releasedAt: serverTimestamp(),
      });
      console.log(`✅ Updated Direct Invite Reward for ${referrerUsername}`);
    } else {
      await addDoc(collection(db, "referralReward"), {
        userId: referrerId,
        username: referrerUsername,
        source: invite.inviteeUsername,
        role: referrerRole,
        type: "Direct Invite Reward",
        amount: directRewardAmount,
        payoutReleased: true,
        approved: true,
        createdAt: serverTimestamp(),
        releasedAt: serverTimestamp(),
      });
      console.log(
        `✅ Created Direct Invite Reward ₱${directRewardAmount} for ${referrerUsername}`
      );
    }

    // Mark invitee referralReward = true
    await setDoc(
      doc(db, "users", uid),
      { referralReward: true },
      { merge: true }
    );

    // =========================================================
// 🌐 NETWORK BONUS DISTRIBUTION (skip inviter)
let currentUpline = inviterUpline;
console.log(`=== 🧭 Network Bonus Distribution for ${invite.inviteeUsername} ===`);

// Reset MD slot index
handleApproveInvite.mdSlotIndex = 0;

// Track network depth for Agent bonus limit
let networkLevel = 1;

while (currentUpline) {
  const uplineQuery = query(
    collection(db, "users"),
    where("username", "==", currentUpline),
    limit(1)
  );
  const uplineSnap = await getDocs(uplineQuery);

  if (uplineSnap.empty) {
    console.log(`⚠️ No upline found for ${currentUpline}`);
    break;
  }

  const uplineDoc = uplineSnap.docs[0];
  const uplineId = uplineDoc.id;
  const uplineRole = (uplineDoc.data().role || "").trim();
  const uplineUsername = uplineDoc.data().username;
  const nextUpline = uplineDoc.data().referredBy || null;

  // Skip inviter
  if (uplineUsername === referrerUsername) {
    console.log(`⛔ Skipping inviter (${uplineUsername}) from network bonus`);
    currentUpline = nextUpline;
    continue;
  }

  // Determine bonus amount
  let bonusAmount = 0;

  if (uplineRole === "MasterMD") {
    bonusAmount = 15;

  } else if (uplineRole === "MD") {
    const mdBonusSlots = [50, 10]; 
    if (handleApproveInvite.mdSlotIndex < mdBonusSlots.length) {
      bonusAmount = mdBonusSlots[handleApproveInvite.mdSlotIndex];
      handleApproveInvite.mdSlotIndex++;
    }

  } else if (["MI", "MS"].includes(uplineRole)) {
    bonusAmount = 20;

  // ⭐⭐ NEW LOGIC: Agents earn ₱5 up to Level 5 only ⭐⭐
  } else if (uplineRole === "Agent") {
    if (networkLevel <= 5) {
      bonusAmount = 5;
    } else {
      bonusAmount = 0;
      console.log(`🚫 Agent bonus limit reached (Level ${networkLevel}), no bonus`);
    }
  }

  // Save bonus if any
  if (bonusAmount > 0) {
    const existingBonusQuery = query(
      collection(db, "referralReward"),
      where("userId", "==", uplineId),
      where("source", "==", invite.inviteeUsername),
      where("type", "==", "Network Bonus"),
      limit(1)
    );
    const existingBonusSnap = await getDocs(existingBonusQuery);

    if (existingBonusSnap.empty) {
      await addDoc(collection(db, "referralReward"), {
        userId: uplineId,
        username: uplineUsername,
        source: invite.inviteeUsername,
        role: uplineRole,
        type: "Network Bonus",
        amount: bonusAmount,
        approved: true,
        payoutReleased: true,
        createdAt: serverTimestamp(),
        releasedAt: serverTimestamp(),
      });

      console.log(`💸 ${uplineUsername} (${uplineRole}) earned ₱${bonusAmount}`);
    } else {
      console.log(`ℹ️ Network bonus already exists for ${uplineUsername}`);
    }
  }

  currentUpline = nextUpline;
  networkLevel++; // ⬆️ Increase depth level
}

console.log(`=== ✅ Finished Bonus Distribution for ${invite.inviteeUsername} ===`);

    // =========================================================
    // 🧹 Remove pending invite
    await deleteDoc(doc(db, "pendingInvites", invite.id));

    // 🔒 Sign out temp auth
    await secondaryAuth.signOut();

    alert(
      `✅ ${invite.inviteeName} approved as ${invite.role}!\nDirect and network rewards released successfully.`
    );
  } catch (err) {
    console.error("❌ Error approving invite:", err);
    alert("Failed to approve invite: " + err.message);
  }
};

  const handleRejectInvite = async (inviteId) => {
    if (window.confirm("Are you sure you want to reject this invite?")) {
      try {
        await deleteDoc(doc(db, "pendingInvites", inviteId));
        alert("❌ Invite has been rejected and removed.");
      } catch (err) {
        console.error("Error rejecting invite:", err);
        alert("Failed to reject invite: " + err.message);
      }
    }
  };

  // Pagination handlers
  const handleChangePage = (_, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (e) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  // Paginated slice
  const paginatedUsers = filteredUsers.slice(
  page * rowsPerPage,
  page * rowsPerPage + rowsPerPage
);

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
          color: "white",
          zIndex: 1,
          width: `calc(100% - ${sidebarOpen ? 240 : 60}px)`,
          transition: "all 0.3s ease",
          position: "relative",
        }}
      >
        <Toolbar />

        <Box
          sx={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            justifyContent: "space-between",
            mb: 3,
            gap: 2,
          }}
        >
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            👥 User Management
          </Typography>

          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <Button
              variant="contained"
              onClick={handleExportExcel}
              sx={{
                backgroundColor: "#2e7d32",
                "&:hover": { backgroundColor: "#27632a" },
              }}
            >
              📄 Export Excel
            </Button>

            <Button
              variant="contained"
              onClick={() => setOpenDialog(true)}
              sx={{
                backgroundColor: "#1976d2",
                "&:hover": { backgroundColor: "#1565c0" },
              }}
            >
              + Create User
            </Button>
          </Box>
        </Box>

        {/* Role Filter */}
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
              }}
            >
              <MenuItem value="All">All</MenuItem>
              <MenuItem value="CEO">CEO</MenuItem>
              <MenuItem value="MasterMD">MasterMD</MenuItem>
              <MenuItem value="MD">MD</MenuItem>
              <MenuItem value="MS">MS</MenuItem>
              <MenuItem value="MI">MI</MenuItem>
              <MenuItem value="AGENT">Agent</MenuItem>
              <MenuItem value="Member">Member</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* 🔍 Search Box */}
        <Box sx={{ mb: 2 }}>
          <TextField
            label="Search Users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            fullWidth
            size="small"
            sx={{
              background: "rgba(255,255,255,0.1)",
              borderRadius: "8px",
              input: { color: "white" },
              "& .MuiInputLabel-root": { color: "white" },
              "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.3)" },
            }}
          />
        </Box>

        {/* ✅ Users Table with Pagination */}
        <Card sx={{ background: "rgba(255,255,255,0.12)", borderRadius: "20px" }}>
          <CardContent>
            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
                <CircularProgress sx={{ color: "white" }} />
              </Box>
            ) : (
              <>
                <TableContainer component={Paper} sx={{ background: "transparent" }}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ color: "white" }}>Username</TableCell>
                        <TableCell sx={{ color: "white" }}>Name</TableCell>
                        <TableCell sx={{ color: "white" }}>Email</TableCell>
                        <TableCell sx={{ color: "white" }}>Role</TableCell>
                        <TableCell sx={{ color: "white" }}>Referred By</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginatedUsers.map((user) => (
                        <motion.tr key={user.id}>
                          <TableCell sx={{ color: "white" }}>{user.username}</TableCell>
                          <TableCell sx={{ color: "white" }}>{user.name}</TableCell>
                          <TableCell sx={{ color: "white" }}>{user.email}</TableCell>
                          <TableCell sx={{ color: "white" }}>{user.role}</TableCell>
                          <TableCell sx={{ color: "white" }}>
                            {user.referredBy || "—"}
                          </TableCell>
                        </motion.tr>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* Pagination controls */}
                <TablePagination
                  component="div"
                  count={users.length}
                  page={page}
                  onPageChange={handleChangePage}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  sx={{ color: "white" }}
                />
              </>
            )}
          </CardContent>
        </Card>

        {/* 🕓 Pending Invites */}
        <Typography variant="h5" sx={{ mt: 5, mb: 2, fontWeight: 600 }}>
          ⏳ Pending Invites
        </Typography>
        <Card sx={{ background: "rgba(255,255,255,0.12)", borderRadius: "20px" }}>
          <CardContent>
            {pendingInvites.length === 0 ? (
              <Typography align="center" sx={{ color: "rgba(255,255,255,0.7)", py: 3 }}>
                No pending invites.
              </Typography>
            ) : (
              <TableContainer component={Paper} sx={{ background: "transparent" }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ color: "white" }}>Username</TableCell>
                      <TableCell sx={{ color: "white" }}>Full Name</TableCell>
                      <TableCell sx={{ color: "white" }}>Email</TableCell>
                      <TableCell sx={{ color: "white" }}>Role</TableCell>
                      <TableCell sx={{ color: "white" }}>Upline</TableCell>
                      <TableCell sx={{ color: "white" }}>Referral Code</TableCell>
                      <TableCell sx={{ color: "white" }}>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pendingInvites.map((invite) => (
                      <TableRow key={invite.id}>
                        <TableCell sx={{ color: "white" }}>{invite.inviteeUsername}</TableCell>
                        <TableCell sx={{ color: "white" }}>{invite.inviteeName}</TableCell>
                        <TableCell sx={{ color: "white" }}>{invite.inviteeEmail}</TableCell>
                        <TableCell sx={{ color: "white" }}>{invite.role}</TableCell>
                        <TableCell sx={{ color: "white" }}>{invite.uplineUsername}</TableCell>
                        <TableCell sx={{ color: "white" }}>{invite.referralCode}</TableCell>
                        <TableCell>
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            sx={{ mr: 1 }}
                            onClick={() => handleApproveInvite(invite)}
                          >
                            Approve
                          </Button>
                          <Button
                            size="small"
                            variant="contained"
                            color="error"
                            onClick={() => handleRejectInvite(invite.id)}
                          >
                            Reject
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
                <MenuItem value="CEO">CEO</MenuItem>
                <MenuItem value="MasterMD">MasterMD</MenuItem>
                <MenuItem value="MD">MD</MenuItem>
                <MenuItem value="MS">MS</MenuItem>
                <MenuItem value="MI">MI</MenuItem>
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