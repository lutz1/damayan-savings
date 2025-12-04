import React, { useState } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  CircularProgress,
} from "@mui/material";
import { db, storage } from "../../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export default function ManageMerchant() {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [company, setCompany] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState(null);

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const handleSubmit = async () => {
    if (!name || !price || !company || !description || !image) {
      alert("Please fill all fields.");
      return;
    }

    setLoading(true);

    try {
      // Upload Image
      const imageRef = ref(storage, `wellness_products/coffee/${Date.now()}_${image.name}`);
      await uploadBytes(imageRef, image);
      const imageUrl = await getDownloadURL(imageRef);

      // Save to Firestore
      await addDoc(collection(db, "wellness_products", "coffee", "items"), {
        name,
        price: parseFloat(price),
        company,
        description,
        imageUrl,
        createdAt: serverTimestamp(),
      });

      setSuccessMsg("Product successfully created!");

      // Clear form
      setName("");
      setPrice("");
      setCompany("");
      setDescription("");
      setImage(null);

    } catch (error) {
      console.error(error);
      alert("Error adding product.");
    }

    setLoading(false);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3, maxWidth: 600, mx: "auto", borderRadius: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: "bold", mb: 2 }}>
          Manage Merchant – Add Coffee Product
        </Typography>

        <TextField
          fullWidth
          label="Product Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          sx={{ mb: 2 }}
        />

        <TextField
          fullWidth
          label="Price"
          type="number"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          sx={{ mb: 2 }}
        />

        <TextField
          fullWidth
          label="Company"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          sx={{ mb: 2 }}
        />

        <TextField
          fullWidth
          multiline
          rows={3}
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          sx={{ mb: 2 }}
        />

        <Button variant="contained" component="label" sx={{ mb: 2 }}>
          Upload Image
          <input
            type="file"
            hidden
            accept="image/*"
            onChange={(e) => setImage(e.target.files[0])}
          />
        </Button>
        {image && <Typography>{image.name}</Typography>}

        <Button
          fullWidth
          variant="contained"
          onClick={handleSubmit}
          disabled={loading}
          sx={{ mt: 2 }}
        >
          {loading ? <CircularProgress size={24} /> : "Create Product"}
        </Button>

        {successMsg && (
          <Typography
            sx={{ mt: 2, color: "green", fontWeight: "bold", textAlign: "center" }}
          >
            {successMsg}
          </Typography>
        )}
      </Paper>
    </Box>
  );
}