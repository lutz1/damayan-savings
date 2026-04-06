import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Toolbar,
  Typography,
  Card,
  CardContent,
  TextField,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Stack,
  Divider,
  CircularProgress,
  useMediaQuery,
  Drawer,
} from "@mui/material";
import {
  AssignmentIndRounded,
  MarkEmailReadRounded,
  VisibilityRounded,
  TaskAltRounded,
  WarningAmberRounded,
} from "@mui/icons-material";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app, auth, db } from "../../firebase";
import Topbar from "../../components/Topbar";
import AppBottomNav from "../../components/AppBottomNav";

const STATUS_OPTIONS = ["ALL", "UNDER_REVIEW", "APPROVED", "REJECTED"];
const firebaseFunctions = getFunctions(app, "us-central1");

const getStatusColor = (status = "") => {
  const normalized = String(status || "UNDER_REVIEW").toUpperCase();
  if (normalized === "APPROVED") return "success";
  if (normalized === "REJECTED") return "error";
  return "warning";
};

const formatTimestamp = (value) => {
  if (value?.seconds) {
    return new Date(value.seconds * 1000).toLocaleString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleString("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  }

  return "—";
};

export default function AdminRiderApplications() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [reviewStatus, setReviewStatus] = useState("UNDER_REVIEW");
  const [reviewRemarks, setReviewRemarks] = useState("");
  const [savingReview, setSavingReview] = useState(false);
  const isMobile = useMediaQuery("(max-width:768px)");
  const currentRole = String(localStorage.getItem("userRole") || "").trim().toUpperCase();
  const canGenerateRiderAccess = ["SUPERADMIN", "CEO"].includes(currentRole);
  const isApproveGenerateMode = reviewStatus === "APPROVED" && canGenerateRiderAccess;

  useEffect(() => setSidebarOpen(!isMobile), [isMobile]);
  const handleToggleSidebar = () => setSidebarOpen((prev) => !prev);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, () => setAuthReady(true));
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!authReady || !auth.currentUser) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const riderApplicationsQuery = query(collection(db, "riderApplications"), orderBy("submittedAt", "desc"));

    const unsubscribe = onSnapshot(
      riderApplicationsQuery,
      (snapshot) => {
        const nextApplications = snapshot.docs.map((applicationDoc) => ({
          id: applicationDoc.id,
          ...applicationDoc.data(),
        }));
        setApplications(nextApplications);
        setLoading(false);
      },
      (error) => {
        console.error("[adminRiderApplications] Error fetching rider applications:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [authReady]);

  const filteredApplications = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return applications.filter((application) => {
      const matchesStatus = statusFilter === "ALL" || String(application.status || "UNDER_REVIEW").toUpperCase() === statusFilter;
      if (!matchesStatus) return false;

      if (!normalizedQuery) return true;

      const haystack = [
        application.referenceNo,
        application.memberEmail,
        application.applicant?.fullName,
        application.applicant?.firstName,
        application.applicant?.lastName,
        application.vehicle?.plateNumber,
        application.vehicle?.model,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [applications, searchQuery, statusFilter]);

  const summary = useMemo(() => ({
    total: applications.length,
    underReview: applications.filter((item) => String(item.status || "UNDER_REVIEW").toUpperCase() === "UNDER_REVIEW").length,
    approved: applications.filter((item) => String(item.status || "").toUpperCase() === "APPROVED").length,
    rejected: applications.filter((item) => String(item.status || "").toUpperCase() === "REJECTED").length,
  }), [applications]);

  const openReviewDialog = (application) => {
    setSelectedApplication(application);
    setReviewStatus(String(application.status || "UNDER_REVIEW").toUpperCase());
    setReviewRemarks(String(application.reviewRemarks || ""));
  };

  const handleSaveReview = async () => {
    if (!selectedApplication?.id || !auth.currentUser?.uid) return;

    if (reviewStatus === "APPROVED" && !canGenerateRiderAccess) {
      alert("Only SUPERADMIN or CEO can approve and generate Rider ID access.");
      return;
    }

    try {
      setSavingReview(true);
      const reviewRiderApplication = httpsCallable(firebaseFunctions, "reviewRiderApplication");
      const result = await reviewRiderApplication({
        applicationId: selectedApplication.id,
        status: reviewStatus,
        reviewRemarks: reviewRemarks.trim(),
      });

      const responseData = result?.data || {};

      if (responseData?.generatedRider?.riderId) {
        alert(
          `Rider access generated successfully.\n\nRider ID: ${responseData.generatedRider.riderId}\nDefault Password: ${responseData.generatedRider.defaultPassword || "password123"}`
        );
      }

      setSelectedApplication(null);
    } catch (error) {
      console.error("[adminRiderApplications] Unable to update application status:", error);
      alert(`Unable to update the rider application: ${error.message}`);
    } finally {
      setSavingReview(false);
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        minHeight: "100vh",
        bgcolor: "#f5f7fb",
        position: "relative",
      }}
    >
      <Box sx={{ position: "fixed", width: "100%", zIndex: 1200 }}>
        <Topbar open={sidebarOpen} onToggleSidebar={handleToggleSidebar} />
      </Box>

      {!isMobile && (
        <Box sx={{ zIndex: 5 }}>
          <AppBottomNav open={sidebarOpen} onToggleSidebar={handleToggleSidebar} layout="sidebar" />
        </Box>
      )}

      {isMobile && (
        <Drawer
          anchor="left"
          open={sidebarOpen}
          onClose={handleToggleSidebar}
          ModalProps={{ keepMounted: true }}
          PaperProps={{
            sx: {
              background: "transparent",
              boxShadow: "none",
            },
          }}
        >
          <AppBottomNav open={sidebarOpen} onToggleSidebar={handleToggleSidebar} layout="sidebar" />
        </Drawer>
      )}

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: "100%",
          px: { xs: 2, md: 3 },
          pb: 4,
          pt: 1,
          ml: { md: sidebarOpen ? "280px" : 0 },
          transition: "margin-left 0.3s ease",
          position: "relative",
          zIndex: 1,
        }}
      >
        <Toolbar />

        <Box sx={{ mb: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 800, color: "#0f172a" }}>
            Rider Applications Management
          </Typography>
          <Typography variant="body2" sx={{ color: "#64748b", mt: 0.5 }}>
            Review, approve, or reject rider applications submitted from the rider onboarding flow.
          </Typography>
        </Box>

        <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 2 }}>
          {[
            { label: "Total Applications", value: summary.total, icon: <AssignmentIndRounded /> },
            { label: "Under Review", value: summary.underReview, icon: <WarningAmberRounded /> },
            { label: "Approved", value: summary.approved, icon: <TaskAltRounded /> },
            { label: "Email Sent", value: applications.filter((item) => item.emailSent).length, icon: <MarkEmailReadRounded /> },
          ].map((item) => (
            <Card key={item.label} sx={{ flex: 1, borderRadius: 3, boxShadow: "0 10px 24px rgba(15,23,42,0.06)" }}>
              <CardContent>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="body2" sx={{ color: "#64748b" }}>{item.label}</Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: "#0f172a" }}>{item.value}</Typography>
                  </Box>
                  <Box sx={{ color: "#2563eb" }}>{item.icon}</Box>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>

        <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 2 }}>
          <TextField
            fullWidth
            label="Search applications"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Reference no, name, email, plate no"
          />
          <TextField
            select
            label="Status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            sx={{ minWidth: { md: 220 } }}
          >
            {STATUS_OPTIONS.map((option) => (
              <MenuItem key={option} value={option}>{option === "ALL" ? "All statuses" : option.replace(/_/g, " ")}</MenuItem>
            ))}
          </TextField>
        </Stack>

        {loading ? (
          <Box sx={{ py: 8, textAlign: "center" }}>
            <CircularProgress />
          </Box>
        ) : isMobile ? (
          <Stack spacing={1.5}>
            {filteredApplications.length === 0 ? (
              <Paper sx={{ p: 3, borderRadius: 3, textAlign: "center", color: "#64748b" }}>No rider applications found.</Paper>
            ) : filteredApplications.map((application) => (
              <Card key={application.id} sx={{ borderRadius: 3 }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                    <Box>
                      <Typography sx={{ fontWeight: 800, color: "#0f172a" }}>{application.referenceNo || "No reference"}</Typography>
                      <Typography variant="body2" sx={{ color: "#64748b" }}>{application.applicant?.fullName || "Unnamed applicant"}</Typography>
                      <Typography variant="body2" sx={{ color: "#64748b" }}>{application.memberEmail || "—"}</Typography>
                    </Box>
                    <Chip label={String(application.status || "UNDER_REVIEW").replace(/_/g, " ")} color={getStatusColor(application.status)} size="small" />
                  </Stack>

                  <Divider sx={{ my: 1.5 }} />
                  <Typography variant="body2" sx={{ color: "#334155" }}><strong>Vehicle:</strong> {application.vehicle?.model || "—"} • {application.vehicle?.plateNumber || "—"}</Typography>
                  <Typography variant="body2" sx={{ color: "#334155", mt: 0.5 }}><strong>Submitted:</strong> {formatTimestamp(application.submittedAt)}</Typography>

                  <Button startIcon={<VisibilityRounded />} variant="contained" sx={{ mt: 1.5, borderRadius: 999 }} onClick={() => openReviewDialog(application)}>
                    Review
                  </Button>
                </CardContent>
              </Card>
            ))}
          </Stack>
        ) : (
          <TableContainer component={Paper} sx={{ borderRadius: 3, boxShadow: "0 10px 24px rgba(15,23,42,0.06)" }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Reference</TableCell>
                  <TableCell>Applicant</TableCell>
                  <TableCell>Vehicle</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Submitted</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredApplications.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">No rider applications found.</TableCell>
                  </TableRow>
                ) : filteredApplications.map((application) => (
                  <TableRow key={application.id} hover>
                    <TableCell>
                      <Typography sx={{ fontWeight: 700 }}>{application.referenceNo || "—"}</Typography>
                      <Typography variant="caption" sx={{ color: "#64748b" }}>{application.memberEmail || "—"}</Typography>
                    </TableCell>
                    <TableCell>{application.applicant?.fullName || "—"}</TableCell>
                    <TableCell>
                      <Typography variant="body2">{application.vehicle?.model || "—"}</Typography>
                      <Typography variant="caption" sx={{ color: "#64748b" }}>{application.vehicle?.plateNumber || "—"}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={String(application.status || "UNDER_REVIEW").replace(/_/g, " ")} color={getStatusColor(application.status)} size="small" />
                    </TableCell>
                    <TableCell>{formatTimestamp(application.submittedAt)}</TableCell>
                    <TableCell align="right">
                      <Button startIcon={<VisibilityRounded />} onClick={() => openReviewDialog(application)}>
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>

      <Dialog open={Boolean(selectedApplication)} onClose={() => setSelectedApplication(null)} fullWidth maxWidth="sm">
        <DialogTitle>Review Rider Application</DialogTitle>
        <DialogContent dividers>
          {selectedApplication && (
            <Stack spacing={2}>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.5 }}>Applicant</Typography>
                <Typography variant="body2">{selectedApplication.applicant?.fullName || "—"}</Typography>
                <Typography variant="body2">{selectedApplication.memberEmail || "—"}</Typography>
                <Typography variant="body2">{selectedApplication.applicant?.phone || "—"}</Typography>
              </Box>

              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.5 }}>Vehicle</Typography>
                <Typography variant="body2">{selectedApplication.vehicle?.vehicleType || "—"} • {selectedApplication.vehicle?.model || "—"}</Typography>
                <Typography variant="body2">Plate No: {selectedApplication.vehicle?.plateNumber || "—"}</Typography>
                <Typography variant="body2">Expiry: {selectedApplication.vehicle?.registrationExpiry || "—"}</Typography>
              </Box>

              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.75 }}>Documents</Typography>
                <Stack spacing={1}>
                  {Object.entries(selectedApplication.documents || {}).map(([key, value]) => (
                    <Stack key={key} direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{key}</Typography>
                        <Typography variant="caption" sx={{ color: "#64748b" }}>{value?.name || "No file"}</Typography>
                      </Box>
                      {value?.downloadUrl ? (
                        <Button size="small" onClick={() => window.open(value.downloadUrl, "_blank", "noopener,noreferrer")}>Open</Button>
                      ) : null}
                    </Stack>
                  ))}
                </Stack>
              </Box>

              <TextField
                select
                label="Application status"
                value={reviewStatus}
                onChange={(event) => setReviewStatus(event.target.value)}
                fullWidth
              >
                {STATUS_OPTIONS.filter((option) => option !== "ALL").map((option) => (
                  <MenuItem key={option} value={option}>{option.replace(/_/g, " ")}</MenuItem>
                ))}
              </TextField>

              <TextField
                label="Review remarks"
                value={reviewRemarks}
                onChange={(event) => setReviewRemarks(event.target.value)}
                multiline
                minRows={3}
                placeholder="Optional remarks for approval or rejection"
                fullWidth
              />

              {reviewStatus === "APPROVED" ? (
                <Paper sx={{ p: 1.5, borderRadius: 2, bgcolor: "#eff6ff", border: "1px solid #bfdbfe" }}>
                  <Typography variant="body2" sx={{ color: "#1d4ed8", fontWeight: 700 }}>
                    {canGenerateRiderAccess
                      ? "Submitting approval will generate a Rider ID and set the default password to password123."
                      : "Only SUPERADMIN or CEO can generate Rider ID access when approving this application."}
                  </Typography>
                  {selectedApplication?.riderId ? (
                    <Typography variant="caption" sx={{ display: "block", color: "#334155", mt: 0.75 }}>
                      Current Rider ID: {selectedApplication.riderId}
                    </Typography>
                  ) : null}
                </Paper>
              ) : null}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedApplication(null)}>Close</Button>
          <Button
            variant="contained"
            onClick={handleSaveReview}
            disabled={savingReview || (reviewStatus === "APPROVED" && !canGenerateRiderAccess)}
          >
            {savingReview
              ? isApproveGenerateMode
                ? "Generating Rider ID..."
                : "Saving..."
              : isApproveGenerateMode
                ? "Submit Generate Rider ID"
                : "Save Review"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
