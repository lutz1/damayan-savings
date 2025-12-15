import React, { useEffect, useMemo, useState } from "react";
import {
	Box,
	Stack,
	Typography,
	TextField,
	Select,
	MenuItem,
	InputLabel,
	FormControl,
	Card,
	CardContent,
	CardMedia,
	IconButton,
	Chip,
	Divider,
	Skeleton,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	Button,
	Switch,
	Snackbar,
	Alert,
	Container,
	LinearProgress,
} from "@mui/material";
import {
	Edit as EditIcon,
	Delete as DeleteIcon,
	Visibility as VisibilityIcon,
	Inventory as InventoryIcon,
	Category as CategoryIcon,
} from "@mui/icons-material";
import MobileAppShell from "../../components/MobileAppShell";
import { auth, db, storage } from "../../firebase";
import {
	collection,
	onSnapshot,
	query,
	where,
	orderBy,
	updateDoc,
	doc,
	serverTimestamp,
	limit,
	startAfter,
	getDocs,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";

const currency = (n) =>
	typeof n === "number"
		? `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
		: "₱0.00";

const stockBadge = (stock) => {
	const s = Number(stock || 0);
	if (s <= 0) return { label: "Out of stock", color: "#d32f2f" };
	if (s <= 5) return { label: "Low stock", color: "#ef6c00" };
	return { label: "In stock", color: "#2e7d32" };
};

export default function ManageProductPage() {
	const [uid, setUid] = useState(localStorage.getItem("uid") || null);
	const [loading, setLoading] = useState(true);
	const [products, setProducts] = useState([]);
	const [pageSize] = useState(20);
	const [lastDoc, setLastDoc] = useState(null);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const [hasMore, setHasMore] = useState(false);
	const [useFallback, setUseFallback] = useState(false);

	// Controls
	const [search, setSearch] = useState("");
	const [category, setCategory] = useState("all");
	const [status, setStatus] = useState("active"); // active | inactive | all (deleted hidden by default)
	const [stockFilter, setStockFilter] = useState("all"); // all | in | out
	const [sort, setSort] = useState("latest"); // latest | price_asc | price_desc

	// UI dialogs
	const [previewItem, setPreviewItem] = useState(null);
	const [editItem, setEditItem] = useState(null);
	const [snack, setSnack] = useState({ open: false, severity: "success", message: "" });
  const [imageUploading, setImageUploading] = useState(false);
  const [imageProgress, setImageProgress] = useState(0);

	// Auth bridge
	useEffect(() => {
		if (uid) return;
		const unsub = onAuthStateChanged(auth, (u) => {
			if (!u) return;
			setUid(u.uid);
			try { localStorage.setItem("uid", u.uid); } catch (_) {}
		});
		return unsub;
	}, [uid]);

	// Load products for merchant
	useEffect(() => {
		if (!uid) return;
		setLoading(true);
		// reset previous load error via snackbar if needed

		const baseCol = collection(db, "products");
		const q = useFallback
			? query(
					baseCol,
					where("merchantId", "==", uid)
				)
			: query(
					baseCol,
					where("merchantId", "==", uid),
					orderBy("createdAt", "desc"),
					limit(pageSize)
				);

		const unsub = onSnapshot(
			q,
						(snap) => {
				const list = snap.docs.map((d) => ({ id: d.id, ...d.data(), _ref: d }));
				setProducts(list);
								if (useFallback) {
									setLastDoc(null);
									setHasMore(false);
								} else {
									const last = snap.docs[snap.docs.length - 1] || null;
									setLastDoc(last);
									setHasMore(Boolean(last) && snap.size === pageSize);
								}
				setLoading(false);
			},
							(err) => {
												console.error(err);
												if (err?.code === 'failed-precondition') {
													setSnack({ open: true, severity: "warning", message: "Missing Firestore index. Using basic list." });
													setUseFallback(true);
												} else {
													setSnack({ open: true, severity: "error", message: "Failed to load products" });
												}
												setLoading(false);
										}
		);

		return unsub;
		}, [uid, pageSize, useFallback]);

	const loadMore = async () => {
		if (useFallback || !uid || !lastDoc || isLoadingMore) return;
		setIsLoadingMore(true);
		try {
			const q = query(
				collection(db, "products"),
				where("merchantId", "==", uid),
				orderBy("createdAt", "desc"),
				startAfter(lastDoc),
				limit(pageSize)
			);
			const snap = await getDocs(q);
			const more = snap.docs.map((d) => ({ id: d.id, ...d.data(), _ref: d }));
			setProducts((prev) => [...prev, ...more]);
			const newLast = snap.docs[snap.docs.length - 1] || null;
			setLastDoc(newLast);
			setHasMore(Boolean(newLast) && snap.size === pageSize);
		} catch (err) {
			console.error(err);
			setSnack({ open: true, severity: "error", message: "Failed to load more" });
		}
		setIsLoadingMore(false);
	};

	// Derived: categories from products
	const categories = useMemo(() => {
		const set = new Set();
		products.forEach((p) => p.category && set.add(p.category));
		return ["all", ...Array.from(set)];
	}, [products]);

	// Filter/sort client-side
	const filtered = useMemo(() => {
		let list = products.filter((p) => p.status !== "deleted");

		if (search.trim()) {
			const s = search.trim().toLowerCase();
			list = list.filter((p) => (p.name || "").toLowerCase().includes(s));
		}

		if (category !== "all") list = list.filter((p) => p.category === category);

		if (status !== "all") list = list.filter((p) => (status === "active" ? p.status === "active" : p.status === "inactive"));

		if (stockFilter !== "all") {
			list = list.filter((p) => {
				const s = Number(p.stock || 0);
				return stockFilter === "in" ? s > 0 : s <= 0;
			});
		}

		if (sort === "price_asc") list.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
		else if (sort === "price_desc") list.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
		else list.sort((a, b) => {
			const ca = (a.createdAt && a.createdAt.toMillis) ? a.createdAt.toMillis() : 0;
			const cb = (b.createdAt && b.createdAt.toMillis) ? b.createdAt.toMillis() : 0;
			return cb - ca;
		});

		return list;
	}, [products, search, category, status, stockFilter, sort]);

	const updateProduct = async (id, patch, optimisticMsg = "Updated") => {
		// optimistic update
		setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
		try {
			await updateDoc(doc(db, "products", id), { ...patch, updatedAt: serverTimestamp() });
			setSnack({ open: true, severity: "success", message: optimisticMsg });
		} catch (err) {
			console.error(err);
			// revert (best-effort by reload snapshot eventually); here we can refetch on next onSnapshot
			setSnack({ open: true, severity: "error", message: "Failed to update product" });
		}
	};

	const handleToggleActive = (p) => {
		const next = p.status === "active" ? "inactive" : "active";
		updateProduct(p.id, { status: next }, next === "active" ? "Product enabled" : "Product disabled");
	};

	const handleSoftDelete = async (p) => {
		const ok = window.confirm(`Delete "${p.name}"? You can’t undo this.`);
		if (!ok) return;
		// Try to delete image from storage (best effort)
		if (p.image) {
			try { await deleteObject(ref(storage, p.image)); } catch (e) { /* ignore */ }
		}
		updateProduct(p.id, { status: "deleted", image: "" }, "Product deleted");
	};

	const handleEditSave = async () => {
		if (!editItem) return;
		const { id, name, category, price, stock, description } = editItem;
		await updateProduct(
			id,
			{
				name: (name || "").trim(),
				category: category || "",
				price: Number(price || 0),
				stock: Number(stock || 0),
				description: (description || "").trim(),
			},
			"Product updated"
		);
		setEditItem(null);
	};

	const handleImageSelect = (e) => {
		const file = e.target.files?.[0];
		if (!file) return;
		if (!file.type.startsWith("image/")) {
			setSnack({ open: true, severity: "warning", message: "Please select an image file" });
			return;
		}
		if (!uid) {
			setSnack({ open: true, severity: "error", message: "Not signed in. Try again." });
			return;
		}

		try {
			setImageUploading(true);
			setImageProgress(0);
			const storageRef = ref(storage, `products/${uid}/${Date.now()}_${file.name}`);
			const task = uploadBytesResumable(storageRef, file);
			task.on(
				"state_changed",
				(snap) => {
					const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
					setImageProgress(pct);
				},
				(err) => {
					console.error(err);
					setSnack({ open: true, severity: "error", message: "Image upload failed" });
					setImageUploading(false);
					setImageProgress(0);
				},
				async () => {
					const url = await getDownloadURL(task.snapshot.ref);
					// delete previous image if exists
					const prev = editItem?.image;
					if (prev) {
						try { await deleteObject(ref(storage, prev)); } catch (_) {}
					}
					setEditItem((s) => ({ ...s, image: url }));
					setSnack({ open: true, severity: "success", message: "Image uploaded" });
					setImageUploading(false);
				}
			);
		} catch (err) {
			console.error(err);
			setSnack({ open: true, severity: "error", message: "Image upload error" });
			setImageUploading(false);
			setImageProgress(0);
		}
	};

	const renderCard = (p) => {
		const badge = stockBadge(p.stock);
		const updated = p.updatedAt?.toDate?.() || p.createdAt?.toDate?.();
		return (
			<Card key={p.id} sx={{ mb: 1.5, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
				<CardContent>
					<Stack direction="row" spacing={2} alignItems="flex-start">
						<CardMedia
							component="img"
							image={p.image || "/icons/icon-192x192.png"}
							alt={p.name}
							sx={{ width: 84, height: 84, borderRadius: 1.5, objectFit: "cover", bgcolor: "#eee" }}
						/>
						<Stack spacing={0.5} flex={1} minWidth={0}>
							<Stack direction="row" alignItems="center" justifyContent="space-between">
								<Typography variant="subtitle1" fontWeight={700} noWrap>{p.name || "Unnamed"}</Typography>
								<Switch
									checked={p.status === "active"}
									onChange={() => handleToggleActive(p)}
									size="small"
								/>
							</Stack>
							<Stack direction="row" spacing={1} alignItems="center">
								<CategoryIcon sx={{ fontSize: 16, color: "#607d8b" }} />
								<Typography variant="caption" color="#607d8b">{p.category || "Uncategorized"}</Typography>
							</Stack>
							<Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
								<Chip size="small" label={currency(Number(p.price || 0))} sx={{ bgcolor: "#e3f2fd" }} />
								<Chip size="small" label={badge.label} sx={{ bgcolor: badge.color, color: "#fff" }} />
								{updated && (
									<Chip size="small" label={`Updated ${updated.toLocaleDateString()} ${updated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`} />
								)}
							</Stack>
							<Stack direction="row" spacing={1} mt={0.5}>
								<IconButton size="small" onClick={() => setPreviewItem(p)} aria-label="View">
									<VisibilityIcon fontSize="small" />
								</IconButton>
								<IconButton size="small" onClick={() => setEditItem({ ...p })} aria-label="Edit">
									<EditIcon fontSize="small" />
								</IconButton>
								<IconButton size="small" color="error" onClick={() => handleSoftDelete(p)} aria-label="Delete">
									<DeleteIcon fontSize="small" />
								</IconButton>
							</Stack>
						</Stack>
					</Stack>
				</CardContent>
			</Card>
		);
	};

	return (
		<MobileAppShell title="Manage Products">
			<Box sx={{ minHeight: "100vh", bgcolor: "#f5f5f5", pb: 2, pt: 2 }}>
				<Container maxWidth="sm" sx={{ pb: 10 }}>
					{/* Controls */}
					<Card sx={{ mb: 2 }}>
						<CardContent>
							<Stack spacing={1.5}>
								<TextField
									fullWidth
									placeholder="Search products..."
									value={search}
									onChange={(e) => setSearch(e.target.value)}
									InputProps={{ startAdornment: <InventoryIcon sx={{ mr: 1, color: '#607d8b' }} /> }}
								/>
								<Stack direction="row" spacing={1}>
									<FormControl fullWidth>
										<InputLabel>Category</InputLabel>
										<Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
											{categories.map((c) => (
												<MenuItem key={c} value={c}>{c === "all" ? "All Categories" : c}</MenuItem>
											))}
										</Select>
									</FormControl>
									<FormControl fullWidth>
										<InputLabel>Status</InputLabel>
										<Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
											<MenuItem value="active">Active</MenuItem>
											<MenuItem value="inactive">Inactive</MenuItem>
											<MenuItem value="all">All</MenuItem>
										</Select>
									</FormControl>
								</Stack>
								<Stack direction="row" spacing={1}>
									<FormControl fullWidth>
										<InputLabel>Stock</InputLabel>
										<Select label="Stock" value={stockFilter} onChange={(e) => setStockFilter(e.target.value)}>
											<MenuItem value="all">All</MenuItem>
											<MenuItem value="in">In stock</MenuItem>
											<MenuItem value="out">Out of stock</MenuItem>
										</Select>
									</FormControl>
									<FormControl fullWidth>
										<InputLabel>Sort</InputLabel>
										<Select label="Sort" value={sort} onChange={(e) => setSort(e.target.value)}>
											<MenuItem value="latest">Latest added</MenuItem>
											<MenuItem value="price_asc">Price: Low to High</MenuItem>
											<MenuItem value="price_desc">Price: High to Low</MenuItem>
										</Select>
									</FormControl>
								</Stack>
							</Stack>
						</CardContent>
					</Card>

					{/* List */}
					{loading && (
						<>
							{[...Array(4)].map((_, i) => (
								<Card key={i} sx={{ mb: 1.5 }}>
									<CardContent>
										<Stack direction="row" spacing={2} alignItems="flex-start">
											<Skeleton variant="rectangular" width={84} height={84} sx={{ borderRadius: 1.5 }} />
											<Stack spacing={1} flex={1}>
												<Skeleton variant="text" width="60%" />
												<Skeleton variant="text" width="40%" />
												<Skeleton variant="rectangular" width="80%" height={26} />
											</Stack>
										</Stack>
									</CardContent>
								</Card>
							))}
						</>
					)}

					{!loading && filtered.length === 0 && (
						<Card>
							<CardContent>
								<Typography variant="subtitle1" fontWeight={600} gutterBottom>
									No products found
								</Typography>
								<Typography variant="body2" color="#607d8b">
									Try adjusting your filters or search query.
								</Typography>
							</CardContent>
						</Card>
					)}

					{!loading && filtered.map((p) => renderCard(p))}

					{!loading && hasMore && (
						<Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
							<Button onClick={loadMore} disabled={isLoadingMore} variant="outlined">
								{isLoadingMore ? 'Loading…' : 'Load more'}
							</Button>
						</Box>
					)}
				</Container>
			</Box>

			{/* Preview Dialog */}
			<Dialog open={!!previewItem} onClose={() => setPreviewItem(null)} fullWidth maxWidth="xs">
				{previewItem && (
					<>
						<DialogTitle>Product Preview</DialogTitle>
						<DialogContent>
							<Card elevation={0}>
								<CardMedia
									component="img"
									image={previewItem.image || "/icons/icon-192x192.png"}
									alt={previewItem.name}
									sx={{ borderRadius: 1, mb: 1, maxHeight: 220, objectFit: 'cover' }}
								/>
								<CardContent>
									<Typography variant="h6" fontWeight={700}>{previewItem.name}</Typography>
									<Typography variant="body2" color="#607d8b">{previewItem.category || 'Uncategorized'}</Typography>
									<Divider sx={{ my: 1 }} />
									<Typography variant="h5" fontWeight={700}>{currency(Number(previewItem.price || 0))}</Typography>
									<Typography variant="body2" sx={{ mt: 1 }}>{previewItem.description || "No description."}</Typography>
								</CardContent>
							</Card>
						</DialogContent>
						<DialogActions>
							<Button onClick={() => setPreviewItem(null)}>Close</Button>
						</DialogActions>
					</>
				)}
			</Dialog>

			{/* Edit Dialog */}
			<Dialog open={!!editItem} onClose={() => setEditItem(null)} fullWidth maxWidth="xs">
				{editItem && (
					<>
						<DialogTitle>Edit Product</DialogTitle>
						<DialogContent>
							<Stack spacing={1.5} sx={{ mt: 0.5 }}>
								<TextField
									label="Product Name"
									value={editItem.name || ""}
									onChange={(e) => setEditItem((s) => ({ ...s, name: e.target.value }))}
									fullWidth
								/>
								<TextField
									label="Category"
									value={editItem.category || ""}
									onChange={(e) => setEditItem((s) => ({ ...s, category: e.target.value }))}
									fullWidth
								/>
								<TextField
									label="Price"
									type="number"
									value={editItem.price ?? ""}
									onChange={(e) => setEditItem((s) => ({ ...s, price: e.target.value }))}
									fullWidth
								/>
								<TextField
									label="Stock"
									type="number"
									value={editItem.stock ?? ""}
									onChange={(e) => setEditItem((s) => ({ ...s, stock: e.target.value }))}
									fullWidth
								/>
								<TextField
									label="Description"
									multiline rows={3}
									value={editItem.description || ""}
									onChange={(e) => setEditItem((s) => ({ ...s, description: e.target.value }))}
									fullWidth
								/>
												<Box>
													<Typography variant="subtitle2" sx={{ mb: 1 }}>Product Image</Typography>
													<Card elevation={0} sx={{ p: 1, bgcolor: '#fafafa' }}>
														<Stack direction="row" spacing={2} alignItems="center">
															<CardMedia
																component="img"
																image={editItem.image || "/icons/icon-192x192.png"}
																alt={editItem.name}
																sx={{ width: 84, height: 84, borderRadius: 1.5, objectFit: 'cover', bgcolor: '#eee' }}
															/>
															<Stack direction="row" spacing={1} alignItems="center">
																<Button variant="outlined" component="label" disabled={imageUploading}>
																	{imageUploading ? "Uploading..." : "Change Image"}
																	<input hidden type="file" accept="image/*" onChange={handleImageSelect} />
																</Button>
																{editItem.image && (
																	<Button
																		color="error"
																		variant="text"
																		disabled={imageUploading}
																		onClick={async () => {
																			try {
																				await deleteObject(ref(storage, editItem.image));
																				setEditItem((s) => ({ ...s, image: "" }));
																				setSnack({ open: true, severity: "success", message: "Image removed" });
																			} catch (err) {
																				console.error(err);
																				setSnack({ open: true, severity: "error", message: "Failed to remove image" });
																			}
																		}}
																	>
																		Remove Image
																	</Button>
																)}
															</Stack>
														</Stack>
														{imageUploading && (
															<Box sx={{ mt: 1 }}>
																<LinearProgress variant="determinate" value={imageProgress} />
																<Typography variant="caption" color="text.secondary">{imageProgress}%</Typography>
															</Box>
														)}
													</Card>
												</Box>
							</Stack>
						</DialogContent>
						<DialogActions>
								<Button onClick={() => setEditItem(null)} disabled={imageUploading}>Cancel</Button>
								<Button variant="contained" onClick={handleEditSave} disabled={imageUploading}>Save</Button>
						</DialogActions>
					</>
				)}
			</Dialog>

			<Snackbar
				open={snack.open}
				autoHideDuration={2500}
				onClose={() => setSnack((s) => ({ ...s, open: false }))}
				anchorOrigin={{ vertical: "top", horizontal: "center" }}
			>
				<Alert severity={snack.severity} variant="filled" sx={{ width: "100%" }}>
					{snack.message}
				</Alert>
			</Snackbar>
		</MobileAppShell>
	);
}

