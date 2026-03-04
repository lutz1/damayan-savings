import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Avatar,
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
  IconButton,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import jsQR from "jsqr";
import { db } from "../../firebase";

const MaterialIcon = ({ name, filled = false, weight = 400, size = 24, sx = {} }) => (
  <span
    className="material-symbols-outlined"
    style={{
      fontSize: size,
      fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${weight}`,
      ...sx,
    }}
  >
    {name}
  </span>
);

const parseVoucherCode = (value = "") => {
  const raw = String(value).trim();
  if (!raw) return "";

  if (raw.includes("DAMAYAN_VOUCHER|")) {
    const parts = raw.split("|");
    const codePart = parts.find((item) => item.startsWith("CODE:"));
    return codePart ? codePart.replace("CODE:", "").trim() : "";
  }

  return raw;
};

const MerchantVouchers = () => {
  const navigate = useNavigate();
  const merchantId = localStorage.getItem("uid") || "";

  const [merchantName, setMerchantName] = useState("Merchant");
  const [merchantEmail, setMerchantEmail] = useState("");
  const [activeVouchers, setActiveVouchers] = useState([]);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [scannerError, setScannerError] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [snack, setSnack] = useState({ open: false, severity: "info", message: "" });

  const videoRef = useRef(null);
  const scannerIntervalRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const scanningFrameRef = useRef(false);
  const lastScannedRef = useRef({ code: "", ts: 0 });

  const supportsBarcodeDetector = useMemo(
    () => typeof window !== "undefined" && "BarcodeDetector" in window,
    []
  );

  const isVoucherForMerchant = (voucher) => {
    const branchId = String(voucher?.branchId || "");
    const branchEmail = String(voucher?.branchEmail || "").trim().toLowerCase();
    const ownEmail = String(merchantEmail || "").trim().toLowerCase();

    if (branchId && branchId === merchantId) return true;
    if (branchEmail && ownEmail && branchEmail === ownEmail) return true;
    return false;
  };

  useEffect(() => {
    if (!merchantId) return undefined;

    const unsubProfile = onSnapshot(
      doc(db, "users", merchantId),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() || {};
        setMerchantName(data.name || data.storeName || "Merchant");
        setMerchantEmail(data.email || "");
      },
      (error) => {
        console.error("Failed loading merchant profile:", error);
      }
    );

    return () => unsubProfile();
  }, [merchantId]);

  useEffect(() => {
    if (!merchantId) return undefined;

    const unsubVouchers = onSnapshot(
      query(collection(db, "capitalShareVouchers"), where("voucherStatus", "==", "ACTIVE")),
      (snap) => {
        const vouchers = snap.docs
          .map((item) => ({ id: item.id, ...item.data() }))
          .filter((item) => isVoucherForMerchant(item));

        setActiveVouchers(vouchers);
      },
      (error) => {
        console.error("Failed loading vouchers:", error);
        setSnack({ open: true, severity: "error", message: "Unable to load vouchers." });
      }
    );

    return () => unsubVouchers();
  }, [merchantId, merchantEmail]);

  const closeScanner = () => {
    if (scannerIntervalRef.current) {
      clearInterval(scannerIntervalRef.current);
      scannerIntervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    detectorRef.current = null;
    scanningFrameRef.current = false;
    setScannerOpen(false);
  };

  const redeemVoucherCode = async (rawValue) => {
    if (redeeming) return;

    const voucherCode = parseVoucherCode(rawValue);
    if (!voucherCode) {
      setSnack({ open: true, severity: "error", message: "Invalid QR code content." });
      return;
    }

    try {
      setRedeeming(true);

      const voucherQuery = query(
        collection(db, "capitalShareVouchers"),
        where("voucherCode", "==", voucherCode),
        limit(1)
      );
      const voucherSnap = await getDocs(voucherQuery);

      if (voucherSnap.empty) {
        setSnack({ open: true, severity: "error", message: "Voucher not found." });
        return;
      }

      const targetDoc = voucherSnap.docs[0];
      const targetData = targetDoc.data() || {};

      if (targetData.voucherStatus !== "ACTIVE") {
        setSnack({ open: true, severity: "warning", message: "Voucher already redeemed or inactive." });
        return;
      }

      if (targetData.voucherType === "WALK_IN" && !isVoucherForMerchant(targetData)) {
        setSnack({ open: true, severity: "error", message: "This voucher is assigned to a different branch." });
        return;
      }

      await updateDoc(doc(db, "capitalShareVouchers", targetDoc.id), {
        voucherStatus: "REDEEMED",
        redeemedAt: serverTimestamp(),
        redeemedByMerchantId: merchantId,
        redeemedByMerchantName: merchantName || "Merchant",
        redeemedByMerchantEmail: merchantEmail || "",
        updatedAt: serverTimestamp(),
      });

      setSnack({ open: true, severity: "success", message: `Voucher redeemed: ${voucherCode}` });
      setManualCode("");
      closeScanner();
    } catch (error) {
      console.error("Voucher redemption failed:", error);
      setSnack({ open: true, severity: "error", message: "Voucher redemption failed." });
    } finally {
      setRedeeming(false);
    }
  };

  useEffect(() => {
    if (!scannerOpen) return undefined;

    const startScanner = async () => {
      setScannerError("");

      if (!navigator.mediaDevices?.getUserMedia) {
        setScannerError("Camera not available. Please use manual code input below. (Note: iOS requires HTTPS)");
        return;
      }

      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });

        streamRef.current = mediaStream;

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          await videoRef.current.play();
        }

        if (supportsBarcodeDetector) {
          detectorRef.current = new window.BarcodeDetector({ formats: ["qr_code"] });
        } else {
          detectorRef.current = null;
        }

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d", { willReadFrequently: true });

        scannerIntervalRef.current = setInterval(async () => {
          if (
            !videoRef.current ||
            scanningFrameRef.current ||
            redeeming
          ) {
            return;
          }

          if (videoRef.current.readyState < 2) {
            return;
          }

          scanningFrameRef.current = true;
          try {
            let raw = "";

            if (detectorRef.current) {
              const found = await detectorRef.current.detect(videoRef.current);
              if (found?.length) {
                raw = String(found[0].rawValue || "").trim();
              }
            } else if (context) {
              const width = videoRef.current.videoWidth;
              const height = videoRef.current.videoHeight;

              if (width > 0 && height > 0) {
                canvas.width = width;
                canvas.height = height;
                context.drawImage(videoRef.current, 0, 0, width, height);
                const imageData = context.getImageData(0, 0, width, height);
                const qrResult = jsQR(imageData.data, width, height, {
                  inversionAttempts: "dontInvert",
                });
                raw = String(qrResult?.data || "").trim();
              }
            }

            if (raw) {
              const now = Date.now();
              const recent = lastScannedRef.current;
              if (recent.code === raw && now - recent.ts < 2500) return;

              lastScannedRef.current = { code: raw, ts: now };
              await redeemVoucherCode(raw);
            }
          } catch (scanError) {
            console.error("Scanner detect error:", scanError);
          } finally {
            scanningFrameRef.current = false;
          }
        }, 420);
      } catch (error) {
        console.error("Failed to start camera scanner:", error);
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const msg = isIOS 
          ? "Camera access denied or needs HTTPS. Please enable camera in Settings → Privacy → Camera and use HTTPS. Use manual code input below."
          : "Camera access denied. Please allow camera permission or use manual code input below.";
        setScannerError(msg);
      }
    };

    startScanner();

    return () => {
      if (scannerIntervalRef.current) {
        clearInterval(scannerIntervalRef.current);
        scannerIntervalRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      detectorRef.current = null;
      scanningFrameRef.current = false;
    };
  }, [scannerOpen, redeeming, supportsBarcodeDetector]);

  const waitingCount = activeVouchers.length;

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        bgcolor: "#0f172a",
        display: "flex",
        justifyContent: "center",
        pb: 12,
        paddingTop: 'env(safe-area-inset-top, 0)',
        paddingLeft: 'env(safe-area-inset-left, 0)',
        paddingRight: 'env(safe-area-inset-right, 0)',
      }}
    >
      <Container
        maxWidth="sm"
        disableGutters
        sx={{
          minHeight: "100dvh",
          color: "white",
          bgcolor: "#0f172a",
          boxShadow: { sm: "0 0 40px rgba(0,0,0,0.35)" },
        }}
      >
        <Paper
          elevation={0}
          sx={{
            position: "sticky",
            top: 0,
            zIndex: 20,
            px: 2,
            py: 1.5,
            borderBottom: "1px solid rgba(148,163,184,0.2)",
            bgcolor: "rgba(15,23,42,0.82)",
            backdropFilter: "blur(18px)",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Avatar sx={{ width: 40, height: 40, bgcolor: "#334155", color: "#cbd5e1" }}>
                {(merchantName || "M").slice(0, 2).toUpperCase()}
              </Avatar>
              <Box>
                <Typography sx={{ color: "#94a3b8", fontSize: "0.75rem", fontWeight: 500 }}>
                  Voucher Redemption
                </Typography>
                <Typography sx={{ color: "white", fontWeight: 700, fontSize: "1rem" }}>
                  {merchantName || "Merchant"}
                </Typography>
              </Box>
            </Box>
            <IconButton
              onClick={() => navigate("/merchant/dashboard")}
              sx={{
                width: 40,
                height: 40,
                bgcolor: "#1e293b",
                "&:hover": { bgcolor: "#334155" },
              }}
            >
              <MaterialIcon name="arrow_back" size={20} sx={{ color: "#cbd5e1" }} />
            </IconButton>
          </Box>
        </Paper>

        <Box sx={{ px: 2, py: 2.5, pb: 14 }}>
          <Card
            sx={{
              p: 0,
              borderRadius: 4,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "linear-gradient(135deg, rgba(30,41,59,0.9), rgba(2,6,23,0.95))",
              boxShadow: "0 20px 40px rgba(0,0,0,0.32)",
              mb: 3,
            }}
          >
            <CardContent sx={{ p: 2.5 }}>
              <Box sx={{ textAlign: "center", mb: 2.5 }}>
                <Box
                  sx={{
                    width: 64,
                    height: 64,
                    borderRadius: 3,
                    mx: "auto",
                    mb: 1.5,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: "rgba(16,185,129,0.12)",
                    border: "1px solid rgba(16,185,129,0.35)",
                  }}
                >
                  <MaterialIcon name="qr_code_scanner" size={34} sx={{ color: "#10b981" }} />
                </Box>
                <Typography sx={{ fontSize: "1.15rem", fontWeight: 800, color: "white" }}>
                  Voucher Scanner
                </Typography>
                <Typography sx={{ color: "#94a3b8", fontSize: "0.84rem", mt: 0.5 }}>
                  Scan customer QR and redeem voucher instantly.
                </Typography>
              </Box>

              <Button
                fullWidth
                onClick={() => setScannerOpen(true)}
                sx={{
                  py: 1.35,
                  borderRadius: 2.5,
                  textTransform: "none",
                  fontWeight: 700,
                  color: "white",
                  bgcolor: "#10b981",
                  "&:hover": { bgcolor: "#059669" },
                }}
                startIcon={<MaterialIcon name="videocam" size={18} sx={{ color: "white" }} />}
              >
                Open QR Scanner
              </Button>
            </CardContent>
          </Card>

          <Box sx={{ mb: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Typography sx={{ fontSize: "1.05rem", fontWeight: 700, color: "white" }}>
              Pending Redemptions
            </Typography>
            <Chip
              label={`${waitingCount} Waiting`}
              size="small"
              sx={{
                fontWeight: 700,
                bgcolor: "rgba(245,158,11,0.12)",
                color: "#f59e0b",
                border: "1px solid rgba(245,158,11,0.3)",
              }}
            />
          </Box>

          <Stack spacing={1.2}>
            {activeVouchers.length === 0 ? (
              <Paper
                sx={{
                  p: 3,
                  textAlign: "center",
                  bgcolor: "rgba(30,41,59,0.45)",
                  border: "1px solid rgba(148,163,184,0.2)",
                  borderRadius: 2.5,
                }}
              >
                <Typography sx={{ color: "#94a3b8" }}>No pending vouchers for your branch.</Typography>
              </Paper>
            ) : (
              activeVouchers.map((voucher) => (
                <Paper
                  key={voucher.id}
                  sx={{
                    p: 1.6,
                    borderRadius: 2.5,
                    bgcolor: "rgba(30,41,59,0.5)",
                    border: "1px solid rgba(148,163,184,0.22)",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5 }}>
                    <Box>
                      <Typography sx={{ color: "#f8fafc", fontWeight: 700, fontSize: "0.95rem" }}>
                        {voucher.branchName || "Branch Voucher"}
                      </Typography>
                      <Typography sx={{ color: "#cbd5e1", fontSize: "0.74rem", mt: 0.4 }}>
                        {voucher.voucherCode || "No code"}
                      </Typography>
                      <Typography sx={{ color: "#94a3b8", fontSize: "0.68rem", mt: 0.3 }}>
                        {voucher.voucherType === "OFW" ? "OFW" : "Walk-In"}
                      </Typography>
                    </Box>

                    <Button
                      onClick={() => {
                        setManualCode(voucher.voucherCode || "");
                        setScannerOpen(true);
                      }}
                      sx={{
                        height: 38,
                        px: 1.7,
                        borderRadius: 2,
                        textTransform: "none",
                        fontWeight: 700,
                        bgcolor: "white",
                        color: "#0f172a",
                        minWidth: "fit-content",
                        "&:hover": { bgcolor: "#e2e8f0" },
                      }}
                      startIcon={<MaterialIcon name="qr_code" size={16} sx={{ color: "#0f172a" }} />}
                    >
                      Scan QR
                    </Button>
                  </Box>
                </Paper>
              ))
            )}
          </Stack>
        </Box>

        <Dialog
          open={scannerOpen}
          onClose={closeScanner}
          fullWidth
          maxWidth="xs"
          PaperProps={{
            sx: {
              borderRadius: 3,
              bgcolor: "#0f172a",
              color: "white",
              border: "1px solid rgba(148,163,184,0.25)",
            },
          }}
        >
          <DialogTitle sx={{ fontWeight: 700 }}>Scan Voucher QR</DialogTitle>
          <DialogContent>
            {scannerError ? (
              <Alert sx={{ mb: 2 }} severity="warning">
                {scannerError}
              </Alert>
            ) : null}

            <Box
              sx={{
                position: "relative",
                borderRadius: 2.5,
                overflow: "hidden",
                border: "1px solid rgba(148,163,184,0.3)",
                bgcolor: "black",
                minHeight: 200,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                style={{ width: "100%", height: 240, objectFit: "cover" }}
              />
            </Box>

            <Typography sx={{ mt: 2.5, color: "#94a3b8", fontSize: "0.78rem", mb: 0.8, fontWeight: 600 }}>
              Or manually enter voucher code
            </Typography>
            <TextField
              fullWidth
              size="small"
              placeholder="Paste QR content or voucher code"
              value={manualCode}
              onChange={(event) => setManualCode(event.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter" && manualCode.trim()) {
                  redeemVoucherCode(manualCode);
                }
              }}
              InputProps={{
                sx: {
                  color: "white",
                  bgcolor: "rgba(30,41,59,0.55)",
                  borderRadius: 2,
                },
              }}
            />
          </DialogContent>
          <DialogActions sx={{ px: 2, pb: 2 }}>
            <Button onClick={closeScanner} sx={{ color: "#cbd5e1", textTransform: "none", fontWeight: 700 }}>
              Cancel
            </Button>
            <Button
              onClick={() => redeemVoucherCode(manualCode)}
              disabled={redeeming || !manualCode.trim()}
              variant="contained"
              sx={{ textTransform: "none", fontWeight: 700, bgcolor: "#10b981", "&:hover": { bgcolor: "#059669" } }}
            >
              Redeem Now
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar
          open={snack.open}
          autoHideDuration={3000}
          onClose={() => setSnack((prev) => ({ ...prev, open: false }))}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert severity={snack.severity} variant="filled">
            {snack.message}
          </Alert>
        </Snackbar>
      </Container>
    </Box>
  );
};

export default MerchantVouchers;
