// src/components/purchaseCodesAnalytics.jsx
/* eslint-disable no-unused-vars */
import React, { useEffect, useState, useMemo } from "react";
import { Box, Card, CardContent, Typography, TextField, Grid, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { ResponsiveLine } from "@nivo/line";
import { db } from "../firebase"; 
import { collection, query, onSnapshot, orderBy } from "firebase/firestore";
import dayjs from "dayjs";

const PurchaseCodesAnalytics = () => {
  const [purchasedCodes, setPurchasedCodes] = useState([]);
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [summaryType, setSummaryType] = useState("daily");

  // Fetch data from Firestore
  useEffect(() => {
    const q = query(collection(db, "purchaseCodes"), orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data());
      setPurchasedCodes(data);
    });
    return () => unsubscribe();
  }, []);

  // Aggregate data based on summary type
  const chartData = useMemo(() => {
    const map = {};
    purchasedCodes.forEach(item => {
      let dateObj = item.createdAt?.toDate?.();
      if (!dateObj) return;

      if (dateRange.from && dateObj < new Date(dateRange.from)) return;
      if (dateRange.to && dateObj > new Date(dateRange.to)) return;

      let key;
      switch (summaryType) {
        case "weekly":
          key = dayjs(dateObj).startOf("week").format("YYYY-MM-DD");
          break;
        case "monthly":
          key = dayjs(dateObj).format("YYYY-MM");
          break;
        case "annual":
          key = dayjs(dateObj).format("YYYY");
          break;
        default:
          key = dayjs(dateObj).format("YYYY-MM-DD");
      }

      map[key] = (map[key] || 0) + Number(item.amount || 0);
    });

    const sortedData = Object.entries(map)
      .sort(([a], [b]) => new Date(a) - new Date(b))
      .map(([x, y]) => ({ x, y }));

    return [
      {
        id: "Purchased Codes",
        color: "#4caf50", // green color
        data: sortedData,
      },
    ];
  }, [purchasedCodes, dateRange, summaryType]);

  const totalAmount = useMemo(() => purchasedCodes.reduce((sum, p) => sum + (Number(p.amount) || 0), 0), [purchasedCodes]);
  const totalCodes = useMemo(() => purchasedCodes.length, [purchasedCodes]);

  return (
    <Box sx={{ mt: 4, width: "100%" }}>
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 600, textShadow: "1px 1px 2px rgba(0,0,0,0.4)" }}>
        🎟 Purchased Codes Analytics
      </Typography>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <Card sx={{ p: 2, backdropFilter: "blur(12px)", background: "rgba(255,255,255,0.08)", color: "#fff", borderRadius: 2 }}>
            <Typography variant="subtitle2">Total Codes</Typography>
            <Typography variant="h6" fontWeight="bold">{totalCodes}</Typography>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card sx={{ p: 2, backdropFilter: "blur(12px)", background: "rgba(255,255,255,0.08)", color: "#fff", borderRadius: 2 }}>
            <Typography variant="subtitle2">Total Amount</Typography>
            <Typography variant="h6" fontWeight="bold">₱{totalAmount.toLocaleString()}</Typography>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} sx={{ display: "flex", justifyContent: { xs: "flex-start", sm: "flex-end" }, alignItems: "center", mt: { xs: 2, sm: 0 } }}>
          <ToggleButtonGroup
            value={summaryType}
            exclusive
            onChange={(e, val) => val && setSummaryType(val)}
            color="primary"
            sx={{ background: "rgba(255,255,255,0.08)", borderRadius: 2, flexWrap: "wrap" }}
          >
            <ToggleButton value="daily">Daily</ToggleButton>
            <ToggleButton value="weekly">Weekly</ToggleButton>
            <ToggleButton value="monthly">Monthly</ToggleButton>
            <ToggleButton value="annual">Annual</ToggleButton>
          </ToggleButtonGroup>
        </Grid>
      </Grid>

      {/* Chart Card */}
      <Card sx={{ p: 2, background: "linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.05))", backdropFilter: "blur(12px)", color: "#fff", borderRadius: "20px", boxShadow: "0 10px 30px rgba(0,0,0,0.4)", width: "100%", mx: "auto" }}>
        <CardContent>
          {purchasedCodes.length === 0 ? (
            <Typography>No purchased codes data available</Typography>
          ) : (
            <Box sx={{ height: { xs: 300, sm: 400 }, width: "100%" }}>
              <ResponsiveLine
                data={chartData}
                margin={{ top: 20, right: 50, bottom: 60, left: 60 }}
                xScale={{ type: "point" }}
                yScale={{ type: "linear", min: 0, max: "auto" }}
                axisBottom={{ orient: "bottom", tickRotation: -45, legend: "Date", legendOffset: 40, legendPosition: "middle" }}
                axisLeft={{ orient: "left", legend: "Amount", legendOffset: -50, legendPosition: "middle" }}
                colors={{ datum: "color" }} // use the color defined in chartData
                pointSize={10}
                pointBorderWidth={2}
                pointBorderColor={{ from: "serieColor" }}
                enableArea={true}
                useMesh={true}
                enableSlices="x"
                animate={true}
                motionStiffness={90}
                motionDamping={15}
                tooltip={({ point }) => point.data ? (
                  <Box sx={{ p: 1, background: "#222", color: "#fff", borderRadius: 1 }}>
                    <Typography variant="body2">{point.data.x}</Typography>
                    <Typography variant="subtitle2" color="#fff">₱{Number(point.data.y).toLocaleString()}</Typography>
                  </Box>
                ) : null}
                legends={[{ anchor: "top-left", direction: "row", itemWidth: 140, itemHeight: 20, symbolSize: 12, symbolShape: "circle", toggleSerie: true }]}
              />
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default PurchaseCodesAnalytics;