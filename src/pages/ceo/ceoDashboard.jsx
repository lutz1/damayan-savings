import React, { useEffect, useState } from "react";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
} from "@mui/material";
import PeopleIcon from "@mui/icons-material/People";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import PaidIcon from "@mui/icons-material/Paid";
import HourglassTopIcon from "@mui/icons-material/HourglassTop";

const CEODashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalMembers: 0,
    totalDeposits: 0,
    totalPaybacks: 0,
    pendingApprovals: 0,
  });

  useEffect(() => {
    // Simulate async data loading
    setTimeout(() => {
      // Replace this mock data with API fetch later
      setStats({
        totalMembers: 1200,
        totalDeposits: 524300,
        totalPaybacks: 215000,
        pendingApprovals: 14,
      });
      setLoading(false);
    }, 800);
  }, []);

  const StatCard = ({ title, value, icon: Icon, color }) => (
    <Card
      sx={{
        borderRadius: 4,
        boxShadow: 3,
        background: "#fff",
        "&:hover": { boxShadow: 6 },
      }}
    >
      <CardContent>
        <Box display="flex" alignItems="center" gap={2}>
          <Box
            sx={{
              bgcolor: color,
              color: "white",
              p: 1.5,
              borderRadius: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon sx={{ fontSize: 32 }} />
          </Box>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              {title}
            </Typography>
            <Typography variant="h5" fontWeight={600}>
              {loading ? <CircularProgress size={24} /> : value.toLocaleString()}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" fontWeight={600} gutterBottom>
        CEO Dashboard
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" mb={4}>
        Overview of cooperative performance and member activities.
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6} lg={3}>
          <StatCard
            title="Total Members"
            value={stats.totalMembers}
            icon={PeopleIcon}
            color="#1976d2"
          />
        </Grid>

        <Grid item xs={12} md={6} lg={3}>
          <StatCard
            title="Total Deposits"
            value={`₱${stats.totalDeposits}`}
            icon={AccountBalanceIcon}
            color="#2e7d32"
          />
        </Grid>

        <Grid item xs={12} md={6} lg={3}>
          <StatCard
            title="Total Paybacks"
            value={`₱${stats.totalPaybacks}`}
            icon={PaidIcon}
            color="#9c27b0"
          />
        </Grid>

        <Grid item xs={12} md={6} lg={3}>
          <StatCard
            title="Pending Approvals"
            value={stats.pendingApprovals}
            icon={HourglassTopIcon}
            color="#ed6c02"
          />
        </Grid>
      </Grid>

      <Box mt={5}>
        <Card sx={{ borderRadius: 4, boxShadow: 3 }}>
          <CardContent>
            <Typography variant="h6" fontWeight={600} mb={1}>
              Executive Summary
            </Typography>
            <Typography variant="body2" color="text.secondary">
              This dashboard provides a high-level view of cooperative metrics.
              You can expand this page later with financial reports, charts,
              transaction trends, or branch performance analytics tailored for
              the CEO’s view.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default CEODashboard;