import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  CircularProgress,
  Box,
  Chip,
} from "@mui/material";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../../../firebase";

const NetworkGroupSales = ({ open, onClose, username, user }) => {
  const [loading, setLoading] = useState(true);
  const [networkMembers, setNetworkMembers] = useState([]);
  const [overallTotal, setOverallTotal] = useState(0);

  // 🔹 Recursive fetch of all downline users
  const fetchNetworkUsers = async (rootUsername) => {
    const users = [];
    const queue = [rootUsername];

    while (queue.length) {
      const current = queue.shift();
      if (!current) continue;

      const q = query(collection(db, "users"), where("referredBy", "==", current));
      const snap = await getDocs(q);

      snap.forEach((doc) => {
        const data = doc.data();
        if (data?.username) {
          users.push({ ...data, id: doc.id });
          queue.push(data.username);
        }
      });
    }

    return users;
  };

  // 🔹 Fetch all capital share entries for a given userId
  const fetchCapitalShareRecord = async (userId) => {
    if (!userId) return { total: 0, hasEntry: false };

    const q = query(collection(db, "capitalShareEntries"), where("userId", "==", userId));
    const snap = await getDocs(q);

    let total = 0;
    snap.forEach((d) => {
      total += Number(d.data()?.amount || 0);
    });

    return { total, hasEntry: snap.size > 0 };
  };

  // 🔹 Load network users and their capital shares
  useEffect(() => {
    if (!open || !username) {
      setNetworkMembers([]);
      setOverallTotal(0);
      setLoading(false);
      return;
    }

    const loadData = async () => {
      setLoading(true);

      // 1️⃣ Fetch root user
      const rootSnap = await getDocs(query(collection(db, "users"), where("username", "==", username)));
      const rootDoc = rootSnap.docs[0];
      if (!rootDoc) {
        setNetworkMembers([]);
        setOverallTotal(0);
        setLoading(false);
        return;
      }

      const rootUser = { ...rootDoc.data(), id: rootDoc.id };

      // 2️⃣ Fetch all downline users recursively
      const downlineUsers = await fetchNetworkUsers(username);

      // 3️⃣ Include root user at the top
      const allUsers = [rootUser, ...downlineUsers];

      // 4️⃣ Fetch capital share for each user
      const results = [];
      let totalSum = 0;

      for (const u of allUsers) {
        const { total, hasEntry } = await fetchCapitalShareRecord(u.id);
        if (hasEntry) {
          results.push({
            ...u,
            totalCapitalShare: total,
          });
          totalSum += total;
        }
      }

      setNetworkMembers(results);
      setOverallTotal(totalSum);
      setLoading(false);
    };

    loadData();
  }, [open, username]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      PaperProps={{ sx: { borderRadius: 3, overflow: "hidden", background: "linear-gradient(150deg, rgba(8,26,62,0.96) 0%, rgba(13,44,102,0.92) 100%)", border: "1px solid rgba(217,233,255,0.22)", color: "#fff" } }}
    >
      {/* Header */}
      <DialogTitle sx={{ background: "rgba(8,31,76,0.75)", color: "#fff", p: 0, borderBottom: "1px solid rgba(217,233,255,0.15)" }}>
        <Box sx={{ px: 2.5, pt: 2.5, pb: 2.2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.2, mb: 0.6 }}>
            <Box sx={{ width: 36, height: 36, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.18)",
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <AccountTreeIcon sx={{ color: "#fff", fontSize: 20 }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 9, color: "rgba(255,255,255,0.72)", letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 700 }}>Network</Typography>
              <Typography sx={{ fontSize: 19, fontWeight: 800, color: "#fff" }}>Group Sales</Typography>
            </Box>
          </Box>
          {user && (
            <Typography sx={{ fontSize: 13, color: "rgba(255,255,255,0.80)", mt: 0.4 }}>
              {user.name || user.username}{user.username ? ` @${user.username}` : ""}
            </Typography>
          )}
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        {loading ? (
          <Box sx={{ py: 8, display: "flex", justifyContent: "center" }}>
            <CircularProgress sx={{ color: "#d9e9ff" }} />
          </Box>
        ) : (
          <>
            {/* Summary card */}
            <Box sx={{ mx: 2, mt: 2, mb: 1.5, p: 2, borderRadius: 2.5,
              background: "linear-gradient(140deg, rgba(8,26,62,0.72), rgba(14,54,123,0.58))",
              border: "1px solid rgba(217,233,255,0.16)",
              display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
                <Box sx={{ width: 40, height: 40, borderRadius: 2, backgroundColor: "rgba(217,233,255,0.12)",
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <PeopleAltIcon sx={{ color: "#d9e9ff", fontSize: 22 }} />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 11, color: "rgba(217,233,255,0.76)", fontWeight: 600 }}>Overall Group Sales</Typography>
                  <Typography sx={{ fontSize: 24, fontWeight: 800, color: "#d9e9ff", lineHeight: 1.1 }}>
                    ₱{overallTotal.toLocaleString()}
                  </Typography>
                </Box>
              </Box>
              <Chip
                label={`${networkMembers.length} member${networkMembers.length !== 1 ? "s" : ""}`}
                size="small"
                sx={{ fontWeight: 700, fontSize: 11, backgroundColor: "rgba(217,233,255,0.14)", color: "#d9e9ff" }}
              />
            </Box>

            {/* Members list */}
            {networkMembers.length === 0 ? (
              <Box sx={{ py: 6, textAlign: "center" }}>
                <Typography sx={{ fontSize: 13, color: "rgba(217,233,255,0.74)" }}>No members with Capital Share.</Typography>
              </Box>
            ) : (
              <Box component="ul" sx={{ m: 0, p: 0, listStyle: "none" }}>
                {networkMembers.map((m, i) => (
                  <Box
                    key={i}
                    component="li"
                    sx={{
                      display: "flex", alignItems: "center", gap: 1.4,
                      px: 2, py: 1.6,
                      backgroundColor: i % 2 === 0 ? "rgba(8,26,62,0.42)" : "rgba(7,22,52,0.58)",
                      borderBottom: "1px solid rgba(217,233,255,0.12)",
                    }}
                  >
                    <Box sx={{ width: 40, height: 40, borderRadius: "50%",
                      background: "linear-gradient(135deg,#003f8d,#0055ba)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#fff", fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
                      {(m.name || m.username || "?").charAt(0).toUpperCase()}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display:"flex", alignItems:"center", gap: 0.8 }}>
                        <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#ffffff" }} noWrap>
                          {m.name || m.username}
                        </Typography>
                        {m.role && (
                          <Chip label={m.role} size="small"
                            sx={{ fontSize: 9, fontWeight: 700, height: 18,
                              backgroundColor: "rgba(16,90,191,0.10)", color: "#105abf" }} />
                        )}
                      </Box>
                      <Typography sx={{ fontSize: 11, color: "rgba(217,233,255,0.68)" }}>@{m.username}</Typography>
                    </Box>
                    <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                      <Typography sx={{ fontSize: 14, fontWeight: 800, color: "#d9e9ff" }}>
                        ₱{m.totalCapitalShare.toLocaleString()}
                      </Typography>
                      <Typography sx={{ fontSize: 10, color: "rgba(217,233,255,0.58)", fontWeight: 600, textTransform: "uppercase" }}>Cap Share</Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ backgroundColor: "rgba(7,22,52,0.55)", borderTop: "1px solid rgba(217,233,255,0.14)", px: 2, py: 1.4 }}>
        <Button
          onClick={onClose}
          sx={{ borderRadius: 2, fontWeight: 700, color: "#d9e9ff", textTransform: "none",
            backgroundColor: "rgba(16,90,191,0.2)", px: 2.5, "&:hover": { backgroundColor: "rgba(16,90,191,0.3)" } }}
        >
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default NetworkGroupSales;
