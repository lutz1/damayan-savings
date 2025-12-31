import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Box,
} from "@mui/material";
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
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>📊 Network Group Sales</DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <Box sx={{ textAlign: "center", py: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* TOP SUMMARY */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {user?.name} ({user?.username})
              </Typography>
              <Typography variant="body1" sx={{ mt: 1 }}>
                <strong>Overall Total Group Sales:</strong>{" "}
                <span style={{ color: "#4CAF50", fontWeight: "bold" }}>
                  ₱{overallTotal.toLocaleString()}
                </span>
              </Typography>
            </Box>

            {/* NETWORK MEMBERS LIST */}
            {networkMembers.length === 0 ? (
              <Typography>No members with Capital Share.</Typography>
            ) : (
              <List>
                {networkMembers.map((m, i) => (
                  <ListItem divider key={i}>
                    <ListItemText
                      primary={`${m.name} (${m.username})`}
                      secondary={
                        <>
                          Role: {m.role || "N/A"} <br />
                          Capital Share: ₱{m.totalCapitalShare.toLocaleString()}
                        </>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default NetworkGroupSales;
