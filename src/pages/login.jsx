import React, { useState, useEffect, useRef } from "react";
import "./login.css";
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  CircularProgress,
  Alert,
  Container,
  Divider,
  InputAdornment,
  IconButton,
  Drawer,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
} from "@mui/material";
import { motion } from "framer-motion";
import { signInWithEmailAndPassword, signInWithCustomToken, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import {
  Visibility,
  VisibilityOff,
  Mail,
  Lock,
  ArrowForward,
  ArrowBack,
  DirectionsBike,
  Store,
  ExpandMore,
  Search,
  ManageAccounts,
  SupportAgent,
  InfoOutlined,
  WarningAmber,
  FactCheck,
  ShieldOutlined,
  PrivacyTip,
  Policy,
  LockReset,
  VerifiedUser,
  Info,
} from "@mui/icons-material";
import newlogo from "../assets/newlogo.png";
import merchantLogo from "../assets/merchantlogo.png";
import Splashscreen from "../components/splashscreen";

const CLOUD_FUNCTIONS_BASE =
  (import.meta.env.VITE_CLOUD_FUNCTIONS_BASE_URL ||
    "https://us-central1-amayan-savings.cloudfunctions.net").replace(/\/$/, "");

const PRIVACY_POLICY_TEXT = `Privacy Policy

BOWNERS System

1. Introduction

BOWNERS ("we", "our", or "us") is a private, membership-based system used by registered users across multiple countries. We are committed to protecting the privacy and security of our members' information.

By registering for and using the BOWNERS system, you agree to the collection and use of information in accordance with this Privacy Policy.

2. Scope of This Policy

This Privacy Policy applies only to registered members of the BOWNERS system. The platform is not intended for public or anonymous use.

3. Information We Collect
3.1 Personal Information

We collect only the information necessary to provide access to the system, including:

Full name
Email address
Contact details
Account login credentials

3.2 System Usage Data

To maintain system performance and security, we may collect:

Login activity and timestamps
IP address
Device and browser information
System interaction logs

3.3 Member Data

Any data, files, or content entered or uploaded by members within the system.

4. Purpose of Data Collection

We collect and use your information solely to:

Provide secure access to the system
Manage member accounts
Maintain and improve system functionality
Monitor usage for security and performance
Communicate important system updates or support messages
Comply with applicable legal obligations

5. Legal Basis and International Use

As BOWNERS is used by members from different countries, we follow general data protection principles aligned with the General Data Protection Regulation.

We only collect data that is necessary and process it fairly, securely, and transparently.

6. Data Sharing and Disclosure

We respect your privacy and do not sell or trade your personal information.

Your data may only be shared:

With authorized system administrators or personnel
When required by law or legal process
To protect system security, rights, or users

7. Data Security

We implement appropriate technical and organizational measures to protect your data from unauthorized access, loss, misuse, or alteration.

Access to data is restricted to authorized individuals only.

8. Data Retention

We retain member data only for as long as necessary to:

Maintain active accounts
Fulfill operational and legal requirements
Ensure system integrity and security

Data may be deleted upon account termination or user request, subject to system and legal limitations.

9. Member Rights

As a BOWNERS member, you have the right to:

Request access to your personal data
Request correction of inaccurate information
Request deletion of your account and associated data

Requests may be subject to identity verification and system constraints.

10. Private System Use

BOWNERS is a restricted-access platform. Only registered members can access the system, and all data is used strictly for internal system purposes.

11. Changes to This Policy

We may update this Privacy Policy from time to time. Updates will be reflected with a revised effective date. Continued use of the system constitutes acceptance of any changes.

12. Contact

For any questions, concerns, or data requests, please contact your system administrator or support team.`;

const TERMS_OF_USE_TEXT = `Terms of Use

BOWNERS System

1. Acceptance of Terms

By registering for and using the BOWNERS system ("the System"), you agree to comply with and be bound by these Terms of Use. If you do not agree, you must not use the System.

2. Nature of the System

BOWNERS is a private, membership-based platform intended only for authorized and registered users. Access is restricted and granted upon approval or registration.

3. User Responsibilities

As a member, you agree to:

Provide accurate and complete registration information
Maintain the confidentiality of your login credentials
Be responsible for all activities under your account
Use the system only for its intended and lawful purposes

You must not:

Attempt to gain unauthorized access to the system
Interfere with system security or performance
Upload or distribute harmful, illegal, or malicious content
Use the system in a way that could damage or disrupt operations

4. Account Management

You are responsible for safeguarding your account
You must notify the administrator of any unauthorized use
We reserve the right to suspend or terminate accounts that violate these Terms

5. Data and Content

You retain responsibility for any data you upload or manage within the system
You must ensure that your content does not violate any laws or third-party rights
We reserve the right to remove content that violates these Terms

6. System Availability

We aim to provide reliable access to the system; however, we do not guarantee uninterrupted availability. The system may be temporarily unavailable due to maintenance, updates, or unforeseen issues.

7. Security

We take reasonable measures to protect the system and user data. However, users are responsible for maintaining the security of their accounts and devices.

8. Limitation of Liability

To the fullest extent permitted by law, BOWNERS and its administrators shall not be liable for:

Any data loss, corruption, or unauthorized access
System downtime or interruptions
Any damages resulting from misuse of the system

9. Termination of Access

We reserve the right to suspend or terminate access to the system at any time if:

These Terms are violated
There is suspected misuse or security risk
Required by law or administrative decision

10. Changes to Terms

We may update these Terms of Use at any time. Continued use of the system after changes are made constitutes acceptance of the updated Terms.

11. Governing Principles

These Terms are governed by applicable laws and general principles of fairness, security, and responsible system use across jurisdictions.

12. Contact

For questions regarding these Terms, please contact your system administrator or support team.`;

const HELP_CENTER_TEXT = `Help Center

BOWNERS System

Welcome to the BOWNERS Help Center. This page provides guidance on how to use the system and answers to common questions.

1. Getting Started

How do I register?

Registration is done through an invite system
Agents and Team Leaders can register members
Your account must be approved by the Admin before access is granted

How do I log in?

Enter your registered email and password
Click Login to access your account
You may also use your 4-digit MPIN for quick access to the system

2. Account Management

I forgot my password

Click Forgot Password on the login page
Wait for assistance from the Admin Support Team

How do I update my profile?

Go to your account/profile settings
Edit your information
Save changes

How do I delete my account?

Contact the system administrator or support team
Request account deletion

3. Using the System

What can I do in BOWNERS?

Access features based on your role (Admin, Team Leader, Agent, Member)
Manage your data and records
View and update system-related information

4. Security & Privacy

Is my data secure?

Yes. BOWNERS uses security measures to protect your information. Access is restricted to authorized users only.

Who can see my data?

Only authorized personnel and system administrators can access your data when necessary.

5. Troubleshooting

I can't log in

Check your email and password
Ensure your account has been approved by Admin
Use MPIN if available
Contact support if the issue continues

The system is not working properly

Refresh the page
Try using a different browser
Check your internet connection
Contact support if the issue persists

6. Support

If you need further assistance, please contact:

System Administrator
Support Team

Provide clear details about your issue to help us assist you faster.

7. Updates

This Help Center may be updated as new features are added or system changes are made.`;

const HELP_SECTIONS = [
  {
    title: "Getting Started",
    items: [
      {
        q: "How do I register?",
        a: "Registration is handled through the invite system. Agents and Team Leaders can register members. Your account must be approved by the Admin before full access is granted.",
      },
      {
        q: "How do I log in?",
        a: "Enter your registered email and password on the landing page. After entering the app, you will be prompted to enter your 4-digit MPIN for secure access.",
      },
    ],
  },
  {
    title: "Account Management",
    items: [
      {
        q: "I forgot my password",
        a: "Click Forgot Password on the login page.\nWait for assistance from the Admin Support Team.",
      },
      {
        q: "How do I update my profile?",
        a: "Go to your account/profile settings.\nEdit your information.\nSave changes.",
      },
      {
        q: "How do I delete my account?",
        a: "Contact the system administrator or support team to request account deletion.",
      },
    ],
  },
  {
    title: "Using the System",
    items: [
      {
        q: "What can I do in BOWNERS?",
        a: "Access features based on your role (Admin, Team Leader, Agent, Member).\nManage your data and records.\nView and update system-related information.",
      },
    ],
  },
  {
    title: "Security & Privacy",
    items: [
      {
        q: "Is my data secure?",
        a: "Yes. BOWNERS uses security measures to protect your information. Access is restricted to authorized users only.",
      },
      {
        q: "Who can see my data?",
        a: "Only authorized personnel and system administrators can access your data when necessary.",
      },
    ],
  },
  {
    title: "Troubleshooting",
    items: [
      {
        q: "I can't log in",
        a: "• Check your email and password\n• Ensure your account has been approved by Admin\n• Use MPIN if available\n• Contact support if the issue continues",
      },
      {
        q: "The system is not working properly",
        a: "• Refresh the page\n• Try using a different browser\n• Check your internet connection\n• Contact support if the issue persists",
      },
    ],
  },
];

const TERMS_SECTIONS = [
  {
    title: "Acceptance of Terms",
    body: "By creating and using a BOWNERS account, you agree to follow these Terms of Use. If you disagree, do not use the platform.",
  },
  {
    title: "Private System Access",
    body: "BOWNERS is a membership-based platform for authorized users only. Access is limited to approved accounts.",
  },
  {
    title: "User Responsibilities",
    body: "Keep your credentials secure, provide accurate account details, and use the system only for lawful and intended purposes.",
  },
  {
    title: "Account & Data Rules",
    body: "You remain responsible for content under your account. Accounts may be suspended for violations or security risk.",
  },
  {
    title: "Availability & Security",
    body: "We aim for reliable service, but interruptions may occur for maintenance, updates, or unexpected incidents.",
  },
  {
    title: "Liability & Termination",
    body: "BOWNERS and administrators are not liable for damages caused by misuse, downtime, or unauthorized user actions.",
  },
  {
    title: "Updates to Terms",
    body: "Terms may change from time to time. Continued usage means acceptance of the latest version.",
  },
];

const PRIVACY_SECTIONS = [
  {
    title: "What We Collect",
    body: "Basic member profile data, account credentials, usage logs, and operational records needed to provide secure access.",
  },
  {
    title: "Why We Collect It",
    body: "To authenticate users, protect accounts, maintain performance, and deliver support and system updates.",
  },
  {
    title: "How We Protect Data",
    body: "Data access is restricted to authorized personnel and protected through technical and organizational safeguards.",
  },
  {
    title: "Sharing and Disclosure",
    body: "We do not sell personal information. Data is only shared when required for operations, legal compliance, or security.",
  },
  {
    title: "Retention and Deletion",
    body: "Data is retained only as needed for active service, legal obligations, and security integrity. Deletion requests are honored where feasible.",
  },
  {
    title: "Your Privacy Rights",
    body: "Members may request access, correction, or deletion of their information, subject to identity checks and platform constraints.",
  },
];

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showSplash, setShowSplash] = useState(false);
  const [splashLogo, setSplashLogo] = useState(newlogo);
  const [postSplashTarget, setPostSplashTarget] = useState(null);
  const [redirecting, setRedirecting] = useState(false);
  const [usePasswordLogin, setUsePasswordLogin] = useState(false);
  const [legalDialog, setLegalDialog] = useState(null);
  const [recoveryMode, setRecoveryMode] = useState(null);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const [recoveryError, setRecoveryError] = useState("");
  const [helpSearch, setHelpSearch] = useState("");
  const [mpin, setMpin] = useState(["", "", "", ""]);
  const mpinRefs = [useRef(), useRef(), useRef(), useRef()];

  const dialogTitle = legalDialog === "privacy"
    ? "Privacy Policy"
    : legalDialog === "terms"
      ? "Terms of Use"
      : "Help Center";

  const dialogBody = legalDialog === "privacy"
    ? PRIVACY_POLICY_TEXT
    : legalDialog === "terms"
      ? TERMS_OF_USE_TEXT
      : HELP_CENTER_TEXT;

  const normalizedHelpSearch = helpSearch.trim().toLowerCase();
  const filteredHelpSections = HELP_SECTIONS
    .map((section) => {
      if (!normalizedHelpSearch) return section;
      const sectionMatches = section.title.toLowerCase().includes(normalizedHelpSearch);
      const items = section.items.filter((item) => {
        const haystack = `${item.q} ${item.a}`.toLowerCase();
        return haystack.includes(normalizedHelpSearch);
      });
      if (!sectionMatches && items.length === 0) return null;
      return {
        ...section,
        items: items.length > 0 ? items : section.items,
      };
    })
    .filter(Boolean);

  const helpResultsCount = filteredHelpSections.reduce((total, section) => total + section.items.length, 0);
  const showSupportSection = !normalizedHelpSearch || "support administrator admin team contact assistance help".includes(normalizedHelpSearch);

  const isPasswordRecovery = recoveryMode === "password";

  const openRecovery = (mode) => {
    setRecoveryMode(mode);
    setRecoveryEmail(email || "");
    setRecoveryLoading(false);
    setRecoveryError("");
    setRecoveryMessage("");
  };

  const closeRecovery = () => {
    setRecoveryMode(null);
    setRecoveryLoading(false);
    setRecoveryError("");
    setRecoveryMessage("");
  };

  const handleRecoverySubmit = async (event) => {
    event.preventDefault();
    const safeEmail = recoveryEmail.trim();

    if (!safeEmail || !/^\S+@\S+\.\S+$/.test(safeEmail)) {
      setRecoveryError("Please enter a valid registered email address.");
      return;
    }

    setRecoveryLoading(true);
    setRecoveryError("");
    setRecoveryMessage("");

    try {
      const response = await fetch(`${CLOUD_FUNCTIONS_BASE}/recoveryRequest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: safeEmail,
          requestType: isPasswordRecovery ? "PASSWORD" : "MPIN",
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to submit request");
      }

      setRecoveryMessage(
        payload?.message ||
          (isPasswordRecovery
            ? "Password reset request sent to Admin. Please wait for approval."
            : "MPIN reset request sent to Admin. You will receive instructions after approval.")
      );
      setEmail(safeEmail);
    } catch (err) {
      setRecoveryError(err?.message || "Unable to process your request right now. Please try again later.");
    } finally {
      setRecoveryLoading(false);
    }
  };

  const renderHighlightedText = (text) => {
    if (!normalizedHelpSearch) return text;
    const safeQuery = escapeRegExp(normalizedHelpSearch);
    const regex = new RegExp(`(${safeQuery})`, "ig");
    return text.split(regex).map((part, index) => {
      if (part.toLowerCase() !== normalizedHelpSearch) return part;
      return (
        <Box
          key={`${part}-${index}`}
          component="mark"
          sx={{
            backgroundColor: "#fff2a8",
            color: "#1c2f4c",
            px: 0.25,
            borderRadius: 0.5,
          }}
        >
          {part}
        </Box>
      );
    });
  };

  const handleMpinChange = (index, value) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...mpin];
    next[index] = value;
    setMpin(next);
    if (value && index < 3) mpinRefs[index + 1].current?.focus();

    const nextMpinValue = next.join("");
    if (
      value &&
      index === 3 &&
      nextMpinValue.length === 4 &&
      !usePasswordLogin &&
      email
    ) {
      setTimeout(() => {
        if (next.join("").length === 4 && !loading && !usePasswordLogin) {
          handleMpinLogin({ preventDefault: () => {} }, nextMpinValue);
        }
      }, 120);
    }
  };

  const handleMpinKeyDown = (index, event) => {
    if (event.key === "Backspace" && !mpin[index] && index > 0) {
      mpinRefs[index - 1].current?.focus();
      return;
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      mpinRefs[index - 1].current?.focus();
      return;
    }

    if (event.key === "ArrowRight" && index < 3) {
      event.preventDefault();
      mpinRefs[index + 1].current?.focus();
    }
  };

  const handleRedirect = (role) => {
    const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
    const upper = String(role || "").toUpperCase();

    setRedirecting(true);

    const goTo = (path) => {
      sessionStorage.setItem("skipAppSplash", "true");
      window.location.replace(`${base}${path}`);
    };

    if (upper === "MERCHANT") {
      setSplashLogo(merchantLogo);
      const merchantUrl =
        window.location.hostname === "localhost"
          ? "http://localhost:3002"
          : `${window.location.origin}/damayan-savings/merchant`;
      setPostSplashTarget(`${merchantUrl}/`);
      setShowSplash(true);
      return;
    }

    switch (upper) {
      case "ADMIN":
      case "CEO":
      case "SUPERADMIN":
        goTo("/admin/dashboard");
        break;
      case "MASTERMD":
      case "MD":
      case "MS":
      case "MI":
      case "AGENT":
      case "MEMBER":
        goTo("/member/dashboard");
        break;
      case "RIDER": {
        const riderUrl =
          window.location.hostname === "localhost"
            ? "http://localhost:3003"
            : `${window.location.origin}/damayan-savings/rider`;
        window.location.href = `${riderUrl}/`;
        break;
      }
      default:
        goTo("/");
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        localStorage.removeItem("userRole");
        return;
      }

      if (redirecting) return;

      let role = localStorage.getItem("userRole");
      if (!role) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          role = userSnap.data().role || "Member";
          localStorage.setItem("userRole", role.toUpperCase());
        } else {
          return;
        }
      }

      handleRedirect(role);
    });

    return () => unsubscribe();
  }, [redirecting]);

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userRef = doc(db, "users", userCredential.user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        setError("User data not found. Please contact the admin.");
        return;
      }

      const role = (userSnap.data().role || "Member").toUpperCase();
      localStorage.setItem("userRole", role);
      handleRedirect(role);
    } catch (err) {
      console.error("Login error:", err.message);
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
        setError("Invalid email or password.");
      } else {
        setError("Unable to login. Please try again later.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMpinLogin = async (e, providedMpin) => {
    e.preventDefault();
    const mpinValue = providedMpin || mpin.join("");

    if (!email) {
      setError("Please enter your email address.");
      return;
    }

    if (mpinValue.length !== 4) {
      setError("Please enter all 4 digits of your MPIN.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${CLOUD_FUNCTIONS_BASE}/mpinLogin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, mpin: mpinValue }),
      });
      const data = await res.json();

      if (!res.ok) {
        const serverError = String(data?.error || "");
        if (serverError.toLowerCase().includes("service account token creator") || serverError.toLowerCase().includes("iam")) {
          setUsePasswordLogin(true);
          setError("MPIN login is temporarily unavailable. Switched to password login while server IAM is being fixed.");
        } else {
          setError(data.error || "Invalid email or MPIN.");
        }
        return;
      }

      const userCredential = await signInWithCustomToken(auth, data.customToken);
      const userRef = doc(db, "users", userCredential.user.uid);
      const userSnap = await getDoc(userRef);
      const role = (userSnap.data()?.role || "Member").toUpperCase();

      localStorage.setItem("userRole", role);
      handleRedirect(role);
    } catch (err) {
      console.error("MPIN login error:", err);
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const emailFieldSx = {
    "& .MuiOutlinedInput-root": {
      borderRadius: "18px",
      backgroundColor: "#f1ede3",
      border: "1px solid rgba(111, 119, 96, 0.12)",
      "& fieldset": { border: "none" },
      "&:hover": {
        backgroundColor: "#ede8dc",
      },
      "&.Mui-focused": {
        backgroundColor: "#f4efe4",
        boxShadow: "0 0 0 3px rgba(113, 132, 97, 0.16)",
      },
    },
    "& .MuiInputBase-input": {
      color: "#6c7562",
      fontWeight: 600,
      fontSize: "0.95rem",
      letterSpacing: "0.01em",
      textAlign: "left",
      py: 1.15,
      "&::placeholder": {
        color: "#9ca192",
        opacity: 1,
      },
    },
  };

  return (
    <Box className="login-page-container">
      <Container maxWidth="sm" sx={{ py: 1.5, px: { xs: 1.5, sm: 2.5 } }}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <Box className="login-hero-shell">
            <Typography className="login-hero-kicker">Bowners Member Access</Typography>
          </Box>

          <Paper elevation={0} className="login-card-new">
            <Box className="login-badge-wrap">
              <Box className="login-badge-icon">
                <Box component="img" src={newlogo} alt="Bowners" className="login-badge-logo" />
              </Box>
            </Box>

            <Typography className="login-title">
              Welcome Back
            </Typography>
            <Typography className="login-subtitle">
              Quick access with your secure MPIN
            </Typography>

            {error && (
              <Alert severity="error" sx={{ borderRadius: 2, mb: 1.5 }}>
                {error}
              </Alert>
            )}

            <Box component="form" onSubmit={usePasswordLogin ? handlePasswordLogin : handleMpinLogin} className="login-form-stack">
              <Box className="field-heading-wrap">
                <Typography className="field-heading">Email Address</Typography>
              </Box>
              <TextField
                fullWidth
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Mail sx={{ color: "#a1a595", fontSize: 18 }} />
                    </InputAdornment>
                  ),
                }}
                sx={emailFieldSx}
              />

              {!usePasswordLogin && (
                <Box className="mpin-section-wrap">
                  <Box className="field-heading-row">
                    <Typography className="field-heading">4 Digit MPIN</Typography>
                    <Button
                      variant="text"
                      onClick={() => openRecovery("mpin")}
                      className="forgot-switch-btn"
                    >
                      Forgot?
                    </Button>
                  </Box>

                  <Box className="mpin-grid-wrap">
                    {mpin.map((digit, i) => (
                      <Box
                        key={i}
                        component="input"
                        ref={mpinRefs[i]}
                        type="password"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleMpinChange(i, e.target.value)}
                        onKeyDown={(e) => handleMpinKeyDown(i, e)}
                        className={`mpin-dot-input ${digit ? "filled" : ""}`}
                      />
                    ))}
                  </Box>
                </Box>
              )}

              {usePasswordLogin && (
                <Box className="password-section-wrap">
                  <Box className="field-heading-row">
                    <Typography className="field-heading">Password</Typography>
                    <Button
                      variant="text"
                      onClick={() => openRecovery("password")}
                      className="forgot-switch-btn"
                    >
                      Forgot Password?
                    </Button>
                  </Box>
                  <TextField
                    fullWidth
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Lock sx={{ color: "#a1a595", fontSize: 18 }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => setShowPassword((prev) => !prev)}
                            size="small"
                            sx={{ color: "#2a6fdb" }}
                          >
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={emailFieldSx}
                  />
                </Box>
              )}

              <Box className="login-submit-group">
                <Button
                  fullWidth
                  type="submit"
                  disabled={loading || (!usePasswordLogin && mpin.join("").length !== 4)}
                  className="login-submit-btn"
                >
                  {loading ? (
                    <CircularProgress size={20} sx={{ color: "#fff" }} />
                  ) : (
                    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
                      {usePasswordLogin ? "LOGIN WITH PASSWORD" : "MPIN LOGIN"}
                      <ArrowForward sx={{ fontSize: 17 }} />
                    </Box>
                  )}
                </Button>

                <Box className="login-switch-row">
                  <Button
                    variant="text"
                    onClick={() => {
                      setUsePasswordLogin((prev) => !prev);
                      setError("");
                      setMpin(["", "", "", ""]);
                    }}
                    className="login-switch-link"
                  >
                    {usePasswordLogin ? "Use MPIN Instead" : "Use Password Instead"}
                  </Button>
                </Box>
              </Box>
            </Box>
          </Paper>

          <Divider sx={{ my: 2, borderColor: "rgba(87, 102, 79, 0.14)" }} />
          <Box className="portal-switcher">
            <Typography className="portal-switcher-label">Need a different portal?</Typography>
            <Box className="portal-switcher-actions">
              <Button
                startIcon={<DirectionsBike sx={{ fontSize: 14 }} />}
                onClick={() => goToLoginScope("RIDER")}
                className="portal-tile rider"
              >
                Rider Login
              </Button>
              <Button
                startIcon={<Store sx={{ fontSize: 14 }} />}
                onClick={() => goToLoginScope("MERCHANT")}
                className="portal-tile merchant"
              >
                Merchant Login
              </Button>
            </Box>
          </Box>

          <Divider sx={{ my: 1.6, borderColor: "rgba(87, 102, 79, 0.14)" }} />
          <Box className="login-utility-links">
            <Button className="footer-link-btn" onClick={() => setLegalDialog("privacy")}>Privacy Policy</Button>
            <Button className="footer-link-btn" onClick={() => setLegalDialog("terms")}>Terms of Use</Button>
            <Button className="footer-link-btn" onClick={() => setLegalDialog("help")}>Help Center</Button>
          </Box>

          <Typography className="login-footer-note">
            © 2025 Bowners Indelity Services. All rights reserved.
          </Typography>
        </motion.div>
      </Container>

      <Drawer
        anchor="right"
        open={Boolean(legalDialog)}
        onClose={() => setLegalDialog(null)}
        ModalProps={{ keepMounted: true }}
        transitionDuration={{ enter: 360, exit: 260 }}
        slotProps={{
          backdrop: {
            sx: { backgroundColor: "rgba(0, 0, 0, 0.4)" },
          },
        }}
        PaperProps={{
          sx: {
            width: { xs: "100%", sm: 430 },
            maxWidth: "100%",
            backgroundColor: "#f7f9fc",
            display: "flex",
            flexDirection: "column",
            animation: Boolean(legalDialog)
              ? "legalSlideIn 0.35s cubic-bezier(0.4, 0, 0.2, 1)"
              : "legalSlideOut 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            "@keyframes legalSlideIn": {
              "0%": { transform: "translateX(100%)" },
              "100%": { transform: "translateX(0)" },
            },
            "@keyframes legalSlideOut": {
              "0%": { transform: "translateX(0)" },
              "100%": { transform: "translateX(100%)" },
            },
          },
        }}
      >
        {/* Header */}
        <Box
          sx={{
            minHeight: 70,
            px: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            color: "#fff",
            background: "linear-gradient(135deg, #0b1f5e 0%, #173a8a 55%, #d4af37 100%)",
          }}
        >
          <IconButton onClick={() => setLegalDialog(null)} sx={{ color: "#fff" }}>
            <ArrowBack />
          </IconButton>
          <Typography sx={{ fontSize: 18, fontWeight: 800, letterSpacing: 0.2, lineHeight: 1 }}>
            {dialogTitle}
          </Typography>
          <Box sx={{ width: 40 }} />
        </Box>

        {/* Body */}
        <Box sx={{ flex: 1, overflowY: "auto" }}>
          {legalDialog === "help" ? (
            <Box>
              {/* Hero + Search */}
              <Box
                sx={{
                  background: "linear-gradient(135deg, #0b1f5e 0%, #173a8a 55%, #d4af37 100%)",
                  px: 2.5,
                  pt: 2.5,
                  pb: 3,
                }}
              >
                <Typography sx={{ color: "#fff", fontWeight: 900, fontSize: "1.3rem", mb: 1.5 }}>
                  How can we help?
                </Typography>
                <TextField
                  placeholder="Search help topics, articles..."
                  fullWidth
                  size="small"
                  value={helpSearch}
                  onChange={(event) => setHelpSearch(event.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search sx={{ color: "rgba(255,255,255,0.7)", fontSize: 18 }} />
                      </InputAdornment>
                    ),
                    sx: {
                      background: "rgba(255,255,255,0.15)",
                      borderRadius: 2,
                      color: "#fff",
                      "& input": { color: "#fff" },
                      "& input::placeholder": { color: "rgba(255,255,255,0.6)", opacity: 1 },
                      "& fieldset": { borderColor: "rgba(255,255,255,0.25) !important" },
                    },
                  }}
                />
                <Chip
                  label="BOWNERS SYSTEM"
                  size="small"
                  sx={{
                    mt: 1.5,
                    background: "rgba(40,185,90,0.85)",
                    color: "#fff",
                    fontWeight: 800,
                    fontSize: "0.65rem",
                    letterSpacing: 0.5,
                    height: 22,
                  }}
                />
                {normalizedHelpSearch ? (
                  <Typography sx={{ mt: 1.2, color: "rgba(255,255,255,0.86)", fontSize: "0.72rem", fontWeight: 600 }}>
                    {helpResultsCount} result{helpResultsCount !== 1 ? "s" : ""} for "{helpSearch.trim()}"
                  </Typography>
                ) : null}
              </Box>

              {/* Welcome */}
              <Box sx={{ px: 2.5, py: 2, background: "#fff", borderBottom: "1px solid #edf1f7" }}>
                <Typography sx={{ fontWeight: 800, fontSize: "0.95rem", color: "#0b1f5e", mb: 0.75 }}>
                  Welcome to the BOWNERS Help Center
                </Typography>
                <Typography sx={{ fontSize: "0.79rem", color: "#556070", lineHeight: 1.65 }}>
                  This page provides guidance on how to use the system and answers to common questions.
                  Navigate through the sections below to find the information you need.
                </Typography>
              </Box>

              {/* Accordion Sections 1–5 */}
              {filteredHelpSections.map((section, i) => (
                <Accordion
                  key={i}
                  disableGutters
                  elevation={0}
                  sx={{
                    borderBottom: "1px solid #edf1f7",
                    "&:before": { display: "none" },
                    background: "#fff",
                  }}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMore sx={{ color: "#0b1f5e" }} />}
                    sx={{ px: 2.5, py: 0.75, minHeight: 52 }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: "10px",
                          background: "linear-gradient(135deg, #0b3caa, #173a8a)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Typography sx={{ color: "#fff", fontWeight: 900, fontSize: "0.78rem" }}>
                          {i + 1}
                        </Typography>
                      </Box>
                      <Typography sx={{ fontWeight: 700, color: "#0b1f5e", fontSize: "0.88rem" }}>
                        {section.title}
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails sx={{ px: 2.5, pb: 2, pt: 0.5, background: "#f7f9fc" }}>
                    {section.items.map((item, j) => (
                      <Box key={j} sx={{ mb: j < section.items.length - 1 ? 1.75 : 0 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: "0.82rem", color: "#173a8a", mb: 0.4 }}>
                            {renderHighlightedText(item.q)}
                        </Typography>
                        <Typography sx={{ fontSize: "0.78rem", color: "#556070", lineHeight: 1.65, whiteSpace: "pre-line" }}>
                            {renderHighlightedText(item.a)}
                        </Typography>
                      </Box>
                    ))}
                  </AccordionDetails>
                </Accordion>
              ))}

              {normalizedHelpSearch && helpResultsCount === 0 ? (
                <Box sx={{ px: 2.5, py: 3, background: "#fff", borderBottom: "1px solid #edf1f7" }}>
                  <Typography sx={{ fontWeight: 800, fontSize: "0.9rem", color: "#173a8a", mb: 0.5 }}>
                    No topics found
                  </Typography>
                  <Typography sx={{ fontSize: "0.78rem", color: "#556070", lineHeight: 1.6 }}>
                    Try broader keywords like account, login, support, or security.
                  </Typography>
                </Box>
              ) : null}

              {/* Section 6 – Support */}
              {showSupportSection ? (
              <Box sx={{ px: 2.5, py: 2.5, background: "#f7f9fc", borderBottom: "1px solid #edf1f7" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.25 }}>
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: "10px",
                      background: "linear-gradient(135deg, #0b3caa, #173a8a)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Typography sx={{ color: "#fff", fontWeight: 900, fontSize: "0.78rem" }}>6</Typography>
                  </Box>
                  <Typography sx={{ fontWeight: 700, color: "#0b1f5e", fontSize: "0.88rem" }}>
                    Support
                  </Typography>
                </Box>
                <Typography sx={{ fontSize: "0.79rem", color: "#556070", lineHeight: 1.65, mb: 2 }}>
                  Still have questions? Our specialized team is here to help you with the BOWNERS system.
                </Typography>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<ManageAccounts />}
                  sx={{
                    mb: 1.25,
                    py: 1.3,
                    borderRadius: 2,
                    textTransform: "none",
                    justifyContent: "flex-start",
                    px: 2,
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    background: "linear-gradient(135deg, #0b1f5e, #173a8a)",
                    boxShadow: "0 4px 12px rgba(11,31,94,0.25)",
                  }}
                >
                  System Admin
                </Button>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<SupportAgent />}
                  sx={{
                    py: 1.3,
                    borderRadius: 2,
                    textTransform: "none",
                    justifyContent: "flex-start",
                    px: 2,
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    background: "linear-gradient(135deg, #0369c7, #0573ef)",
                    boxShadow: "0 4px 12px rgba(5,115,239,0.25)",
                  }}
                >
                  Support Team
                </Button>
              </Box>
              ) : null}

              {/* Footnote */}
              <Box sx={{ px: 2.5, py: 1.75 }}>
                <Typography sx={{ fontSize: "0.68rem", color: "#aab4c4", lineHeight: 1.6 }}>
                  * UPDATED: HELP CENTER CONTENT MAY BE UPDATED AS FEATURES EXPAND.
                </Typography>
              </Box>
            </Box>
          ) : legalDialog === "terms" ? (
            <Box>
              <Box sx={{ px: 2.5, pt: 2.25, pb: 2, background: "#ffffff", borderBottom: "1px solid #e9eef7" }}>
                <Typography sx={{ fontWeight: 900, color: "#0b1f5e", fontSize: "1rem", mb: 0.4 }}>
                  Terms of Use Agreement
                </Typography>
                <Typography sx={{ fontSize: "0.78rem", color: "#637286", lineHeight: 1.65 }}>
                  Last updated: April 3, 2026. These terms define your rights and obligations while using BOWNERS.
                </Typography>
              </Box>

              <Box sx={{ px: 2.5, py: 2, background: "#f7f9fc" }}>
                <Box
                  sx={{
                    p: 1.4,
                    borderRadius: 2,
                    background: "linear-gradient(135deg, #eaf3ff 0%, #f4f8ff 100%)",
                    border: "1px solid #d8e8ff",
                    mb: 1.25,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                    <InfoOutlined sx={{ color: "#0b5ed7", fontSize: 18, mt: 0.1 }} />
                    <Box>
                      <Typography sx={{ color: "#124aa7", fontWeight: 800, fontSize: "0.8rem", mb: 0.25 }}>
                        Important Notice
                      </Typography>
                      <Typography sx={{ color: "#315a92", fontSize: "0.74rem", lineHeight: 1.55 }}>
                        Continued use of your account means you accept and agree to all current policies and future updates.
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                <Box
                  sx={{
                    p: 1.4,
                    borderRadius: 2,
                    background: "#fff",
                    border: "1px solid #e5ebf5",
                    mb: 1.25,
                  }}
                >
                  <Typography sx={{ color: "#173a8a", fontWeight: 800, fontSize: "0.8rem", mb: 0.6 }}>
                    Key Commitments
                  </Typography>
                  <Typography sx={{ fontSize: "0.75rem", color: "#556070", lineHeight: 1.65, whiteSpace: "pre-line" }}>
                    • Keep credentials private and secure
                    {"\n"}• Provide accurate account information
                    {"\n"}• Avoid misuse, unauthorized access, and harmful actions
                    {"\n"}• Respect system integrity and operational rules
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ px: 2.5, py: 0.75 }}>
                {TERMS_SECTIONS.map((section, index) => (
                  <Box
                    key={section.title}
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      background: "#fff",
                      border: "1px solid #e5ebf5",
                      mb: 1,
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.45 }}>
                      <Box
                        sx={{
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          background: "linear-gradient(135deg, #0d56cb, #173a8a)",
                          color: "#fff",
                          fontWeight: 800,
                          fontSize: "0.7rem",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {index + 1}
                      </Box>
                      <Typography sx={{ color: "#123977", fontWeight: 800, fontSize: "0.8rem" }}>
                        {section.title}
                      </Typography>
                    </Box>
                    <Typography sx={{ color: "#596c85", fontSize: "0.74rem", lineHeight: 1.62 }}>
                      {section.body}
                    </Typography>
                  </Box>
                ))}
              </Box>

              <Box sx={{ px: 2.5, pb: 2.5, pt: 0.5 }}>
                <Box
                  sx={{
                    p: 1.4,
                    borderRadius: 2,
                    background: "linear-gradient(135deg, #fff4e8 0%, #ffefe0 100%)",
                    border: "1px solid #f8d3b0",
                    mb: 1.5,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                    <WarningAmber sx={{ color: "#d2691e", fontSize: 18, mt: 0.1 }} />
                    <Typography sx={{ color: "#965522", fontSize: "0.73rem", lineHeight: 1.6 }}>
                      Account access may be suspended for violations, suspected security threats, or legal compliance requirements.
                    </Typography>
                  </Box>
                </Box>

                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    border: "1px solid #dfe7f3",
                    background: "#fff",
                    textAlign: "center",
                  }}
                >
                  <FactCheck sx={{ color: "#1e6fe0", fontSize: 28, mb: 0.5 }} />
                  <Typography sx={{ fontWeight: 700, color: "#173a8a", fontSize: "0.8rem", mb: 0.4 }}>
                    Continued Use = Acceptance
                  </Typography>
                  <Typography sx={{ color: "#5f7086", fontSize: "0.73rem", lineHeight: 1.6 }}>
                    By continuing to use BOWNERS, you acknowledge these Terms and agree to abide by them.
                  </Typography>
                </Box>
              </Box>
            </Box>
          ) : legalDialog === "privacy" ? (
            <Box>
              <Box sx={{ px: 2.5, pt: 2.25, pb: 2, background: "#ffffff", borderBottom: "1px solid #e9eef7" }}>
                <Typography sx={{ fontWeight: 900, color: "#0b1f5e", fontSize: "1rem", mb: 0.4 }}>
                  Privacy Policy Agreement
                </Typography>
                <Typography sx={{ fontSize: "0.78rem", color: "#637286", lineHeight: 1.65 }}>
                  Last updated: April 3, 2026. This policy explains how BOWNERS collects, uses, stores, and protects member data.
                </Typography>
              </Box>

              <Box sx={{ px: 2.5, py: 2, background: "#f7f9fc" }}>
                <Box
                  sx={{
                    p: 1.4,
                    borderRadius: 2,
                    background: "linear-gradient(135deg, #e9fbf3 0%, #f3fcf8 100%)",
                    border: "1px solid #cceede",
                    mb: 1.25,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                    <PrivacyTip sx={{ color: "#14804c", fontSize: 18, mt: 0.1 }} />
                    <Box>
                      <Typography sx={{ color: "#17603f", fontWeight: 800, fontSize: "0.8rem", mb: 0.25 }}>
                        Privacy Commitment
                      </Typography>
                      <Typography sx={{ color: "#2e6d4d", fontSize: "0.74rem", lineHeight: 1.55 }}>
                        We only collect data required for secure platform operations and member services.
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                <Box
                  sx={{
                    p: 1.4,
                    borderRadius: 2,
                    background: "#fff",
                    border: "1px solid #e5ebf5",
                    mb: 1.25,
                  }}
                >
                  <Typography sx={{ color: "#173a8a", fontWeight: 800, fontSize: "0.8rem", mb: 0.6 }}>
                    Your Data Rights
                  </Typography>
                  <Typography sx={{ fontSize: "0.75rem", color: "#556070", lineHeight: 1.65, whiteSpace: "pre-line" }}>
                    • Request access to your personal data
                    {"\n"}• Request corrections for inaccurate information
                    {"\n"}• Request deletion, subject to legal and operational limits
                    {"\n"}• Receive support for privacy-related concerns
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ px: 2.5, py: 0.75 }}>
                {PRIVACY_SECTIONS.map((section, index) => (
                  <Box
                    key={section.title}
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      background: "#fff",
                      border: "1px solid #e5ebf5",
                      mb: 1,
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.45 }}>
                      <Box
                        sx={{
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          background: "linear-gradient(135deg, #14804c, #2b9f69)",
                          color: "#fff",
                          fontWeight: 800,
                          fontSize: "0.7rem",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {index + 1}
                      </Box>
                      <Typography sx={{ color: "#175739", fontWeight: 800, fontSize: "0.8rem" }}>
                        {section.title}
                      </Typography>
                    </Box>
                    <Typography sx={{ color: "#596c85", fontSize: "0.74rem", lineHeight: 1.62 }}>
                      {section.body}
                    </Typography>
                  </Box>
                ))}
              </Box>

              <Box sx={{ px: 2.5, pb: 2.5, pt: 0.5 }}>
                <Box
                  sx={{
                    p: 1.4,
                    borderRadius: 2,
                    background: "linear-gradient(135deg, #eaf3ff 0%, #f3f9ff 100%)",
                    border: "1px solid #d7e8ff",
                    mb: 1.5,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                    <ShieldOutlined sx={{ color: "#1f68d9", fontSize: 18, mt: 0.1 }} />
                    <Typography sx={{ color: "#315a92", fontSize: "0.73rem", lineHeight: 1.6 }}>
                      Personal data is handled with restricted access controls and protected storage aligned with privacy best practices.
                    </Typography>
                  </Box>
                </Box>

                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    border: "1px solid #dfe7f3",
                    background: "#fff",
                    textAlign: "center",
                  }}
                >
                  <Policy sx={{ color: "#1e6fe0", fontSize: 28, mb: 0.5 }} />
                  <Typography sx={{ fontWeight: 700, color: "#173a8a", fontSize: "0.8rem", mb: 0.4 }}>
                    Transparency Matters
                  </Typography>
                  <Typography sx={{ color: "#5f7086", fontSize: "0.73rem", lineHeight: 1.6 }}>
                    Continued use of BOWNERS confirms your understanding of this Privacy Policy and future policy updates.
                  </Typography>
                </Box>
              </Box>
            </Box>
          ) : (
            <Typography
              sx={{
                whiteSpace: "pre-line",
                color: "#24415f",
                lineHeight: 1.75,
                fontSize: "0.93rem",
                p: 2.5,
              }}
            >
              {dialogBody}
            </Typography>
          )}
        </Box>
      </Drawer>

      <Drawer
        anchor="right"
        open={Boolean(recoveryMode)}
        onClose={closeRecovery}
        ModalProps={{ keepMounted: true }}
        transitionDuration={{ enter: 360, exit: 260 }}
        slotProps={{
          backdrop: {
            sx: { backgroundColor: "rgba(0, 0, 0, 0.42)" },
          },
        }}
        PaperProps={{
          sx: {
            width: { xs: "100%", sm: 430 },
            maxWidth: "100%",
            background: "#f4f6fa",
            display: "flex",
            flexDirection: "column",
          },
        }}
      >
        <Box sx={{ p: 2.5, display: "flex", alignItems: "center" }}>
          <IconButton onClick={closeRecovery} sx={{ color: "#174ea6" }}>
            <ArrowBack />
          </IconButton>
        </Box>

        <Box sx={{ px: 3, pb: 2.5, textAlign: "center" }}>
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: "16px",
              background: "#e3ebff",
              color: "#1f57c3",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              mb: 1.6,
            }}
          >
            {isPasswordRecovery ? <LockReset sx={{ fontSize: 26 }} /> : <VerifiedUser sx={{ fontSize: 24 }} />}
          </Box>
          <Typography sx={{ fontSize: "2rem", fontWeight: 900, color: "#1f2530", letterSpacing: "-0.03em", lineHeight: 1.1, mb: 1 }}>
            {isPasswordRecovery ? "Reset Your Password" : "Forgot MPIN?"}
          </Typography>
          <Typography sx={{ fontSize: "0.95rem", color: "#697488", lineHeight: 1.65 }}>
            {isPasswordRecovery
              ? "Enter the email address associated with your account and we'll send you instructions to reset your password."
              : "Enter your registered email address to receive a recovery code."}
          </Typography>
        </Box>

        <Box sx={{ px: 2.5 }}>
          <Box
            component="form"
            onSubmit={handleRecoverySubmit}
            sx={{
              background: "#fff",
              borderRadius: "22px",
              p: 2.5,
              borderTop: "3px solid #145ed1",
              boxShadow: "0 10px 30px rgba(13, 44, 106, 0.1)",
            }}
          >
            <Typography sx={{ color: "#606b7d", fontWeight: 800, fontSize: "0.68rem", letterSpacing: "0.09em", mb: 0.9 }}>
              {isPasswordRecovery ? "REGISTERED EMAIL ADDRESS" : "EMAIL ADDRESS"}
            </Typography>
            <TextField
              fullWidth
              required
              type="email"
              value={recoveryEmail}
              onChange={(e) => setRecoveryEmail(e.target.value)}
              placeholder={isPasswordRecovery ? "e.g. name@company.com" : "name@company.com"}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Mail sx={{ color: "#8b96a8", fontSize: 18 }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                mb: 1.6,
                "& .MuiOutlinedInput-root": {
                  borderRadius: "12px",
                  backgroundColor: "#f0f2f6",
                  border: "1px solid #e5e8ef",
                  "& fieldset": { border: "none" },
                  "&.Mui-focused": { boxShadow: "0 0 0 3px rgba(20, 94, 209, 0.13)" },
                },
                "& .MuiInputBase-input": {
                  color: "#4d5a70",
                  fontWeight: 600,
                  fontSize: "0.92rem",
                  "&::placeholder": { color: "#a2abb9", opacity: 1 },
                },
              }}
            />

            {isPasswordRecovery ? (
              <Box sx={{ p: 1.6, borderRadius: "12px", background: "#f0f2f6", color: "#6f7c90", mb: 1.7 }}>
                <Typography sx={{ fontWeight: 800, fontSize: "0.8rem", color: "#3a4c6a", mb: 0.45 }}>
                  Security Approval:
                  <Box component="span" sx={{ fontWeight: 600, color: "#707d8f", ml: 0.5 }}>
                    For your protection, an administrator will be notified to approve this password reset request. You will receive instructions once the request is processed.
                  </Box>
                </Typography>
              </Box>
            ) : null}

            {recoveryError ? (
              <Alert severity="error" sx={{ mb: 1.4, borderRadius: 2 }}>
                {recoveryError}
              </Alert>
            ) : null}

            {recoveryMessage ? (
              <Alert severity="success" sx={{ mb: 1.4, borderRadius: 2 }}>
                {recoveryMessage}
              </Alert>
            ) : null}

            <Button
              fullWidth
              type="submit"
              disabled={recoveryLoading}
              sx={{
                py: 1.35,
                borderRadius: "10px",
                textTransform: "none",
                fontWeight: 800,
                fontSize: "1rem",
                color: "#fff",
                background: "linear-gradient(180deg, #1264de 0%, #0f57c5 100%)",
                boxShadow: "0 8px 20px rgba(9, 68, 163, 0.28)",
              }}
            >
              {recoveryLoading ? <CircularProgress size={20} sx={{ color: "#fff" }} /> : "Send Request to Admin"}
            </Button>

            <Divider sx={{ my: 2.2, borderColor: "#edf1f7" }} />
            <Button
              fullWidth
              variant="text"
              onClick={closeRecovery}
              sx={{ textTransform: "none", color: "#1f57c3", fontWeight: 800, fontSize: "0.92rem" }}
            >
              Back to Login
            </Button>
          </Box>
        </Box>

        {!isPasswordRecovery ? (
          <Box sx={{ px: 2.5, pt: 2.8, pb: 2.2 }}>
            <Box
              sx={{
                p: 2,
                borderRadius: "14px",
                background: "#ebedf2",
                display: "flex",
                gap: 1.1,
                alignItems: "flex-start",
              }}
            >
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: "8px",
                  background: "#d9e2f8",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#1c58c9",
                  flexShrink: 0,
                }}
              >
                <Info sx={{ fontSize: 16 }} />
              </Box>
              <Box>
                <Typography sx={{ color: "#2d3a50", fontWeight: 800, fontSize: "0.84rem", mb: 0.2 }}>
                  Security Note
                </Typography>
                <Typography sx={{ color: "#647186", fontSize: "0.78rem", lineHeight: 1.55 }}>
                  Once you submit your registered email, a request will be sent to the System Administrator to reset your MPIN. You will be notified via email once approved.
                </Typography>
              </Box>
            </Box>
          </Box>
        ) : null}
      </Drawer>

      <Splashscreen
        open={showSplash}
        logo={splashLogo}
        duration={1400}
        overlayColor={splashLogo === merchantLogo ? "#f1f3c7" : undefined}
        onClose={() => {
          setShowSplash(false);
          const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
          sessionStorage.setItem("skipAppSplash", "true");
          if (postSplashTarget) {
            const target = postSplashTarget.startsWith("http")
              ? postSplashTarget
              : `${base}${postSplashTarget}`;
            window.location.replace(target);
          } else {
            window.location.replace(`${base}/merchant/dashboard`);
          }
        }}
      />
    </Box>
  );
};

export default Login;
