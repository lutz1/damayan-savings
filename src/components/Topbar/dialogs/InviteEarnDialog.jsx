// src/components/Topbar/dialogs/InviteEarnDialog.jsx
import React, { useState, useEffect } from "react";
import {Dialog,DialogTitle,DialogContent,DialogActions,Box,Button,TextField,CircularProgress,Alert,Divider,FormControl,InputLabel,Select,MenuItem,
} from "@mui/material";
import { PersonAdd } from "@mui/icons-material";
import {collection,query,where,onSnapshot,addDoc,serverTimestamp,doc,updateDoc,limit,getDocs,
} from "firebase/firestore";

const InviteEarnDialog = ({ open, onClose, userData, db, auth }) => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [newUserUsername, setNewUserUsername] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserContact, setNewUserContact] = useState("");
  const [newUserAddress, setNewUserAddress] = useState("");
  const [newUserRole, setNewUserRole] = useState("MD");
  const [selectedCode, setSelectedCode] = useState("");
  const [availableCodes, setAvailableCodes] = useState([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  
const isEmailInUse = async (email) => {
  if (!email) return false;
  const q = query(collection(db, "users"), where("email", "==", email));
  const snap = await getDocs(q);
  return !snap.empty;
};

const isValidEmail = (email) => {
  // Regex ensures no spaces and proper format
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

  const referralCode =
    userData?.referralCode || auth?.currentUser?.uid?.slice(0, 6);

  // Fetch available activation codes
  useEffect(() => {
    if (!auth.currentUser) return;
    const codesRef = collection(db, "purchaseCodes");
    const q = query(
      codesRef,
      where("userId", "==", auth.currentUser.uid),
      where("used", "==", false)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const codes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setAvailableCodes(codes);
      if (codes.length > 0 && !selectedCode) setSelectedCode(codes[0].code);
    });

    return () => unsubscribe();
  }, [auth.currentUser, db, selectedCode]);

  const handleRegisterInvitee = async () => {
    if (
      !newUserName ||
      !newUserUsername ||
      !newUserEmail ||
      !newUserContact ||
      !newUserAddress ||
      !selectedCode
    ) {
      setError("Please fill in all fields and select an activation code.");
      return;
    }

    if (!isValidEmail(newUserEmail)) {
      setError("Please enter a valid email address (no spaces).");
      return;
    }

    setError("");
    setLoading(true);

    // Check if email is already in use
  const emailExists = await isEmailInUse(newUserEmail);
  if (emailExists) {
    setError("This email is already in use. Please use another email.");
    setLoading(false);
    return;
  }

    try {
      // 1️⃣ Add pending invite record
      await addDoc(collection(db, "pendingInvites"), {
        inviterId: auth.currentUser.uid,
        inviterUsername: userData.username,
        inviterRole: userData.role,
        inviteeName: newUserName,
        inviteeUsername: newUserUsername,
        inviteeEmail: newUserEmail,
        contactNumber: newUserContact,
        address: newUserAddress,
        role: newUserRole,
        code: selectedCode,
        referralCode,
        referredBy: userData.username,
        referrerRole: userData.role,
        status: "Pending Approval",
        createdAt: serverTimestamp(),
      });

      // 2️⃣ Mark activation code as used
      const codeDoc = availableCodes.find((c) => c.code === selectedCode);
      if (codeDoc) {
        await updateDoc(doc(db, "purchaseCodes", codeDoc.id), { used: true });
      }

      // 3️⃣ Direct Invite Reward
      const directRewardMap = {
        MasterMD: 235,
        MD: 210,
        MS: 160,
        MI: 140,
        Agent: 120,
      };

      const inviterReward = directRewardMap[userData.role] || 0;
      if (inviterReward > 0) {
        await addDoc(collection(db, "referralReward"), {
          userId: auth.currentUser.uid,
          username: userData.username,
          role: userData.role,
          amount: inviterReward,
          source: newUserUsername,
          type: "Direct Invite Reward",
          approved: false,
          payoutReleased: false,
          createdAt: serverTimestamp(),
        });
      }

      // 4️⃣ Network Bonuses
      let currentUplineUsername = userData?.referredBy || null;
      let mdSlotIndex = 0;

      while (currentUplineUsername) {
        const q = query(
          collection(db, "users"),
          where("username", "==", currentUplineUsername),
          limit(1)
        );
        const snap = await getDocs(q);
        if (snap.empty) break;

        const uplineUser = snap.docs[0].data();
        const uplineId = snap.docs[0].id;
        const role = uplineUser.role;

        if (role?.toLowerCase() === "ceo") {

          break;
        }

        // MasterMD bonus
        if (role?.toLowerCase() === "mastermd") {
          await addDoc(collection(db, "referralReward"), {
            userId: uplineId,
            username: uplineUser.username,
            role,
            amount: 15,
            source: newUserUsername,
            type: "Network Bonus",
            approved: false,
            payoutReleased: false,
            createdAt: serverTimestamp(),
          });
        }

        // MD bonuses (updated logic)
if (role?.toLowerCase() === "md") {
  if (mdSlotIndex === 0) {
    // First MD upline → ₱10
    await addDoc(collection(db, "referralReward"), {
      userId: uplineId,
      username: uplineUser.username,
      role,
      amount: 10,
      source: newUserUsername,
      type: "MD Network Bonus",
      approved: false,
      payoutReleased: false,
      createdAt: serverTimestamp(),
    });
  }

  // After first MD, do NOT give any more MD bonuses
  mdSlotIndex++;

  // Stop MD bonuses completely (only 1 MD earns)
  continue;
}

        // MI & MS fixed bonuses
        const roleBonusMap = { mi: 20, ms: 20 };
        if (role && roleBonusMap[role.toLowerCase()]) {
          const bonus = roleBonusMap[role.toLowerCase()];
          await addDoc(collection(db, "referralReward"), {
            userId: uplineId,
            username: uplineUser.username,
            role,
            amount: bonus,
            source: newUserUsername,
            type: "Network Bonus",
            approved: false,
            payoutReleased: false,
            createdAt: serverTimestamp(),
          });
        }

        currentUplineUsername = uplineUser.referredBy || null;
      }

      // Reset form
      setSuccess(true);
      setNewUserName("");
      setNewUserUsername("");
      setNewUserEmail("");
      setNewUserContact("");
      setNewUserAddress("");
      setNewUserRole("MD");
      setSelectedCode("");
    } catch (err) {
      console.error("❌ Invite failed:", err);
      setError("Unable to send invite. Try again later.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError("");
    setSuccess(false);
    setNewUserName("");
    setNewUserUsername("");
    setNewUserEmail("");
    setNewUserContact("");
    setNewUserAddress("");
    setNewUserRole("MD");
    setSelectedCode("");
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          background: "rgba(30,30,30,0.95)",
          backdropFilter: "blur(16px)",
          color: "#fff",
          p: 1,
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        },
      }}
    >
      <DialogTitle
        sx={{
          textAlign: "center",
          fontWeight: 600,
          borderBottom: "1px solid rgba(255,255,255,0.15)",
          color: "#fff",
        }}
      >
        Invite & Earn
      </DialogTitle>

      <DialogContent>
        <Box sx={{ textAlign: "center", mt: 2 }}>
          <PersonAdd sx={{ fontSize: 40, color: "#FFD54F" }} />
        </Box>

        <Divider sx={{ my: 2, borderColor: "rgba(255,255,255,0.1)" }} />

        {error && (
          <Alert
            severity="error"
            sx={{ mb: 2, background: "rgba(255,82,82,0.15)", color: "#FF8A80" }}
          >
            {error}
          </Alert>
        )}
        {success && (
          <Alert
            severity="success"
            sx={{ mb: 2, background: "rgba(76,175,80,0.2)", color: "#81C784" }}
          >
            Invite submitted for admin approval!
          </Alert>
        )}

        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel sx={{ color: "#fff" }}>Select Activation Code</InputLabel>
          <Select
            value={selectedCode}
            onChange={(e) => setSelectedCode(e.target.value)}
            sx={{ color: "#fff", "& .MuiSvgIcon-root": { color: "#fff" } }}
          >
            {availableCodes.length > 0 ? (
              availableCodes.map((c) => (
                <MenuItem key={c.code} value={c.code}>
                  {c.code} ({c.type})
                </MenuItem>
              ))
            ) : (
              <MenuItem disabled>No available codes</MenuItem>
            )}
          </Select>
        </FormControl>

        <TextField
          fullWidth
          label="Upline Username"
          value={userData?.username || ""}
          disabled
          variant="filled"
          sx={{
            mb: 2,

            // Input text color when disabled
            "& .MuiInputBase-input.Mui-disabled": {
              WebkitTextFillColor: "#fff", // forces white
            },

            // Label color when disabled
            "& .MuiInputLabel-root.Mui-disabled": {
              color: "rgba(255,255,255,0.7)",
            },

            // Filled background color
            "& .MuiFilledInput-root": {
              backgroundColor: "rgba(255,255,255,0.15)",
            },

            // Disabled filled background (MUI overrides)
            "& .MuiFilledInput-root.Mui-disabled": {
              backgroundColor: "rgba(255,255,255,0.15) !important",
            },
          }}
        />

        <TextField
          fullWidth
          label="Username"
          value={newUserUsername}
          onChange={(e) => setNewUserUsername(e.target.value)}
          InputProps={{ sx: { color: "#fff" } }}
          InputLabelProps={{ sx: { color: "rgba(255,255,255,0.7)" } }}
          sx={{ mb: 2 }}
        />

        <TextField
          fullWidth
          label="Full Name"
          value={newUserName}
          onChange={(e) => setNewUserName(e.target.value)}
          InputProps={{ sx: { color: "#fff" } }}
          InputLabelProps={{ sx: { color: "rgba(255,255,255,0.7)" } }}
          sx={{ mb: 2 }}
        />

        <TextField
        fullWidth
        type="email"
        label="Email"
        value={newUserEmail}
        onChange={async (e) => {
          setNewUserEmail(e.target.value);
          if (isValidEmail(e.target.value)) {
            const exists = await isEmailInUse(e.target.value);
            setError(exists ? "This email is already in use." : "");
          } else {
            setError("Invalid email format (no spaces allowed)");
          }
        }}
        error={Boolean(error)}
        helperText={error}
        InputProps={{ sx: { color: "#fff" } }}
        InputLabelProps={{ sx: { color: "rgba(255,255,255,0.7)" } }}
        sx={{ mb: 2 }}
      />

        <TextField
          fullWidth
          label="Contact Number"
          value={newUserContact}
          onChange={(e) => setNewUserContact(e.target.value)}
          InputProps={{ sx: { color: "#fff" } }}
          InputLabelProps={{ sx: { color: "rgba(255,255,255,0.7)" } }}
          sx={{ mb: 2 }}
        />

        <TextField
          fullWidth
          label="Address"
          value={newUserAddress}
          onChange={(e) => setNewUserAddress(e.target.value)}
          InputProps={{ sx: { color: "#fff" } }}
          InputLabelProps={{ sx: { color: "rgba(255,255,255,0.7)" } }}
          sx={{ mb: 2 }}
        />

        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel sx={{ color: "#fff" }}>Role</InputLabel>
          <Select
            value={newUserRole}
            onChange={(e) => setNewUserRole(e.target.value)}
            sx={{ color: "#fff", "& .MuiSvgIcon-root": { color: "#fff" } }}
          >
            <MenuItem value="MD">MD</MenuItem>
            <MenuItem value="MS">MS</MenuItem>
            <MenuItem value="MI">MI</MenuItem>
            <MenuItem value="Agent">Agent</MenuItem>
          </Select>
        </FormControl>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={handleClose}
          variant="outlined"
          color="inherit"
          sx={{ color: "#fff", borderColor: "rgba(255,255,255,0.4)" }}
        >
          Close
        </Button>
        <Button
        onClick={() => setConfirmOpen(true)}
        variant="contained"
        disabled={loading}
        sx={{ bgcolor: "#FFD54F", color: "#000", "&:hover": { bgcolor: "#FFCA28" } }}
      >
        {loading ? <CircularProgress size={24} sx={{ color: "#000" }} /> : "Invite"}
      </Button>
      </DialogActions>

      <Dialog
  open={confirmOpen}
  onClose={() => setConfirmOpen(false)}
  maxWidth="xs"
  fullWidth
  PaperProps={{
    sx: {
      borderRadius: 3,
      background: "rgba(30,30,30,0.95)",
      backdropFilter: "blur(16px)",
      color: "#fff",
      p: 2,
      textAlign: "center",
    },
  }}
>
  <DialogTitle sx={{ fontWeight: 600 }}>Confirm Invite</DialogTitle>
  <DialogContent>
    Are you sure you want to send this invite?
  </DialogContent>
  <DialogActions sx={{ justifyContent: "center", mt: 1 }}>
    <Button
      onClick={() => setConfirmOpen(false)}
      variant="outlined"
      color="inherit"
      sx={{ color: "#fff", borderColor: "rgba(255,255,255,0.4)" }}
    >
      Cancel
    </Button>
    <Button
      onClick={() => {
        setConfirmOpen(false);
        handleRegisterInvitee();
      }}
      variant="contained"
      sx={{ bgcolor: "#FFD54F", color: "#000", "&:hover": { bgcolor: "#FFCA28" } }}
    >
      Confirm
    </Button>
  </DialogActions>
</Dialog>
    </Dialog>
    
  );
};

export default InviteEarnDialog;