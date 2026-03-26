// src/components/Topbar/dialogs/InviteEarnDialog.jsx
import React, { useState, useEffect } from "react";
import {Dialog,DialogTitle,DialogContent,DialogActions,Box,Button,TextField,CircularProgress,Alert,FormControl,InputLabel,Select,MenuItem, Typography, Chip,
} from "@mui/material";
import { PersonAdd } from "@mui/icons-material";
import {collection,query,where,onSnapshot,addDoc,serverTimestamp,doc,updateDoc,limit,getDocs,
  runTransaction,
} from "firebase/firestore";

const InviteEarnDialog = ({ open, onClose, userData, db, auth }) => {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState(""); // Track email-specific errors
  const [newUserUsername, setNewUserUsername] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserContact, setNewUserContact] = useState("");
  const [newUserAddress, setNewUserAddress] = useState("");
  const [newUserRole, setNewUserRole] = useState("Agent");
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
    if (loading) return;
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

    // Prevent duplicate pending invite for same inviter + invitee email
    const existingInviteQ = query(
      collection(db, "pendingInvites"),
      where("inviterId", "==", auth.currentUser.uid),
      where("inviteeEmail", "==", newUserEmail),
      where("status", "==", "Pending Approval"),
      limit(1)
    );
    const existingInviteSnap = await getDocs(existingInviteQ);
    if (!existingInviteSnap.empty) {
      setError("An invite for this email is already pending approval.");
      setLoading(false);
      return;
    }

    try {
      const codeDoc = availableCodes.find((c) => c.code === selectedCode);
      if (!codeDoc?.id) {
        throw new Error("Selected activation code is no longer available.");
      }

      // Get Firebase ID token
      const idToken = await auth.currentUser.getIdToken();
      const clientRequestId = `${auth.currentUser.uid}_${Date.now()}`;

      // Call Cloud Function for atomic invite + reward creation
      const response = await fetch(
        "https://us-central1-amayan-savings.cloudfunctions.net/createInviteAndRewards",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            codeId: codeDoc.id,
            inviteeEmail: newUserEmail,
            inviteeName: newUserName,
            inviteeUsername: newUserUsername,
            contactNumber: newUserContact,
            inviteeAddress: newUserAddress,
            inviteeRole: newUserRole,
            referralCode,
            clientRequestId,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create invite");
      }

      const result = await response.json();
      console.log("✅ Invite created:", result);

      // 5️⃣ SPECIAL BONUSES (kept in frontend for flexibility)
      // ✨ Master MD gets ₱200 bonus for every invite
      const masterMDQuery = query(
        collection(db, "users"),
        where("role", "==", "MasterMD"),
        limit(1)
      );
      const masterMDSnap = await getDocs(masterMDQuery);
      if (!masterMDSnap.empty) {
        const masterMD = masterMDSnap.docs[0];
        await addDoc(collection(db, "referralReward"), {
          userId: masterMD.id,
          username: masterMD.data().username,
          role: "MasterMD",
          amount: 150,
          source: newUserUsername || newUserName || "Invite Registration",
          inviteeUsername: newUserUsername || "",
          inviteeName: newUserName || "",
          triggeredByUsername: userData?.username || "",
          type: "System Bonus",
          approved: true,
          payoutReleased: true,
          createdAt: serverTimestamp(),
        });
        console.log(`💰 Special Bonus ₱150 → ${masterMD.data().username} (System)`);
      }

      // ✨ Special email addresses get bonuses
      const specialEmails = {
        "eliskie40@gmail.com": 150,
        "monares.cyriljay@gmail.com": 100,
        "gedeongipulankjv1611@gmail.com": 150,
        "almirex.jkc@gmail.com": 50,
      };

      for (const [specialEmail, bonusAmount] of Object.entries(specialEmails)) {
        const specialUserQuery = query(
          collection(db, "users"),
          where("email", "==", specialEmail),
          limit(1)
        );
        const specialUserSnap = await getDocs(specialUserQuery);
        if (!specialUserSnap.empty) {
          const specialUser = specialUserSnap.docs[0];
          await addDoc(collection(db, "referralReward"), {
            userId: specialUser.id,
            username: specialUser.data().username,
            role: specialUser.data().role,
            amount: bonusAmount,
            source: newUserUsername || newUserName || "Invite Registration",
            inviteeUsername: newUserUsername || "",
            inviteeName: newUserName || "",
            triggeredByUsername: userData?.username || "",
            type: "System Bonus",
            approved: true,
            payoutReleased: true,
            createdAt: serverTimestamp(),
          });
          console.log(`💰 Special Bonus ₱${bonusAmount} → ${specialUser.data().username} (System)`);
        }
      }

      // Reset form
      setSuccess(true);
      setNewUserName("");
      setNewUserUsername("");
      setNewUserEmail("");
      setNewUserContact("");
      setNewUserAddress("");
      setNewUserRole("Agent");
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
    setEmailError("");
    setSuccess(false);
    setNewUserName("");
    setNewUserUsername("");
    setNewUserEmail("");
    setNewUserContact("");
    setNewUserAddress("");
    setNewUserRole("Agent");
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
          overflow: "hidden",
          backgroundColor: "#f7f9fc",
        },
      }}
    >
      {/* Header — Blue Gradient with Icon */}
      <DialogTitle sx={{ background: "linear-gradient(135deg,#003f8d,#0055ba)", color: "#fff", p: 0 }}>
        <Box sx={{ px: 2.5, pt: 2.5, pb: 2.2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.2, mb: 0.6 }}>
            <Box sx={{ width: 36, height: 36, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.18)",
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <PersonAdd sx={{ color: "#fff", fontSize: 20 }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 9, color: "rgba(255,255,255,0.72)", letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700 }}>Growth</Typography>
              <Typography sx={{ fontSize: 19, fontWeight: 800, color: "#fff" }}>Invite & Earn</Typography>
            </Box>
          </Box>
          <Chip
            label="Build Your Network"
            size="small"
            sx={{ backgroundColor: "rgba(255,255,255,0.2)", color: "#fff", fontWeight: 700, fontSize: 10 }}
          />
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0, backgroundColor: "#f7f9fc" }}>
        <Box sx={{ px: 2, py: 2 }}>
          {error && (
            <Alert
              severity="error"
              sx={{ mb: 2, backgroundColor: "rgba(239,54,54,0.08)", color: "#c62828", borderRadius: 1.5,
                "& .MuiAlert-icon": { color: "#c62828" } }}
            >
              {error}
            </Alert>
          )}
          {success && (
            <Alert
              severity="success"
              sx={{ mb: 2, backgroundColor: "rgba(76,175,80,0.08)", color: "#2e7d32", borderRadius: 1.5,
                "& .MuiAlert-icon": { color: "#2e7d32" } }}
            >
              Invite submitted for admin approval!
            </Alert>
          )}

          <FormControl fullWidth sx={{ mb: 1.8 }}>
            <InputLabel sx={{ color: "#5d646f", fontSize: 12, fontWeight: 600 }}>Select Activation Code</InputLabel>
            <Select
              value={selectedCode}
              onChange={(e) => setSelectedCode(e.target.value)}
              sx={{ 
                backgroundColor: "#fff", 
                borderRadius: 1.5,
                color: "#1f2430",
                fontSize: 13,
                "& .MuiOutlinedInput-notchedOutline": { borderColor: "#d8deea" },
                "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#105abf" },
                "& .MuiSvgIcon-root": { color: "#105abf" },
              }}
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
            variant="outlined"
            sx={{
              mb: 1.8,
              "& .MuiOutlinedInput-root": { 
                backgroundColor: "#f0f3f8",
                borderRadius: 1.5,
                "& fieldset": { borderColor: "#d8deea" },
              },
              "& .MuiInputBase-input.Mui-disabled": { color: "#5d646f" },
              "& .MuiInputLabel-root.Mui-disabled": { color: "#8b95a5" },
            }}
          />

          <TextField
            fullWidth
            label="Username"
            value={newUserUsername}
            onChange={(e) => setNewUserUsername(e.target.value)}
            variant="outlined"
            sx={{
              mb: 1.8,
              "& .MuiOutlinedInput-root": { 
                backgroundColor: "#fff",
                borderRadius: 1.5,
                "& fieldset": { borderColor: "#d8deea" },
              },
              "& .MuiInputBase-input": { color: "#1f2430", fontSize: 13 },
              "& .MuiInputLabel-root": { color: "#5d646f", fontSize: 12 },
            }}
          />

          <TextField
            fullWidth
            label="Full Name"
            value={newUserName}
            onChange={(e) => setNewUserName(e.target.value)}
            variant="outlined"
            sx={{
              mb: 1.8,
              "& .MuiOutlinedInput-root": { 
                backgroundColor: "#fff",
                borderRadius: 1.5,
                "& fieldset": { borderColor: "#d8deea" },
              },
              "& .MuiInputBase-input": { color: "#1f2430", fontSize: 13 },
              "& .MuiInputLabel-root": { color: "#5d646f", fontSize: 12 },
            }}
          />

          <TextField
            fullWidth
            type="email"
            label="Email"
            value={newUserEmail}
            onChange={async (e) => {
              const email = e.target.value;
              setNewUserEmail(email);
              setEmailError("");
              if (email && email.trim().length > 0) {
                if (!isValidEmail(email)) {
                  setEmailError("Invalid email format (no spaces allowed)");
                } else {
                  const exists = await isEmailInUse(email);
                  if (exists) {
                    setEmailError("This email is already in use. Please use another email.");
                  }
                }
              }
            }}
            error={Boolean(emailError)}
            helperText={emailError}
            variant="outlined"
            sx={{
              mb: 1.8,
              "& .MuiOutlinedInput-root": { 
                backgroundColor: "#fff",
                borderRadius: 1.5,
                "& fieldset": { borderColor: emailError ? "#c62828" : "#d8deea" },
              },
              "& .MuiInputBase-input": { color: "#1f2430", fontSize: 13 },
              "& .MuiInputLabel-root": { color: "#5d646f", fontSize: 12 },
              "& .MuiFormHelperText-root": { color: "#c62828", fontSize: 11 },
            }}
          />

          <TextField
            fullWidth
            label="Contact Number"
            value={newUserContact}
            onChange={(e) => setNewUserContact(e.target.value)}
            variant="outlined"
            sx={{
              mb: 1.8,
              "& .MuiOutlinedInput-root": { 
                backgroundColor: "#fff",
                borderRadius: 1.5,
                "& fieldset": { borderColor: "#d8deea" },
              },
              "& .MuiInputBase-input": { color: "#1f2430", fontSize: 13 },
              "& .MuiInputLabel-root": { color: "#5d646f", fontSize: 12 },
            }}
          />

          <TextField
            fullWidth
            label="Address"
            value={newUserAddress}
            onChange={(e) => setNewUserAddress(e.target.value)}
            multiline
            rows={2}
            variant="outlined"
            sx={{
              mb: 1.8,
              "& .MuiOutlinedInput-root": { 
                backgroundColor: "#fff",
                borderRadius: 1.5,
                "& fieldset": { borderColor: "#d8deea" },
              },
              "& .MuiInputBase-input": { color: "#1f2430", fontSize: 13 },
              "& .MuiInputLabel-root": { color: "#5d646f", fontSize: 12 },
            }}
          />

          <FormControl fullWidth sx={{ mb: 1.8 }}>
            <InputLabel sx={{ color: "#5d646f", fontSize: 12, fontWeight: 600 }}>Role</InputLabel>
            <Select
              value={newUserRole}
              onChange={(e) => setNewUserRole(e.target.value)}
              sx={{ 
                backgroundColor: "#fff", 
                borderRadius: 1.5,
                color: "#1f2430",
                fontSize: 13,
                "& .MuiOutlinedInput-notchedOutline": { borderColor: "#d8deea" },
                "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#105abf" },
                "& .MuiSvgIcon-root": { color: "#105abf" },
              }}
            >
              <MenuItem value="Agent">Agent</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </DialogContent>

      <DialogActions sx={{ backgroundColor: "#fff", borderTop: "1px solid #eceef1", px: 2, py: 1.4 }}>
        <Button
          onClick={handleClose}
          sx={{ borderRadius: 2, fontWeight: 700, color: "#105abf", textTransform: "none",
            backgroundColor: "rgba(16,90,191,0.08)", px: 2.5, "&:hover": { backgroundColor: "rgba(16,90,191,0.14)" } }}
        >
          Close
        </Button>
        <Button
          onClick={() => setConfirmOpen(true)}
          variant="contained"
          disabled={loading || Boolean(emailError) || !newUserEmail || !newUserUsername || !newUserName || !newUserContact || !newUserAddress}
          sx={{ 
            borderRadius: 2, 
            textTransform: "none", 
            fontWeight: 700,
            backgroundColor: "#105abf", 
            color: "#fff",
            "&:hover": { backgroundColor: "#0b4eaa" },
            "&:disabled": { backgroundColor: "rgba(16,90,191,0.5)", color: "rgba(255,255,255,0.6)" }
          }}
        >
          {loading ? <CircularProgress size={20} sx={{ color: "#fff" }} /> : "Invite"}
        </Button>
      </DialogActions>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            overflow: "hidden",
            backgroundColor: "#f7f9fc",
          },
        }}
      >
        <DialogTitle sx={{ background: "linear-gradient(135deg,#003f8d,#0055ba)", color: "#fff", p: 2, fontWeight: 700 }}>
          Confirm Invite
        </DialogTitle>
        <DialogContent sx={{ py: 2.5, textAlign: "center", color: "#1f2430" }}>
          <Typography>Are you sure you want to send this invite to <strong>{newUserName}</strong>?</Typography>
        </DialogContent>
        <DialogActions sx={{ backgroundColor: "#fff", borderTop: "1px solid #eceef1", px: 2, py: 1.4 }}>
          <Button
            onClick={() => setConfirmOpen(false)}
            sx={{ borderRadius: 2, fontWeight: 700, color: "#105abf", textTransform: "none",
              backgroundColor: "rgba(16,90,191,0.08)", px: 2.5, "&:hover": { backgroundColor: "rgba(16,90,191,0.14)" } }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              setConfirmOpen(false);
              handleRegisterInvitee();
            }}
            variant="contained"
            disabled={loading}
            sx={{ 
              borderRadius: 2, 
              textTransform: "none", 
              fontWeight: 700,
              backgroundColor: "#105abf", 
              color: "#fff",
              "&:hover": { backgroundColor: "#0b4eaa" },
              "&:disabled": { backgroundColor: "rgba(16,90,191,0.5)" }
            }}
          >
            {loading ? <CircularProgress size={20} sx={{ color: "#fff" }} /> : "Confirm"}
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

export default InviteEarnDialog;