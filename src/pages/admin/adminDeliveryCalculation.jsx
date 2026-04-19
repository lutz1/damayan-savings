import React, { useState } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
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
import { LocalShipping as DeliveryIcon } from "@mui/icons-material";

export default function AdminDeliveryCalculation() {
  const [customerDistance, setCustomerDistance] = useState(3.5);
  const [rainBoost, setRainBoost] = useState(0);

  const calculateDeliveryFee = () => {
    // Base fee = ₱50 per 3 km
    const baseFee = 50;
    
    // Distance charge = ₱14 per km
    const distanceCharge = customerDistance * 14;
    
    // Rain boost is optional
    const totalRainBoost = rainBoost ? 15 : 0;
    
    const totalFee = baseFee + distanceCharge + totalRainBoost;
    
    return {
      baseFee,
      customerDistance,
      distanceCharge,
      rainBoost: totalRainBoost,
      totalFee,
    };
  };

  const calculation = calculateDeliveryFee();

  return (
    <Box sx={{ padding: 3 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 4 }}>
        <DeliveryIcon sx={{ fontSize: 40, color: "#1976d2" }} />
        <Typography variant="h4" sx={{ fontWeight: 600, color: "#1976d2" }}>
          Delivery Calculation
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Calculator Section */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ padding: 3, borderRadius: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              Delivery Fee Calculator
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Typography variant="body2" sx={{ backgroundColor: "#e3f2fd", padding: "12px", borderRadius: "4px" }}>
                <strong>Formula:</strong> Base Fee ₱50 + (Customer Distance × ₱14/km) + Rain Boost
              </Typography>
              
              <TextField
                label="Customer Distance (km) - Store to Customer"
                type="number"
                value={customerDistance}
                onChange={(e) => setCustomerDistance(Number(e.target.value))}
                inputProps={{ step: 0.1, min: 0 }}
                fullWidth
                variant="outlined"
              />
              
              <FormControlLabel
                control={<Switch checked={rainBoost} onChange={(e) => setRainBoost(e.target.checked)} />}
                label="Rain/Bad Weather (+₱15 boost)"
              />
            </Box>
          </Paper>
        </Grid>

        {/* Result Section */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ padding: 3, borderRadius: 2, backgroundColor: "#f5f9ff" }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
              Calculation Breakdown
            </Typography>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography>Base Fee (₱40 per 3 km threshold):</Typography>
                <Typography sx={{ fontWeight: 600 }}>₱{calculation.baseFee.toFixed(2)}</Typography>
              </Box>

              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography>
                  Distance Charge: {calculation.customerDistance} km × ₱14/km
                </Typography>
                <Typography sx={{ fontWeight: 600 }}>₱{calculation.distanceCharge.toFixed(2)}</Typography>
              </Box>

              {calculation.rainBoost > 0 && (
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography>Rain/Weather Boost:</Typography>
                  <Typography sx={{ fontWeight: 600, color: "#e74c3c" }}>
                    +₱{calculation.rainBoost.toFixed(2)}
                  </Typography>
                </Box>
              )}

              <Divider sx={{ my: 1 }} />

              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  p: 2,
                  backgroundColor: "#1976d2",
                  borderRadius: 1,
                }}
              >
                <Typography sx={{ color: "white", fontWeight: 600 }}>Total Customer Delivery Fee:</Typography>
                <Typography sx={{ color: "white", fontWeight: 600, fontSize: "1.2em" }}>
                  ₱{calculation.totalFee.toFixed(2)}
                </Typography>
              </Box>

              <Alert severity="info" sx={{ mt: 2 }}>
                <strong>Formula:</strong> ₱40 Base + ({calculation.customerDistance} km × ₱12) {calculation.rainBoost > 0 ? `+ ₱${calculation.rainBoost}` : ''} = ₱{calculation.totalFee.toFixed(2)}
              </Alert>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Formula Explanation */}
      <Paper sx={{ padding: 3, borderRadius: 2, mt: 4 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
          How Delivery Fees Are Calculated
        </Typography>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "#1976d2", mb: 1 }}>
                1. Base Fee (Minimum Delivery Charge)
              </Typography>
              <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
                There is a minimum/base delivery fee regardless of distance. This covers:
              </Typography>
              <ul style={{ margin: "8px 0", paddingLeft: "20px" }}>
                <li>Rider availability and operational costs</li>
                <li>Minimum service charge for order processing</li>
              </ul>
              <Typography variant="body2" sx={{ backgroundColor: "#f0f4f8", padding: "8px", borderRadius: "4px" }}>
                <strong>Example:</strong> Base fee = ₱30
              </Typography>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "#1976d2", mb: 1 }}>
                2. Distance-Based Calculation
              </Typography>
              <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
                The primary component is the distance between the restaurant and delivery location. This is
                calculated using <strong>road distance</strong> (actual routing), not "as the crow flies."
              </Typography>
              <Typography
                variant="body2"
                sx={{ backgroundColor: "#f0f4f8", padding: "8px", borderRadius: "4px", mt: 1 }}
              >
                <strong>Formula:</strong> Distance × Rate per km
              </Typography>
              <Typography variant="body2" sx={{ backgroundColor: "#f0f4f8", padding: "8px", borderRadius: "4px", mt: 1 }}>
                <strong>Example:</strong> 3.5 km × ₱10/km = ₱35
              </Typography>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "#1976d2", mb: 1 }}>
                3. Dynamic Pricing (Surge Pricing)
              </Typography>
              <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
                Fees can increase during peak times or high demand:
              </Typography>
              <ul style={{ margin: "8px 0", paddingLeft: "20px" }}>
                <li>Peak hours (lunch 11 AM - 2 PM, dinner 5 PM - 8 PM)</li>
                <li>Bad weather conditions</li>
                <li>High demand with low rider availability</li>
              </ul>
              <Typography variant="body2" sx={{ backgroundColor: "#fff3cd", padding: "8px", borderRadius: "4px" }}>
                <strong>Example:</strong> Additional surge fee during peak hours = ₱15
              </Typography>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "#1976d2", mb: 1 }}>
                4. Zone-Based Pricing (Alternative Model)
              </Typography>
              <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
                Instead of continuous calculation, some areas use zone-based pricing:
              </Typography>
              <TableContainer>
                <Table size="small" sx={{ mt: 1 }}>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: "#f0f4f8" }}>
                      <TableCell sx={{ fontWeight: 600 }}>Zone</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Distance Range</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Delivery Fee</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell>Zone A</TableCell>
                      <TableCell>0 - 1 km</TableCell>
                      <TableCell>₱30</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Zone B</TableCell>
                      <TableCell>1 - 3 km</TableCell>
                      <TableCell>₱50</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Zone C</TableCell>
                      <TableCell>3 - 5 km</TableCell>
                      <TableCell>₱70</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Zone D</TableCell>
                      <TableCell>5+ km</TableCell>
                      <TableCell>₱100+</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "#1976d2", mb: 1 }}>
                5. Restaurant-Specific Adjustments
              </Typography>
              <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
                Merchants can influence delivery fees through:
              </Typography>
              <ul style={{ margin: "8px 0", paddingLeft: "20px" }}>
                <li>
                  <strong>Subsidized Delivery:</strong> Merchant covers part of delivery cost
                </li>
                <li>
                  <strong>Free Delivery Promotions:</strong> Above certain order amounts
                </li>
                <li>
                  <strong>Partnership Discounts:</strong> Reduced fees for partner merchants
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "#1976d2", mb: 1 }}>
                6. Additional Charges
              </Typography>
              <Typography variant="body2" sx={{ lineHeight: 1.8 }}>
                May apply in certain scenarios:
              </Typography>
              <ul style={{ margin: "8px 0", paddingLeft: "20px" }}>
                <li>Long-distance fee (for orders beyond service area)</li>
                <li>Small order fee (if below minimum order value)</li>
                <li>Late-night delivery surcharge</li>
              </ul>
            </CardContent>
          </Card>
        </Box>
      </Paper>

      {/* Complete Example */}
      <Paper sx={{ padding: 3, borderRadius: 2, mt: 4, backgroundColor: "#f5f9ff" }}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
          Complete Example Calculation
        </Typography>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Typography variant="body2">
            <strong>Scenario:</strong> Customer orders from a restaurant 3.5 km away (during normal hours, no rain)
          </Typography>

          <Box sx={{ backgroundColor: "white", p: 2, borderRadius: 1, border: "1px solid #e0e0e0" }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
              <Typography variant="body2">Base fee (₱35 per 3 km threshold):</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                ₱35
              </Typography>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
              <Typography variant="body2">Distance charge (3.5 km × ₱10/km):</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                ₱35
              </Typography>
            </Box>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography sx={{ fontWeight: 600 }}>Total Delivery Fee:</Typography>
              <Typography sx={{ fontWeight: 600, fontSize: "1.1em", color: "#1976d2" }}>
                ₱70
              </Typography>
            </Box>
          </Box>

          <Typography variant="body2" sx={{ mt: 2 }}>
            <strong>With Rain Boost:</strong> ₱70 + ₱15 = ₱85
          </Typography>
        </Box>
      </Paper>

      {/* Implementation Notes */}
      <Alert severity="success" sx={{ mt: 4 }}>
        <strong>Implementation Notes:</strong>
        <ul style={{ margin: "8px 0", paddingLeft: "20px" }}>
          <li>All calculations are done server-side for accuracy and security</li>
          <li>Delivery fees are automatically calculated and displayed in ShopPage</li>
          <li>Real-time distance is fetched from Google Maps Distance API</li>
          <li>Surge pricing is automatically applied during peak hours and high demand</li>
          <li>Customers see the final delivery fee before confirming their order</li>
        </ul>
      </Alert>
    </Box>
  );
}
