import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Drawer,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Toolbar,
  Typography,
  useMediaQuery,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import DownloadIcon from "@mui/icons-material/Download";
import GroupsIcon from "@mui/icons-material/Groups";
import SavingsIcon from "@mui/icons-material/Savings";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { auth, db } from "../../firebase";
import Topbar from "../../components/Topbar";
import AppBottomNav from "../../components/AppBottomNav";
import AdminSidebarToggle from "../../components/AdminSidebarToggle";

const toDateValue = (value) => {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateTime = (value) => {
  const date = toDateValue(value);
  if (!date) return "—";
  return date.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const formatCurrency = (value) =>
  `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const AdminCapitalShareEntriesManagement = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [teamFilter, setTeamFilter] = useState("ALL");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const isMobile = useMediaQuery("(max-width:768px)");
  const currentRole = String(localStorage.getItem("userRole") || "").trim().toUpperCase();
  const isSuperAdmin = currentRole === "SUPERADMIN";

  useEffect(() => setSidebarOpen(!isMobile), [isMobile]);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, () => {
      setAuthReady(true);
    });

    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!authReady || !auth.currentUser) return undefined;

    setLoading(true);

    const unsubEntries = onSnapshot(
      query(collection(db, "capitalShareEntries"), orderBy("createdAt", "desc")),
      (snapshot) => {
        setEntries(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching capital share entries:", error);
        setLoading(false);
      }
    );

    const unsubUsers = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        const nextUsers = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        nextUsers.sort((a, b) =>
          String(a.username || a.name || "").localeCompare(String(b.username || b.name || ""))
        );
        setUsers(nextUsers);
      },
      (error) => {
        console.error("Error fetching users:", error);
      }
    );

    return () => {
      unsubEntries();
      unsubUsers();
    };
  }, [authReady]);

  const usersById = useMemo(() => {
    const map = new Map();
    users.forEach((user) => {
      map.set(user.id, user);
    });
    return map;
  }, [users]);

  const teamGraph = useMemo(() => {
    const childrenMap = new Map();

    users.forEach((user) => {
      const username = String(user.username || "").trim();
      const referredBy = String(user.referredBy || "").trim();

      if (!username) return;
      if (!childrenMap.has(username)) childrenMap.set(username, []);
      if (referredBy) {
        const siblings = childrenMap.get(referredBy) || [];
        siblings.push(username);
        childrenMap.set(referredBy, siblings);
      }
    });

    const collectTeamMembers = (leaderUsername) => {
      const normalizedLeader = String(leaderUsername || "").trim();
      if (!normalizedLeader) return new Set();

      const visited = new Set();
      const queue = [normalizedLeader];

      while (queue.length) {
        const current = queue.shift();
        if (!current || visited.has(current)) continue;
        visited.add(current);

        const children = childrenMap.get(current) || [];
        children.forEach((child) => {
          if (!visited.has(child)) {
            queue.push(child);
          }
        });
      }

      return visited;
    };

    return { childrenMap, collectTeamMembers };
  }, [users]);

  const teamOptions = useMemo(() => {
    return users
      .filter((user) => {
        const username = String(user.username || "").trim();
        return username && (teamGraph.childrenMap.get(username) || []).length > 0;
      })
      .map((user) => ({
        username: user.username,
        name: user.name || user.username,
        teamSize: Math.max(0, teamGraph.collectTeamMembers(user.username).size - 1),
      }));
  }, [users, teamGraph]);

  const selectedTeamMembers = useMemo(() => {
    if (teamFilter === "ALL") return null;
    return teamGraph.collectTeamMembers(teamFilter);
  }, [teamFilter, teamGraph]);

  const filteredEntries = useMemo(() => {
    const searchText = searchQuery.trim().toLowerCase();

    const enriched = entries.map((entry) => {
      const user = usersById.get(entry.userId) || {};
      const username = String(user.username || entry.username || "").trim();
      const name = user.name || entry.name || username || entry.userId || "Unknown User";
      const email = user.email || entry.email || "—";
      const role = user.role || entry.role || "—";
      const referredBy = user.referredBy || entry.referredBy || "—";

      return {
        ...entry,
        user,
        username,
        name,
        email,
        role,
        referredBy,
        createdAtText: formatDateTime(entry.createdAt),
        entryDateText: formatDateTime(entry.date || entry.entryDate || entry.createdAt),
        nextProfitDateText: formatDateTime(entry.nextProfitDate),
        transferableAfterText: formatDateTime(entry.transferableAfterDate),
      };
    });

    return enriched.filter((entry) => {
      const matchesSearch = !searchText
        ? true
        : [entry.name, entry.username, entry.email, entry.referredBy, entry.role, entry.id]
            .join(" ")
            .toLowerCase()
            .includes(searchText);

      const matchesTeam = !selectedTeamMembers
        ? true
        : selectedTeamMembers.has(entry.username) || selectedTeamMembers.has(entry.referredBy);

      return matchesSearch && matchesTeam;
    });
  }, [entries, usersById, searchQuery, selectedTeamMembers]);

  useEffect(() => {
    setPage(0);
  }, [searchQuery, teamFilter]);

  const paginatedEntries = useMemo(() => {
    const start = page * rowsPerPage;
    return filteredEntries.slice(start, start + rowsPerPage);
  }, [filteredEntries, page, rowsPerPage]);

  const summary = useMemo(() => {
    return filteredEntries.reduce(
      (acc, entry) => {
        acc.totalAmount += Number(entry.amount || 0);
        acc.totalProfit += Number(entry.profit || 0);
        acc.totalLockIn += Number(entry.lockInPortion || 0);
        return acc;
      },
      { totalAmount: 0, totalProfit: 0, totalLockIn: 0 }
    );
  }, [filteredEntries]);

  const handleExportExcel = () => {
    if (!filteredEntries.length) {
      alert("No capital share entries to export.");
      return;
    }

    const exportData = filteredEntries.map((entry) => ({
      "Member Name": entry.name,
      Username: entry.username || "—",
      Email: entry.email || "—",
      Role: entry.role || "—",
      Team: entry.referredBy || "—",
      Amount: Number(entry.amount || 0),
      "Lock-In Portion": Number(entry.lockInPortion || 0),
      "Transferable Portion": Number(entry.transferablePortion || 0),
      Profit: Number(entry.profit || 0),
      "Profit Status": entry.profitStatus || "—",
      Status: entry.status || "—",
      "Entry Date": entry.entryDateText,
      "Created At": entry.createdAtText,
      "Next Profit Date": entry.nextProfitDateText,
      "Transferable After": entry.transferableAfterText,
      "Entry ID": entry.id,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Capital Share Entries");

    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const data = new Blob([excelBuffer], { type: "application/octet-stream" });
    const safeTeamName = teamFilter === "ALL" ? "AllTeams" : teamFilter;
    saveAs(data, `CapitalShareEntries_${safeTeamName}.xlsx`);
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0f172a 0%, #111827 38%, #172554 100%)",
        position: "relative",
      }}
    >
      <Box sx={{ position: "fixed", width: "100%", zIndex: 1200 }}>
        <Topbar open={sidebarOpen} onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />
      </Box>
      <Toolbar />

      {!isMobile && <AppBottomNav open={sidebarOpen} onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />}

      {isMobile && (
        <>
          <AdminSidebarToggle onClick={() => setSidebarOpen((prev) => !prev)} />
          <Drawer
            anchor="left"
            open={sidebarOpen}
            onClose={() => setSidebarOpen((prev) => !prev)}
            ModalProps={{ keepMounted: true }}
            PaperProps={{ sx: { background: "transparent", boxShadow: "none" } }}
          >
            <AppBottomNav layout="sidebar" open={sidebarOpen} onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />
          </Drawer>
        </>
      )}

      <Box
        sx={{
          flex: 1,
          width: "100%",
          maxWidth: 1600,
          mx: "auto",
          p: { xs: 1.5, md: 3 },
          pt: { xs: 2, md: 3 },
          pl: 0,
        }}
      >
        <Typography variant="h4" sx={{ color: "#fff", fontWeight: 800, mb: 1.2 }}>
          Capital Share Entries Management
        </Typography>
        <Typography sx={{ color: "rgba(226,232,240,0.78)", mb: 2.5, fontSize: 14 }}>
          View all capital share entries, filter by a selected team like `almerx`, and export the filtered results to Excel.
        </Typography>

        {!isSuperAdmin && (
          <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
            This page is intended for Superadmin access.
          </Alert>
        )}

        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ mb: 2.2 }}>
          <Card sx={{ flex: 1, borderRadius: 3, background: "rgba(15,23,42,0.82)", border: "1px solid rgba(148,163,184,0.18)" }}>
            <CardContent>
              <Stack direction="row" spacing={1.2} alignItems="center">
                <ReceiptLongIcon sx={{ color: "#60a5fa" }} />
                <Box>
                  <Typography sx={{ color: "#94a3b8", fontSize: 12 }}>Filtered Entries</Typography>
                  <Typography sx={{ color: "#fff", fontWeight: 800, fontSize: 24 }}>{filteredEntries.length}</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
          <Card sx={{ flex: 1, borderRadius: 3, background: "rgba(15,23,42,0.82)", border: "1px solid rgba(148,163,184,0.18)" }}>
            <CardContent>
              <Stack direction="row" spacing={1.2} alignItems="center">
                <SavingsIcon sx={{ color: "#34d399" }} />
                <Box>
                  <Typography sx={{ color: "#94a3b8", fontSize: 12 }}>Total Amount</Typography>
                  <Typography sx={{ color: "#fff", fontWeight: 800, fontSize: 24 }}>{formatCurrency(summary.totalAmount)}</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
          <Card sx={{ flex: 1, borderRadius: 3, background: "rgba(15,23,42,0.82)", border: "1px solid rgba(148,163,184,0.18)" }}>
            <CardContent>
              <Stack direction="row" spacing={1.2} alignItems="center">
                <GroupsIcon sx={{ color: "#fbbf24" }} />
                <Box>
                  <Typography sx={{ color: "#94a3b8", fontSize: 12 }}>Selected Team Size</Typography>
                  <Typography sx={{ color: "#fff", fontWeight: 800, fontSize: 24 }}>
                    {selectedTeamMembers ? selectedTeamMembers.size : users.length}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Stack>

        <Paper
          sx={{
            p: 2,
            mb: 2,
            borderRadius: 3,
            background: "rgba(15,23,42,0.84)",
            border: "1px solid rgba(148,163,184,0.18)",
          }}
        >
          <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5} alignItems={{ xs: "stretch", lg: "center" }}>
            <TextField
              fullWidth
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, username, email, or team"
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: "rgba(148,163,184,0.9)" }} />,
              }}
              sx={{
                flex: 1.2,
                "& .MuiOutlinedInput-root": {
                  color: "#fff",
                  backgroundColor: "rgba(2,6,23,0.45)",
                  borderRadius: 2,
                },
              }}
            />

            <TextField
              select
              label="Team Filter"
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              sx={{
                minWidth: { xs: "100%", md: 280 },
                "& .MuiOutlinedInput-root": {
                  color: "#fff",
                  backgroundColor: "rgba(2,6,23,0.45)",
                  borderRadius: 2,
                },
                "& .MuiInputLabel-root": { color: "rgba(226,232,240,0.7)" },
              }}
            >
              <MenuItem value="ALL">All Teams</MenuItem>
              {teamOptions.map((option) => (
                <MenuItem key={option.username} value={option.username}>
                  {option.username} ({option.teamSize} members)
                </MenuItem>
              ))}
            </TextField>

            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={handleExportExcel}
              sx={{
                textTransform: "none",
                fontWeight: 700,
                borderRadius: 2,
                minHeight: 54,
                px: 2.2,
                background: "linear-gradient(135deg, #2563eb, #0f766e)",
                "&:hover": { background: "linear-gradient(135deg, #1d4ed8, #0f766e)" },
              }}
            >
              Export Excel
            </Button>
          </Stack>
        </Paper>

        {loading ? (
          <Box sx={{ minHeight: 260, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CircularProgress color="info" />
          </Box>
        ) : (
          <Paper
            sx={{
              borderRadius: 3,
              overflow: "hidden",
              background: "rgba(15,23,42,0.84)",
              border: "1px solid rgba(148,163,184,0.18)",
            }}
          >
            <TableContainer sx={{ maxHeight: "70vh" }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    {[
                      "Member",
                      "Team",
                      "Amount",
                      "Lock-In",
                      "Transferable",
                      "Profit",
                      "Status",
                      "Entry Date",
                      "Created",
                    ].map((label) => (
                      <TableCell
                        key={label}
                        sx={{
                          backgroundColor: "#0f172a",
                          color: "#fff",
                          fontWeight: 800,
                          borderBottom: "1px solid rgba(148,163,184,0.18)",
                        }}
                      >
                        {label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} sx={{ color: "#cbd5e1", textAlign: "center", py: 4 }}>
                        No capital share entries found for the selected filter.
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedEntries.map((entry) => (
                      <TableRow key={entry.id} hover>
                        <TableCell sx={{ color: "#fff", borderColor: "rgba(148,163,184,0.12)" }}>
                          <Box>
                            <Typography sx={{ fontWeight: 700 }}>{entry.name}</Typography>
                            <Typography sx={{ fontSize: 12, color: "#94a3b8" }}>
                              @{entry.username || "unknown"}
                            </Typography>
                            <Typography sx={{ fontSize: 12, color: "#94a3b8" }}>{entry.email}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ color: "#e2e8f0", borderColor: "rgba(148,163,184,0.12)" }}>
                          <Typography sx={{ fontWeight: 600 }}>{entry.referredBy || "—"}</Typography>
                          <Typography sx={{ fontSize: 12, color: "#94a3b8" }}>{entry.role || "—"}</Typography>
                        </TableCell>
                        <TableCell sx={{ color: "#34d399", fontWeight: 700, borderColor: "rgba(148,163,184,0.12)" }}>
                          {formatCurrency(entry.amount)}
                        </TableCell>
                        <TableCell sx={{ color: "#fbbf24", borderColor: "rgba(148,163,184,0.12)" }}>
                          {formatCurrency(entry.lockInPortion)}
                        </TableCell>
                        <TableCell sx={{ color: "#93c5fd", borderColor: "rgba(148,163,184,0.12)" }}>
                          {formatCurrency(entry.transferablePortion)}
                        </TableCell>
                        <TableCell sx={{ color: "#c4b5fd", borderColor: "rgba(148,163,184,0.12)" }}>
                          <Box>
                            <Typography>{formatCurrency(entry.profit)}</Typography>
                            <Typography sx={{ fontSize: 12, color: "#94a3b8" }}>{entry.profitStatus || "Pending"}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ borderColor: "rgba(148,163,184,0.12)" }}>
                          <Chip
                            label={entry.status || "Approved"}
                            size="small"
                            sx={{
                              fontWeight: 700,
                              backgroundColor: (entry.status || "Approved") === "Approved" ? "rgba(16,185,129,0.18)" : "rgba(251,191,36,0.18)",
                              color: (entry.status || "Approved") === "Approved" ? "#6ee7b7" : "#fcd34d",
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ color: "#cbd5e1", minWidth: 160, borderColor: "rgba(148,163,184,0.12)" }}>
                          {entry.entryDateText}
                        </TableCell>
                        <TableCell sx={{ color: "#cbd5e1", minWidth: 160, borderColor: "rgba(148,163,184,0.12)" }}>
                          {entry.createdAtText}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              component="div"
              count={filteredEntries.length}
              page={page}
              onPageChange={(_, newPage) => setPage(newPage)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(event) => {
                setRowsPerPage(parseInt(event.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={[10, 25, 50]}
              sx={{ color: "#e2e8f0", borderTop: "1px solid rgba(148,163,184,0.16)" }}
            />
          </Paper>
        )}
      </Box>
    </Box>
  );
};

export default AdminCapitalShareEntriesManagement;
