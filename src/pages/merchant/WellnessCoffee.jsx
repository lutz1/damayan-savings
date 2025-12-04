import React, { useEffect, useState } from "react";
import { db } from "../../firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { Box, Card, CardMedia, CardContent, Typography } from "@mui/material";

export default function WellnessCoffee() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "wellness_products", "coffee", "items"),
      (snapshot) => {
        setProducts(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      }
    );
    return unsub;
  }, []);

  return (
    <Box sx={{ p: 3, display: "grid", gap: 2, gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))" }}>
      {products.map((p) => (
        <Card key={p.id} sx={{ borderRadius: 3, boxShadow: "0px 3px 8px rgba(0,0,0,0.15)" }}>
          <CardMedia component="img" height="180" image={p.imageUrl} />

          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {p.name}
            </Typography>
            <Typography sx={{ color: "green", fontWeight: "bold" }}>
              ₱{p.price.toLocaleString()}
            </Typography>
            <Typography variant="body2" sx={{ mt: 1 }}>
              {p.description}
            </Typography>
            <Typography variant="caption" sx={{ display: "block", mt: 1, opacity: 0.7 }}>
              Company: {p.company}
            </Typography>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}