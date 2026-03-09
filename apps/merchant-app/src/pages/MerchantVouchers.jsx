import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
  CircularProgress,
} from "@mui/material";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import QrScanner from "qr-scanner";
import { useNavigate } from "react-router-dom";
import { createFirebaseClients } from "../../../../shared/firebase/firebaseClient";
import MerchantBottomNav from "../components/MerchantBottomNav";

const { auth, db } = createFirebaseClients("MerchantApp");

const MaterialIcon = ({ name, size = 24, sx = {} }) => (
  <span
    className="material-symbols-outlined"
    style={{
      fontSize: size,
      fontVariationSettings: "'FILL' 0, 'wght' 400",
      ...sx,
    }}
  >
    {name}
  </span>
);

const MerchantVouchers = () => {
  const navigate = useNavigate();
  const isMountedRef = useRef(true);

  const [merchantUid, setMerchantUid] = useState(auth.currentUser?.uid || "");
  const [merchantEmail, setMerchantEmail] = useState("");

  const [capitalShareVouchers, setCapitalShareVouchers] = useState([]);
  const [loadingCapital, setLoadingCapital] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const [snack, setSnack] = useState({ open: false, severity: "success", message: "" });

  const [scannerDialogOpen, setScannerDialogOpen] = useState(false);
  const [scannerInput, setScannerInput] = useState("");
  const [scannerStatus, setScannerStatus] = useState("");
  const [scannerActive, setScannerActive] = useState(false);
  const [scannerSupported, setScannerSupported] = useState(true);
  const [redeemingVoucher, setRedeemingVoucher] = useState(false);

  const scannerVideoRef = useRef(null);
  const qrScannerRef = useRef(null);

  // Detect iOS for browser-specific fallback messaging.
  const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent);

  const showSnack = (severity, message) => {
    if (!isMountedRef.current) return;
    setSnack({ open: true, severity, message });
  };

  const stopQrScanner = () => {
    qrScannerRef.current?.stop();
    qrScannerRef.current?.destroy();
    qrScannerRef.current = null;

    if (scannerVideoRef.current) {
      scannerVideoRef.current.srcObject = null;
    }
    setScannerActive(false);
  };

  useEffect(() => {
    return () => {
      stopQrScanner();
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!isMountedRef.current) return;

      if (!user) {
        setMerchantUid("");
        setMerchantEmail("");
        setCapitalShareVouchers([]);
        setLoadingCapital(false);
        return;
      }

      setMerchantUid(user.uid);
      setMerchantEmail(String(user.email || "").toLowerCase());
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!merchantUid) return;

    const loadMerchantProfile = async () => {
      try {
        const merchantSnap = await getDoc(doc(db, "users", merchantUid));
        if (merchantSnap.exists()) {
          const data = merchantSnap.data() || {};
          setMerchantEmail(String(data.email || auth.currentUser?.email || "").toLowerCase());
        }
      } catch (err) {
        console.error("Failed to load merchant profile:", err);
      }
    };

    loadMerchantProfile();
  }, [merchantUid]);

  useEffect(() => {
    if (!loadingCapital) return undefined;

    const timeoutId = setTimeout(() => {
      if (!isMountedRef.current) return;
      setLoadingCapital(false);
    }, 8000);

    return () => clearTimeout(timeoutId);
  }, [loadingCapital]);

  useEffect(() => {
    if (!merchantUid) {
      setCapitalShareVouchers([]);
      setLoadingCapital(false);
      return undefined;
    }

    setLoadingCapital(true);

    const unsubCapital = onSnapshot(
      collection(db, "capitalShareVouchers"),
      (snap) => {
        if (!isMountedRef.current) return;

        const merchantEmailLower = String(merchantEmail || "").toLowerCase();
        const mapped = [];

        snap.docs.forEach((docSnap) => {
          const data = docSnap.data() || {};
          const list = Array.isArray(data.vouchers) ? data.vouchers : [];

          list.forEach((voucher, voucherIndex) => {
            const branchId = String(voucher?.branchId || "").trim();
            const branchEmail = String(voucher?.branchEmail || "").toLowerCase();
            const belongsToBranchById = branchId && branchId === merchantUid;
            const belongsToBranchByEmail =
              merchantEmailLower && branchEmail && branchEmail === merchantEmailLower;

            if (!belongsToBranchById && !belongsToBranchByEmail) return;

            mapped.push({
              id: `capital-${docSnap.id}-${voucherIndex}`,
              docId: docSnap.id,
              voucherIndex,
              code: voucher?.voucherCode || data.voucherCode || "",
              description: voucher?.branchName
                ? `${voucher.branchName} Capital Share Voucher`
                : "Capital Share Voucher",
              voucherType: voucher?.voucherType || data.voucherType || "WALK_IN",
              voucherStatus: voucher?.voucherStatus || "ACTIVE",
              branchName: voucher?.branchName || "",
              branchEmail,
              issuedAt: voucher?.voucherIssuedAt || data.voucherIssuedAt || null,
              createdAt: voucher?.createdAt || data.lastUpdatedAt || null,
              redeemedAt: voucher?.redeemedAt || null,
              sourceType: "capitalShare",
            });
          });
        });

        mapped.sort((a, b) => {
          const aMs = a.createdAt?.toDate?.()?.getTime?.() || new Date(a.createdAt || 0).getTime() || 0;
          const bMs = b.createdAt?.toDate?.()?.getTime?.() || new Date(b.createdAt || 0).getTime() || 0;
          return bMs - aMs;
        });

        setCapitalShareVouchers(mapped);
        setLoadingCapital(false);
      },
      (err) => {
        console.error("Capital share vouchers listener error:", err);
        showSnack("error", "Failed to load vouchers");
        setLoadingCapital(false);
      }
    );

    return () => unsubCapital();
  }, [merchantUid, merchantEmail]);

  const extractVoucherCode = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return "";

    if (raw.includes("DAMAYAN_VOUCHER|")) {
      const codeMatch = raw.match(/CODE:([^|\n\r]+)/i);
      return codeMatch?.[1]?.trim()?.toUpperCase() || "";
    }

    if (raw.includes("CODE:")) {
      const codeMatch = raw.match(/CODE:([^|\n\r]+)/i);
      return codeMatch?.[1]?.trim()?.toUpperCase() || "";
    }

    return raw.toUpperCase();
  };

  const findVoucherRecordByCode = async (voucherCode) => {
    const topLevelSnap = await getDocs(
      query(collection(db, "capitalShareVouchers"), where("voucherCode", "==", voucherCode), limit(1))
    );

    if (!topLevelSnap.empty) {
      const docSnap = topLevelSnap.docs[0];
      const data = docSnap.data();
      const vouchersList = Array.isArray(data.vouchers) ? data.vouchers : [];
      const voucherIndex = vouchersList.findIndex(
        (v) => String(v?.voucherCode || "").toUpperCase() === voucherCode
      );
      return { docRef: doc(db, "capitalShareVouchers", docSnap.id), data, voucherIndex };
    }

    const allSnap = await getDocs(collection(db, "capitalShareVouchers"));
    for (const docSnap of allSnap.docs) {
      const data = docSnap.data();
      const vouchersList = Array.isArray(data.vouchers) ? data.vouchers : [];
      const voucherIndex = vouchersList.findIndex(
        (v) => String(v?.voucherCode || "").toUpperCase() === voucherCode
      );
      if (voucherIndex >= 0) {
        return { docRef: doc(db, "capitalShareVouchers", docSnap.id), data, voucherIndex };
      }
    }

    return null;
  };

  const handleRedeemCapitalShareVoucher = async (sourceValue) => {
    const voucherCode = extractVoucherCode(sourceValue);
    if (!voucherCode) {
      showSnack("error", "No voucher code found in QR content.");
      return;
    }

    try {
      setRedeemingVoucher(true);
      setScannerStatus(`Checking voucher ${voucherCode}...`);

      const found = await findVoucherRecordByCode(voucherCode);
      if (!found) {
        setScannerStatus("Voucher not found.");
        showSnack("error", "Voucher not found.");
        return;
      }

      const vouchersList = Array.isArray(found.data.vouchers) ? [...found.data.vouchers] : [];
      const voucherIndex =
        found.voucherIndex >= 0
          ? found.voucherIndex
          : vouchersList.findIndex((v) => String(v?.voucherCode || "").toUpperCase() === voucherCode);

      if (voucherIndex < 0) {
        setScannerStatus("Voucher not found in user record.");
        showSnack("error", "Voucher not found in user record.");
        return;
      }

      const voucher = vouchersList[voucherIndex] || {};
      const voucherStatus = String(voucher.voucherStatus || "ACTIVE").toUpperCase();
      if (voucherStatus !== "ACTIVE") {
        setScannerStatus(`Voucher is already ${voucherStatus}.`);
        showSnack("error", `Voucher is already ${voucherStatus}.`);
        return;
      }

      const branchEmail = String(voucher.branchEmail || "").toLowerCase();
      if (branchEmail && merchantEmail && branchEmail !== merchantEmail) {
        setScannerStatus("This voucher is assigned to another branch.");
        showSnack("error", "This voucher is assigned to another branch.");
        return;
      }

      const redeemedAtIso = new Date().toISOString();
      vouchersList[voucherIndex] = {
        ...voucher,
        voucherStatus: "USED",
        redeemedAt: redeemedAtIso,
        redeemedByMerchantId: merchantUid,
        redeemedByMerchantEmail: merchantEmail || auth.currentUser?.email || "",
      };

      const payload = {
        vouchers: vouchersList,
        lastUpdatedAt: serverTimestamp(),
        lastRedeemedVoucherCode: voucherCode,
        lastRedeemedAt: serverTimestamp(),
        lastRedeemedByMerchantId: merchantUid,
        lastRedeemedByMerchantEmail: merchantEmail || auth.currentUser?.email || "",
      };

      if (String(found.data.voucherCode || "").toUpperCase() === voucherCode) {
        payload.voucherStatus = "USED";
      }

      await updateDoc(found.docRef, payload);

      setScannerStatus(`Voucher ${voucherCode} redeemed successfully.`);
      showSnack("success", `Voucher ${voucherCode} redeemed.`);
      stopQrScanner();
      setScannerDialogOpen(false);
      setScannerInput("");
    } catch (err) {
      console.error("Failed to redeem voucher:", err);
      setScannerStatus("Failed to redeem voucher.");
      showSnack("error", "Failed to redeem voucher.");
    } finally {
      setRedeemingVoucher(false);
    }
  };

  const startQrScanner = async () => {
    if (scannerActive) return;

    try {
      if (!scannerVideoRef.current) {
        setScannerStatus("Scanner is not ready. Please reopen the dialog.");
        return;
      }

      const hasCamera = await QrScanner.hasCamera();
      if (!hasCamera) {
        setScannerSupported(false);
        setScannerStatus("No camera detected. Use manual input below.");
        return;
      }

      const scanner = new QrScanner(
        scannerVideoRef.current,
        async (result) => {
          const rawValue = typeof result === "string" ? result : result?.data || "";
          if (!rawValue) return;
          stopQrScanner();
          await handleRedeemCapitalShareVoucher(rawValue);
        },
        {
          preferredCamera: "environment",
          returnDetailedScanResult: true,
          highlightScanRegion: false,
          highlightCodeOutline: false,
        }
      );

      qrScannerRef.current = scanner;
      await scanner.start();
      setScannerSupported(true);
      setScannerStatus("Point camera to voucher QR code.");
      setScannerActive(true);
    } catch (err) {
      console.error("Failed to start scanner:", err);
      setScannerSupported(false);
      if (isIOS()) {
        setScannerStatus(
          "Camera access denied or not available. Please check your iOS privacy settings or use manual input below."
        );
      } else {
        setScannerStatus("Unable to access camera. Please allow camera permission.");
      }
      setScannerActive(false);
    }
  };

  const getFilteredVouchers = () => {
    let filtered = [...capitalShareVouchers];

    if (filterStatus === "active") {
      filtered = filtered.filter((v) => String(v.voucherStatus || "ACTIVE").toUpperCase() === "ACTIVE");
    } else if (filterStatus === "expired") {
      filtered = filtered.filter((v) => String(v.voucherStatus || "ACTIVE").toUpperCase() !== "ACTIVE");
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (v) =>
          String(v.code || "").toLowerCase().includes(q) ||
          String(v.description || "").toLowerCase().includes(q) ||
          String(v.branchName || "").toLowerCase().includes(q)
      );
    }

    return filtered;
  };

  const filteredVouchers = getFilteredVouchers();

  const pendingRows = useMemo(
    () =>
      capitalShareVouchers
        .filter((v) => String(v.voucherStatus || "ACTIVE").toUpperCase() === "ACTIVE")
        .slice(0, 4),
    [capitalShareVouchers]
  );

  const activeCount = capitalShareVouchers.filter(
    (v) => String(v.voucherStatus || "ACTIVE").toUpperCase() === "ACTIVE"
  ).length;

  const redeemedToday = capitalShareVouchers.filter((v) => {
    const redeemedAt = v.redeemedAt ? new Date(v.redeemedAt) : null;
    if (!redeemedAt || Number.isNaN(redeemedAt.getTime())) return false;
    const now = new Date();
    return (
      redeemedAt.getDate() === now.getDate() &&
      redeemedAt.getMonth() === now.getMonth() &&
      redeemedAt.getFullYear() === now.getFullYear()
    );
  }).length;

  const merchantInitials = (merchantEmail || "M").slice(0, 2).toUpperCase();
  const voucherTone = (voucherType) => {
    const key = String(voucherType || "").toUpperCase();
    if (key.includes("OFW")) {
      return { bg: "rgba(245,158,11,0.18)", text: "#fbbf24", border: "rgba(245,158,11,0.35)" };
    }
    if (key.includes("MEAT")) {
      return { bg: "rgba(244,63,94,0.18)", text: "#fb7185", border: "rgba(244,63,94,0.35)" };
    }
    return { bg: "rgba(16,185,129,0.18)", text: "#6ee7b7", border: "rgba(16,185,129,0.35)" };
  };

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        bgcolor: "#0f172a",
        pb: 12,
        paddingTop: "env(safe-area-inset-top, 0)",
      }}
    >
      <Container
        maxWidth="sm"
        disableGutters
        sx={{
          bgcolor: "#0f172a",
          minHeight: "100dvh",
          color: "#e2e8f0",
          boxShadow: { sm: "0 0 40px rgba(0,0,0,0.45)" },
          px: 2,
        }}
      >
        <Box sx={{ height: 12 }} />

        <Paper
          elevation={0}
          sx={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            bgcolor: "rgba(15, 23, 42, 0.85)",
            backdropFilter: "blur(14px)",
            borderBottom: "1px solid rgba(148, 163, 184, 0.2)",
            px: 0,
            py: 1.5,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
              <IconButton
                onClick={() => navigate(-1)}
                sx={{ width: 38, height: 38, bgcolor: "#1e293b", color: "#cbd5e1" }}
              >
                <MaterialIcon name="arrow_back_ios_new" size={18} />
              </IconButton>

              <Box sx={{ display: "flex", alignItems: "center", gap: 1.1 }}>
                <Box sx={{ position: "relative" }}>
                  <Box
                    sx={{
                      width: 42,
                      height: 42,
                      borderRadius: "999px",
                      bgcolor: "#1e293b",
                      border: "2px solid #0b1220",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                      fontSize: "0.95rem",
                    }}
                  >
                    {merchantInitials}
                  </Box>
                  <Box
                    sx={{
                      position: "absolute",
                      right: 0,
                      bottom: 0,
                      width: 10,
                      height: 10,
                      borderRadius: "999px",
                      bgcolor: "#22c55e",
                      border: "2px solid #0f172a",
                    }}
                  />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: "0.72rem", color: "#94a3b8", lineHeight: 1.1 }}>
                    Welcome back,
                  </Typography>
                  <Typography sx={{ fontSize: "1rem", fontWeight: 800, color: "#f8fafc", lineHeight: 1.15 }}>
                    Merchant Vouchers
                  </Typography>
                </Box>
              </Box>
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <IconButton sx={{ bgcolor: "#1e293b", color: "#cbd5e1", width: 36, height: 36 }}>
                <MaterialIcon name="confirmation_number" size={19} />
              </IconButton>
              <IconButton sx={{ bgcolor: "#1e293b", color: "#cbd5e1", width: 36, height: 36, position: "relative" }}>
                <MaterialIcon name="notifications" size={19} />
                <Box
                  sx={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    width: 7,
                    height: 7,
                    borderRadius: "999px",
                    bgcolor: "#ef4444",
                    border: "1.5px solid #0f172a",
                  }}
                />
              </IconButton>
              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  setScannerDialogOpen(true);
                  setScannerStatus("");
                  setScannerInput("");
                }}
                sx={{
                  borderColor: "#34d399",
                  color: "#6ee7b7",
                  textTransform: "none",
                  borderRadius: "10px",
                }}
              >
                <MaterialIcon name="qr_code_scanner" size={18} sx={{ marginRight: 4 }} />
                Scan
              </Button>
            </Box>
          </Box>
        </Paper>

        <Card
          sx={{
            mt: 2,
            borderRadius: "22px",
            p: 2.2,
            background: "linear-gradient(145deg, #1e293b 0%, #020617 100%)",
            border: "1px solid rgba(255,255,255,0.08)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              position: "absolute",
              top: -40,
              right: -35,
              width: 140,
              height: 140,
              borderRadius: "999px",
              bgcolor: "rgba(16, 185, 129, 0.16)",
              filter: "blur(24px)",
            }}
          />
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.25, position: "relative" }}>
            <Box
              sx={{
                width: 58,
                height: 58,
                borderRadius: "16px",
                bgcolor: "rgba(16,185,129,0.12)",
                border: "1px solid rgba(16,185,129,0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialIcon name="qr_code_scanner" size={30} sx={{ color: "#34d399" }} />
            </Box>
            <Typography sx={{ fontSize: "1.08rem", fontWeight: 800, color: "#f8fafc" }}>
              Voucher Scanner
            </Typography>
            <Typography sx={{ fontSize: "0.82rem", color: "#94a3b8", textAlign: "center", maxWidth: 300 }}>
              Point your camera at the customer QR to quickly process redemption.
            </Typography>
            <Button
              fullWidth
              variant="contained"
              onClick={() => {
                setScannerDialogOpen(true);
                setScannerStatus("");
                setScannerInput("");
              }}
              sx={{
                mt: 1,
                py: 1.2,
                borderRadius: "14px",
                textTransform: "none",
                fontWeight: 700,
                bgcolor: "#10b981",
                "&:hover": { bgcolor: "#059669" },
              }}
            >
              <MaterialIcon name="videocam" size={18} sx={{ marginRight: 6 }} />
              Open QR Scanner
            </Button>
          </Box>
        </Card>

        <Box sx={{ mt: 3, mb: 1.25, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography sx={{ fontSize: "1rem", fontWeight: 800, color: "#f8fafc" }}>
            Pending Redemptions
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Chip
              size="small"
              label={`${activeCount} waiting`}
              sx={{
                bgcolor: "rgba(245,158,11,0.14)",
                color: "#fbbf24",
                border: "1px solid rgba(245,158,11,0.3)",
                textTransform: "uppercase",
                fontWeight: 700,
                letterSpacing: 0.3,
              }}
            />
            <Button size="small" sx={{ textTransform: "none", color: "#34d399", fontWeight: 700 }}>
              See All
            </Button>
          </Box>
        </Box>

        <Stack spacing={1.15}>
          {pendingRows.length === 0 ? (
            <Card sx={{ bgcolor: "rgba(30,41,59,0.45)", border: "1px solid rgba(148,163,184,0.2)", borderRadius: "14px" }}>
              <CardContent sx={{ py: 2 }}>
                <Typography sx={{ color: "#94a3b8", textAlign: "center" }}>No pending redemptions.</Typography>
              </CardContent>
            </Card>
          ) : (
            pendingRows.map((voucher) => (
              <Card
                key={`pending-${voucher.id}`}
                sx={{
                  bgcolor: "rgba(30,41,59,0.5)",
                  border: "1px solid rgba(148,163,184,0.2)",
                  borderRadius: "14px",
                }}
              >
                <CardContent sx={{ py: 1.4, px: 1.6 }}>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.2 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.2, minWidth: 0 }}>
                      <Box
                        sx={{
                          width: 42,
                          height: 42,
                          borderRadius: "999px",
                          bgcolor: "#334155",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          color: "#e2e8f0",
                          flexShrink: 0,
                        }}
                      >
                        {String(voucher.code || "V").slice(0, 2).toUpperCase()}
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ color: "#f1f5f9", fontWeight: 700 }} noWrap>
                          {voucher.branchName || "Member Voucher"}
                        </Typography>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.25 }}>
                          <Chip
                            size="small"
                            label={voucher.voucherType || "WALK_IN"}
                            title={voucher.voucherType || "WALK_IN"}
                            sx={{
                              height: 20,
                              bgcolor: voucherTone(voucher.voucherType).bg,
                              color: voucherTone(voucher.voucherType).text,
                              border: `1px solid ${voucherTone(voucher.voucherType).border}`,
                              fontSize: "0.65rem",
                              fontWeight: 700,
                            }}
                          />
                          <Typography sx={{ fontSize: "0.72rem", color: "#94a3b8" }} noWrap>
                            {voucher.issuedAt
                              ? `${new Date(voucher.issuedAt?.toDate?.() || voucher.issuedAt).toLocaleDateString()}`
                              : "Ready to redeem"}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>

                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => {
                        setScannerDialogOpen(true);
                        setScannerInput(voucher.code || "");
                        setScannerStatus("Voucher loaded. Tap Redeem to confirm.");
                      }}
                      sx={{
                        textTransform: "none",
                        borderRadius: "10px",
                        fontWeight: 700,
                        bgcolor: "#f8fafc",
                        color: "#0f172a",
                        minWidth: 90,
                        fontSize: "0.72rem",
                        "&:hover": { bgcolor: "#e2e8f0" },
                      }}
                    >
                      <MaterialIcon name="qr_code" size={16} sx={{ marginRight: 4 }} />
                      Scan QR
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            ))
          )}
        </Stack>

        <Box sx={{ mt: 2.5, mb: 1.5 }}>
          <TextField
            fullWidth
            placeholder="Search vouchers..."
            size="small"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <Box sx={{ mr: 1, display: "flex", alignItems: "center" }}>
                  <MaterialIcon name="search" size={18} sx={{ color: "#94a3b8" }} />
                </Box>
              ),
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                bgcolor: "rgba(30,41,59,0.7)",
                color: "#e2e8f0",
                "& fieldset": { borderColor: "#334155" },
                "&:hover fieldset": { borderColor: "#475569" },
                "&.Mui-focused fieldset": { borderColor: "#10b981" },
              },
            }}
          />

          <Box sx={{ display: "flex", gap: 1, overflowX: "auto", mt: 1.2 }}>
            {["all", "active", "expired"].map((status) => (
              <Chip
                key={status}
                label={status.charAt(0).toUpperCase() + status.slice(1)}
                onClick={() => setFilterStatus(status)}
                variant={filterStatus === status ? "filled" : "outlined"}
                sx={{
                  bgcolor: filterStatus === status ? "#10b981" : "transparent",
                  color: filterStatus === status ? "white" : "#94a3b8",
                  borderColor: filterStatus === status ? "#10b981" : "#334155",
                  flexShrink: 0,
                }}
              />
            ))}
          </Box>
        </Box>

        <Stack spacing={1.2} sx={{ pb: 1.5 }}>
          {loadingCapital ? (
            <Typography sx={{ textAlign: "center", py: 3, color: "#94a3b8" }}>Loading vouchers...</Typography>
          ) : filteredVouchers.length === 0 ? (
            <Card sx={{ bgcolor: "rgba(30,41,59,0.4)", border: "2px dashed #334155", borderRadius: "12px", p: 2.5, textAlign: "center" }}>
              <MaterialIcon name="card_giftcard" size={44} sx={{ color: "#64748b", marginBottom: 8 }} />
              <Typography sx={{ color: "#94a3b8", fontWeight: 500 }}>
                {searchQuery ? "No matching vouchers found" : "No vouchers yet"}
              </Typography>
            </Card>
          ) : (
            filteredVouchers.map((voucher) => {
              const expired = String(voucher.voucherStatus || "ACTIVE").toUpperCase() !== "ACTIVE";
              return (
                <Card
                  key={voucher.id}
                  sx={{
                    border: "1px solid rgba(148,163,184,0.2)",
                    borderRadius: "16px",
                    overflow: "hidden",
                    opacity: expired ? 0.62 : 1,
                    bgcolor: "rgba(30,41,59,0.55)",
                  }}
                >
                  <CardContent sx={{ p: 2 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                      <Box>
                        <Typography sx={{ fontWeight: 700, fontSize: "1.06rem", color: "#f8fafc" }}>
                          {voucher.code}
                        </Typography>
                        <Typography sx={{ fontSize: "0.86rem", color: "#94a3b8", mt: 0.4 }}>
                          {voucher.description}
                        </Typography>
                        {voucher.branchName ? (
                          <Typography sx={{ fontSize: "0.74rem", color: "#cbd5e1", mt: 0.45 }}>
                            Branch: {voucher.branchName}
                          </Typography>
                        ) : null}
                      </Box>

                      <Chip
                        label={String(voucher.voucherStatus || "ACTIVE").toUpperCase()}
                        size="small"
                        sx={{
                          bgcolor: expired ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)",
                          color: expired ? "#fca5a5" : "#6ee7b7",
                        }}
                      />
                    </Box>

                    <Divider sx={{ my: 1.4 }} />

                    <Stack spacing={1} sx={{ mb: 1.4 }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
                        <Typography sx={{ color: "#94a3b8" }}>Type:</Typography>
                        <Typography sx={{ fontWeight: 700, color: "#f8fafc" }}>{voucher.voucherType || "WALK_IN"}</Typography>
                      </Box>
                      <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
                        <Typography sx={{ color: "#94a3b8" }}>Redemption:</Typography>
                        <Typography sx={{ fontWeight: 700, color: "#f8fafc" }}>
                          {String(voucher.voucherStatus || "ACTIVE").toUpperCase() === "ACTIVE"
                            ? "Not yet redeemed"
                            : "Redeemed"}
                        </Typography>
                      </Box>
                      {voucher.issuedAt && (
                        <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
                          <Typography sx={{ color: "#94a3b8" }}>Issued:</Typography>
                          <Typography sx={{ fontWeight: 700, color: "#f8fafc" }}>
                            {(() => {
                              const asDate = voucher.issuedAt?.toDate?.() || new Date(voucher.issuedAt);
                              return Number.isNaN(asDate.getTime()) ? "N/A" : asDate.toLocaleDateString();
                            })()}
                          </Typography>
                        </Box>
                      )}
                    </Stack>

                    <Divider sx={{ my: 1.4 }} />

                    <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => {
                          setScannerDialogOpen(true);
                          setScannerInput(voucher.code || "");
                          setScannerStatus("Voucher loaded. Tap Redeem to confirm.");
                        }}
                        disabled={String(voucher.voucherStatus || "ACTIVE").toUpperCase() !== "ACTIVE"}
                      >
                        Redeem
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              );
            })
          )}
        </Stack>
      </Container>

      <Container maxWidth="sm" disableGutters sx={{ px: 2, pb: 11, mt: 0.5 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.2 }}>
          <Card sx={{ bgcolor: "rgba(30,41,59,0.45)", border: "1px solid rgba(148,163,184,0.2)", borderRadius: "14px" }}>
            <CardContent sx={{ p: 1.75 }}>
              <Typography sx={{ fontSize: "0.74rem", color: "#94a3b8", fontWeight: 600 }}>Redeemed Today</Typography>
              <Typography sx={{ fontSize: "1.4rem", color: "#34d399", fontWeight: 900 }}>{redeemedToday}</Typography>
            </CardContent>
          </Card>

          <Card sx={{ bgcolor: "rgba(30,41,59,0.45)", border: "1px solid rgba(148,163,184,0.2)", borderRadius: "14px" }}>
            <CardContent sx={{ p: 1.75 }}>
              <Typography sx={{ fontSize: "0.74rem", color: "#94a3b8", fontWeight: 600 }}>Active Vouchers</Typography>
              <Typography sx={{ fontSize: "1.4rem", color: "#fbbf24", fontWeight: 900 }}>{activeCount}</Typography>
            </CardContent>
          </Card>
        </Box>
      </Container>

      <Dialog
        open={scannerDialogOpen}
        onClose={() => {
          stopQrScanner();
          setScannerDialogOpen(false);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Redeem Voucher (QR Scan)</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 2 }}>
          {scannerSupported ? (
            <Box
              sx={{
                width: "100%",
                aspectRatio: "4/3",
                bgcolor: "#0f172a",
                borderRadius: 2,
                overflow: "hidden",
                position: "relative",
              }}
            >
              <video
                ref={scannerVideoRef}
                autoPlay
                playsInline
                muted
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
              {!scannerActive && (
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#cbd5e1",
                    fontSize: "0.85rem",
                    textAlign: "center",
                    p: 2,
                  }}
                >
                  Camera is off. Tap Start Camera to scan QR.
                </Box>
              )}
            </Box>
          ) : (
            <Box
              sx={{
                width: "100%",
                bgcolor: "rgba(59, 130, 246, 0.1)",
                border: "1px solid rgba(59, 130, 246, 0.3)",
                borderRadius: 2,
                p: 2.5,
                textAlign: "center",
              }}
            >
              <MaterialIcon 
                name={isIOS() ? "info" : "videocam_off"} 
                size={32} 
                sx={{ color: "#3b82f6", mb: 1 }} 
              />
              <Typography sx={{ fontWeight: 700, color: "#3b82f6", mb: 0.5, fontSize: "1rem" }}>
                {isIOS() ? "Camera Scanning Not Available" : "Scanner Not Supported"}
              </Typography>
              <Typography sx={{ color: "#64748b", fontSize: "0.9rem", lineHeight: 1.5 }}>
                {isIOS()
                  ? "iOS doesn't support automatic QR scanning. Please use the manual input below to enter your voucher code."
                  : "Your browser doesn't support QR scanning. Please use the manual input below instead."}
              </Typography>
            </Box>
          )}

          <Box sx={{ py: 1 }}>
            <Typography sx={{ fontSize: "0.85rem", fontWeight: 600, color: "#94a3b8", mb: 1 }}>
              {scannerSupported && scannerActive ? "Or paste code here:" : "Enter Voucher Code"}
            </Typography>
            <TextField
              label={scannerSupported ? "QR payload or Code" : "Voucher Code"}
              placeholder={
                isIOS()
                  ? "Paste the code from your voucher QR"
                  : "Paste DAMAYAN_VOUCHER payload or code"
              }
              value={scannerInput}
              onChange={(e) => setScannerInput(e.target.value)}
              fullWidth
              size="small"
              autoFocus={!scannerSupported}
              sx={{
                "& .MuiOutlinedInput-root": {
                  bgcolor: "rgba(30,41,59,0.7)",
                  color: "#e2e8f0",
                },
              }}
            />
          </Box>

          {scannerStatus ? (
            <Alert severity="info" variant="outlined">
              {scannerStatus}
            </Alert>
          ) : null}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          {scannerSupported && (
            <Button
              onClick={async () => {
                if (scannerActive) {
                  stopQrScanner();
                } else {
                  await startQrScanner();
                }
              }}
              sx={{ textTransform: "none" }}
            >
              {scannerActive ? "Stop Camera" : "Start Camera"}
            </Button>
          )}
          <Button
            onClick={() => handleRedeemCapitalShareVoucher(scannerInput)}
            variant="contained"
            disabled={redeemingVoucher || !scannerInput.trim()}
            sx={{
              bgcolor: "#10b981",
              "&:hover": { bgcolor: "#059669" },
              textTransform: "none",
              fontWeight: 700,
            }}
          >
            {redeemingVoucher ? <CircularProgress size={18} sx={{ color: "white" }} /> : "Redeem"}
          </Button>
          <Button
            onClick={() => {
              stopQrScanner();
              setScannerDialogOpen(false);
            }}
            sx={{ textTransform: "none" }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snack.open}
        autoHideDuration={3500}
        onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snack.severity} variant="filled">
          {snack.message}
        </Alert>
      </Snackbar>

      <MerchantBottomNav activePath="/vouchers" />
    </Box>
  );
};

export default MerchantVouchers;
