import React, { useState } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  Alert,
  Grid,
  Switch,
  FormControlLabel,
} from "@mui/material";
import { AttachMoney as EarningsIcon } from "@mui/icons-material";

export default function AdminRiderEarnings() {
  const [riderToRestaurant, setRiderToRestaurant] = useState(1.5);
  const [restaurantToCustomer, setRestaurantToCustomer] = useState(3.5);
  const [rainBoost, setRainBoost] = useState(false);
  const [isPeakHours, setIsPeakHours] = useState(false);
  const [incentiveBonus, setIncentiveBonus] = useState(15);

  const calculateRiderEarnings = () => {
    const totalDistance = riderToRestaurant + restaurantToCustomer;
    
    // Base fee = ₱30 per 3 km threshold
    const baseFee = 30;
    
    // Distance charge = ₱9 per km (full trip distance: rider → store → customer)
    const distanceCharge = totalDistance * 9;
    
    // Rain boost is optional
    const rainBoostAmount = rainBoost ? 15 : 0;
    
    // Peak hours add to bonus
    let bonusAmount = incentiveBonus;
    if (isPeakHours) {
      bonusAmount += Math.round(baseFee * 0.15); // 15% peak hour bonus
    }

    const totalEarnings = baseFee + distanceCharge + rainBoostAmount + bonusAmount;

    return {
      baseFee,
      totalDistance,
      distanceCharge,
      rainBoostAmount,
      bonusAmount,
      incentiveBonus,
      isPeakHours,
      peakHourBonus: isPeakHours ? Math.round(baseFee * 0.15) : 0,
      totalEarnings,
    };
  };

  const earnings = calculateRiderEarnings();
  
  // Customer-facing delivery fee (store → customer only)
  const customerDistance = restaurantToCustomer;
  const customerBaseFee = 40;
  const customerDeliveryFee = customerBaseFee + (customerDistance * 12) + (rainBoost ? 15 : 0);
  const platformCommission = customerDeliveryFee - earnings.totalEarnings;

  return (
    <Box sx={{ padding: 3 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 4 }}>
        <EarningsIcon sx={{ fontSize: 40, color: "#27ae60" }} />
        <Typography variant="h4" sx={{ fontWeight: 600, color: "#27ae60" }}>
          Rider Earnings Calculator
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Input Section */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ padding: 3, borderRadius: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              Earnings Components
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Typography variant="body2" sx={{ backgroundColor: "#f0fdf4", padding: "12px", borderRadius: "4px" }}>
                <strong>Formula:</strong> Base Fee ₱30 + (Total Distance × ₱9/km) + Bonuses + Rain Boost
              </Typography>
              
              <TextField
                label="Rider → Restaurant Distance (km)"
                type="number"
                value={riderToRestaurant}
                onChange={(e) => setRiderToRestaurant(Number(e.target.value))}
                inputProps={{ step: 0.1, min: 0 }}
                fullWidth
                variant="outlined"
              />
              <TextField
                label="Restaurant → Customer Distance (km)"
                type="number"
                value={restaurantToCustomer}
                onChange={(e) => setRestaurantToCustomer(Number(e.target.value))}
                inputProps={{ step: 0.1, min: 0 }}
                fullWidth
                variant="outlined"
              />
              <TextField
                label="Incentive Bonus (₱)"
                type="number"
                value={incentiveBonus}
                onChange={(e) => setIncentiveBonus(Number(e.target.value))}
                inputProps={{ step: 1, min: 0 }}
                fullWidth
                variant="outlined"
              />

              <Divider sx={{ my: 1 }} />

              <FormControlLabel
                control={<Switch checked={isPeakHours} onChange={(e) => setIsPeakHours(e.target.checked)} />}
                label="Peak Hours (Lunch 11 AM-2 PM or Dinner 5 PM-8 PM) - +15% bonus"
              />
              <FormControlLabel
                control={<Switch checked={rainBoost} onChange={(e) => setRainBoost(e.target.checked)} />}
                label="Rainy/Bad Weather (+₱25)"
              />
            </Box>
          </Paper>
        </Grid>

        {/* Results Section */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ padding: 3, borderRadius: 2, backgroundColor: "#f0fdf4" }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
              Rider Earnings Breakdown
            </Typography>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography>Base Fee (₱30 per 3 km threshold):</Typography>
                <Typography sx={{ fontWeight: 600 }}>₱{earnings.baseFee.toFixed(2)}</Typography>
              </Box>

              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography>
                  Distance Pay ({earnings.totalDistance} km × ₱10/km):
                </Typography>
                <Typography sx={{ fontWeight: 600 }}>₱{earnings.distanceCharge.toFixed(2)}</Typography>
              </Box>

              {earnings.rainBoostAmount > 0 && (
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography>Rain/Weather Boost:</Typography>
                  <Typography sx={{ fontWeight: 600, color: "#16a34a" }}>+₱{earnings.rainBoostAmount.toFixed(2)}</Typography>
                </Box>
              )}

              {earnings.incentiveBonus > 0 && (
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography>Incentive Bonus:</Typography>
                  <Typography sx={{ fontWeight: 600, color: "#16a34a" }}>₱{earnings.incentiveBonus.toFixed(2)}</Typography>
                </Box>
              )}

              {earnings.peakHourBonus > 0 && (
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography>Peak Hours Bonus (15%):</Typography>
                  <Typography sx={{ fontWeight: 600, color: "#16a34a" }}>+₱{earnings.peakHourBonus.toFixed(2)}</Typography>
                </Box>
              )}

              <Divider sx={{ my: 1 }} />

              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  p: 2,
                  backgroundColor: "#16a34a",
                  borderRadius: 1,
                }}
              >
                <Typography sx={{ color: "white", fontWeight: 600 }}>Total Rider Earnings:</Typography>
                <Typography sx={{ color: "white", fontWeight: 600, fontSize: "1.2em" }}>
                  ₱{earnings.totalEarnings.toFixed(2)}
                </Typography>
              </Box>

              <Alert severity="info" sx={{ mt: 2 }}>
                <strong>Total Distance:</strong> {earnings.totalDistance} km (Rider → Restaurant → Customer)
              </Alert>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Customer vs Rider Comparison */}
      <Paper sx={{ padding: 3, borderRadius: 2, mt: 4, backgroundColor: "#fef3c7" }}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
          💰 Customer Payment vs Rider Earnings vs Platform Revenue
        </Typography>

        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={4}>
            <Card sx={{ backgroundColor: "#e0f2fe" }}>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Customer Pays
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 600, color: "#0369a1" }}>
                  ₱{customerDeliveryFee.toFixed(2)}
                </Typography>
                <Typography variant="caption">Delivery Fee</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <Card sx={{ backgroundColor: "#f0fdf4" }}>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Rider Earns
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 600, color: "#16a34a" }}>
                  ₱{earnings.totalEarnings.toFixed(2)}
                </Typography>
                <Typography variant="caption">Total Earnings</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <Card sx={{ backgroundColor: "#fce7f3" }}>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Platform Keeps
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 600, color: "#e11d48" }}>
                  ₱{platformCommission.toFixed(2)}
                </Typography>
                <Typography variant="caption">
                  {((platformCommission / customerDeliveryFee) * 100).toFixed(1)}% of delivery fee
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
            The platform revenue covers: app operations, customer support, refund processing, marketing, server
            costs, and payment processing fees.
          </Typography>
        </Box>
      </Paper>

      {/* How Riders Earn */}
      <Paper sx={{ padding: 3, borderRadius: 2, mt: 4 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
          🚴 How Riders Earn Money
        </Typography>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "#16a34a", mb: 1 }}>
                1. Base Pay per Delivery
              </Typography>
              <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
                <strong>What it is:</strong> Fixed guaranteed pay for every completed delivery
              </Typography>
              <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
                <strong>Amount:</strong> ₱20–₱40 depending on city size and demand
              </Typography>
              <Typography
                variant="body2"
                sx={{ backgroundColor: "#f0fdf4", padding: "8px", borderRadius: "4px", mt: 1 }}
              >
                ✓ This is guaranteed even for very short trips
              </Typography>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "#16a34a", mb: 1 }}>
                2. Distance-Based Pay
              </Typography>
              <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
                <strong>What it is:</strong> Additional earnings based on the total distance traveled
              </Typography>
              <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
                <strong>Rate:</strong> Around ₱5–₱10 per km (varies by city and incentive programs)
              </Typography>
              <Typography variant="body2" sx={{ lineHeight: 1.8, mt: 1 }}>
                <strong>Distance calculation:</strong>
              </Typography>
              <ul style={{ margin: "8px 0", paddingLeft: "20px" }}>
                <li>Rider's current location → Restaurant (pickup distance)</li>
                <li>Restaurant → Customer (delivery distance)</li>
              </ul>
              <Typography
                variant="body2"
                sx={{ backgroundColor: "#f0fdf4", padding: "8px", borderRadius: "4px", mt: 1 }}
              >
                <strong>Example:</strong> 1.5 km (to restaurant) + 3.5 km (to customer) = 5 km total × ₱7/km =
                ₱35
              </Typography>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "#16a34a", mb: 1 }}>
                3. Waiting Time / Pickup Factors
              </Typography>
              <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
                <strong>What it is:</strong> Compensation when the restaurant takes longer to prepare the order
              </Typography>
              <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
                <strong>How it works:</strong> If you wait beyond a certain threshold (usually 5-10 minutes), you
                get small compensation
              </Typography>
              <Typography variant="body2" sx={{ lineHeight: 1.8, mt: 1 }}>
                <strong>Amount:</strong> Usually ₱5–₱15 depending on wait time
              </Typography>
              <Typography
                variant="body2"
                sx={{ backgroundColor: "#fff3cd", padding: "8px", borderRadius: "4px", mt: 1 }}
              >
                ⚠️ Not always guaranteed—depends on platform's policy
              </Typography>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "#16a34a", mb: 1 }}>
                4. Incentives & Bonuses ⭐ (Most Important!)
              </Typography>
              <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
                <strong>What it is:</strong> Extra earnings based on performance and demand
              </Typography>
              <Typography variant="body2" sx={{ lineHeight: 1.8, mt: 1 }}>
                <strong>Types of bonuses:</strong>
              </Typography>
              <ul style={{ margin: "8px 0", paddingLeft: "20px" }}>
                <li>
                  <strong>Per-order bonuses:</strong> Complete 10 orders → extra ₱200; 20 orders → extra ₱300
                </li>
                <li>
                  <strong>Peak hour boosts:</strong> +15% on all earnings during lunch/dinner hours
                </li>
                <li>
                  <strong>Rain/weather incentives:</strong> Additional ₱25–₱50 during storms
                </li>
                <li>
                  <strong>Weekly targets:</strong> Achieve X deliveries → unlock bonus pool
                </li>
              </ul>
              <Typography
                variant="body2"
                sx={{ backgroundColor: "#f0fdf4", padding: "8px", borderRadius: "4px", mt: 1 }}
              >
                💡 <strong>Important:</strong> Bonuses can often be BIGGER than base pay!
              </Typography>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "#16a34a", mb: 1 }}>
                5. Surge / Busy Area Pay
              </Typography>
              <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
                <strong>What it is:</strong> Extra pay when demand is very high and few riders are available
              </Typography>
              <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
                <strong>Amount:</strong> Additional ₱10–₱30 per order during high-demand periods
              </Typography>
              <Typography variant="body2" sx={{ lineHeight: 1.8, mt: 1 }}>
                <strong>When it happens:</strong>
              </Typography>
              <ul style={{ margin: "8px 0", paddingLeft: "20px" }}>
                <li>Lunch or dinner rush hours</li>
                <li>Holidays or special events</li>
                <li>Weather emergencies (heavy rain/traffic)</li>
                <li>New area with limited rider supply</li>
              </ul>
            </CardContent>
          </Card>
        </Box>
      </Paper>

      {/* Example Calculation */}
      <Paper sx={{ padding: 3, borderRadius: 2, mt: 4, backgroundColor: "#f0fdf4" }}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
          📊 Example: Typical Tagum City Delivery Route (No Rain)
        </Typography>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Typography variant="body2">
            <strong>Scenario:</strong> Delivery during normal (non-peak) hours, rider 1.5 km from store, customer 3.5 km from store
          </Typography>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: "#f0fdf4" }}>
                  <TableCell sx={{ fontWeight: 600 }}>Component</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">
                    Amount
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Notes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>Base Fee (₱25)</TableCell>
                  <TableCell align="right">₱25</TableCell>
                  <TableCell>Guaranteed per delivery</TableCell>
                </TableRow>
                <TableRow sx={{ backgroundColor: "#fef3c7" }}>
                  <TableCell>Distance (5 km × ₱8/km)</TableCell>
                  <TableCell align="right">₱40</TableCell>
                  <TableCell>1.5 km to restaurant + 3.5 km to customer</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Incentive Bonus</TableCell>
                  <TableCell align="right">₱15</TableCell>
                  <TableCell>Part of daily performance bonus</TableCell>
                </TableRow>
                <TableRow sx={{ backgroundColor: "#dcfce7" }}>
                  <TableCell sx={{ fontWeight: 600 }}>Total Rider Earnings</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">
                    ₱80
                  </TableCell>
                  <TableCell>What rider actually receives</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>

          <Alert severity="warning">
            <strong>Customer pays:</strong> ₱40 + (3.5 × ₱12) = ₱82 delivery fee
            <br />
            <strong>Rider earns:</strong> ₱25 + (5 × ₱8) + ₱15 = ₱80
            <br />
            <strong>Platform keeps:</strong> ₱82 - ₱80 = +₱2 (Profitable!)
            <br />
            <strong>Key difference:</strong> Rider travels pickup distance, customer only pays for delivery distance
          </Alert>
        </Box>
      </Paper>

      {/* Peak Hours Example */}
      <Paper sx={{ padding: 3, borderRadius: 2, mt: 4, backgroundColor: "#fef3c7" }}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
          🔥 Peak Hours Example (Lunch Rush, Same Route)
        </Typography>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Typography variant="body2">
            <strong>Same delivery</strong>, but during 12 PM lunch rush on a Friday (with ₱15 rain boost)
          </Typography>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: "#fef3c7" }}>
                  <TableCell sx={{ fontWeight: 600 }}>Component</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">
                    Amount
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Notes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>Base Fee (₱25)</TableCell>
                  <TableCell align="right">₱25</TableCell>
                  <TableCell>Same</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Distance (5 km × ₱8/km)</TableCell>
                  <TableCell align="right">₱40</TableCell>
                  <TableCell>Same</TableCell>
                </TableRow>
                <TableRow sx={{ backgroundColor: "#dcfce7" }}>
                  <TableCell>Peak Hour Bonus (+15%)</TableCell>
                  <TableCell align="right">₱4</TableCell>
                  <TableCell>15% of base: ₱25 × 0.15</TableCell>
                </TableRow>
                <TableRow sx={{ backgroundColor: "#dcfce7" }}>
                  <TableCell>Rain/Weather Boost</TableCell>
                  <TableCell align="right">₱15</TableCell>
                  <TableCell>Rainy conditions</TableCell>
                </TableRow>
                <TableRow sx={{ backgroundColor: "#dcfce7" }}>
                  <TableCell>Incentive Bonus</TableCell>
                  <TableCell align="right">₱25</TableCell>
                  <TableCell>Higher during peak hours</TableCell>
                </TableRow>
                <TableRow sx={{ backgroundColor: "#fbbf24" }}>
                  <TableCell sx={{ fontWeight: 600 }}>Total Rider Earnings</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="right">
                    ₱120
                  </TableCell>
                  <TableCell>60% increase vs normal hours!</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>

          <Alert severity="info">
            This is why riders prefer peak hours! Earnings can increase significantly.
          </Alert>
        </Box>
      </Paper>

      {/* Key Takeaways */}
      <Alert severity="success" sx={{ mt: 4 }}>
        <strong>Sustainable Business Model: Customer Distance ≠ Rider Distance</strong>
        <ul style={{ margin: "8px 0", paddingLeft: "20px" }}>
          <li>
            <strong>Customer Delivery Fee (Store → Customer only):</strong> ₱50 base + (distance × ₱14) + rain boost = ₱99 (for 3.5 km)
          </li>
          <li>
            <strong>Rider Earnings (Rider → Store → Customer):</strong> ₱30 base + (total distance × ₱9) + bonuses + rain boost = ₱75+ (for 5 km total)
          </li>
          <li>
            <strong>Why they're different:</strong>
            <ul style={{ margin: "4px 0", paddingLeft: "20px" }}>
              <li>Rider travels pickup distance (1.5 km) + delivery distance (3.5 km) = 5 km total</li>
              <li>Customer only pays for delivery distance (3.5 km)</li>
              <li>Rider base fee (₱30) is less than customer base fee (₱50)</li>
              <li>Rider distance rate (₱9/km) is less than customer rate (₱14/km)</li>
              <li>Riders still earn competitively through bonuses and incentives</li>
            </ul>
          </li>
          <li>
            <strong>Peak hours earn 60% more:</strong> Riders can earn ₱120 on peak deliveries with bonuses (lunch/dinner rush)
          </li>
          <li>
            <strong>Platform sustainability:</strong> Customer pays ₱99, rider earns ₱75, platform keeps ₱24 per delivery (+24% margin for operations, support, refunds, development)
          </li>
        </ul>
      </Alert>
    </Box>
  );
}
