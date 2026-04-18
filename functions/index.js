const functions = require("firebase-functions");
const cors = require("cors");
const admin = require("firebase-admin");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");

admin.initializeApp();
const db = admin.firestore();
const deliveryDispatch = require("./deliveryDispatch");

exports.onSaleCreatedDispatchRider = deliveryDispatch.onSaleCreatedDispatchRider;
exports.onOrderCreatedDispatchRider = deliveryDispatch.onOrderCreatedDispatchRider;
exports.respondToDeliveryRequest = deliveryDispatch.respondToDeliveryRequest;
exports.reassignExpiredDeliveries = deliveryDispatch.reassignExpiredDeliveries;

const normalizeStatus = (value) => String(value || "").trim().toUpperCase();
const DEFAULT_RESET_PASSWORD = "password123";
const DEFAULT_RESET_MPIN = "1234";

const PURCHASE_CODE_PRICES = Object.freeze({
  capitalActivation: 6000,
  capitalRenewal: 500,
  downline: 1000,
});

const getDateValue = (value) => {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const resolvePurchaseCodePricing = (userData = {}) => {
  const activatedAt = getDateValue(userData.capitalActivatedAt);
  const renewalDate = activatedAt
    ? new Date(activatedAt.getFullYear() + 1, activatedAt.getMonth(), activatedAt.getDate())
    : null;
  const isCapitalRenewalEligible = Boolean(
    activatedAt && renewalDate && new Date() >= renewalDate
  );

  const capitalPrice = isCapitalRenewalEligible
    ? PURCHASE_CODE_PRICES.capitalRenewal
    : PURCHASE_CODE_PRICES.capitalActivation;

  return {
    capitalPrice,
    downlinePrice: PURCHASE_CODE_PRICES.downline,
    capitalLabel: isCapitalRenewalEligible
      ? "Capital Share Renewal Code"
      : "Capital Share Activation Code",
    isCapitalRenewalEligible,
  };
};

const collectTokensFromUser = (userData = {}) => {
  const raw = [
    userData.fcmToken,
    userData.pushToken,
    userData.notificationToken,
    ...(Array.isArray(userData.fcmTokens) ? userData.fcmTokens : []),
  ];

  return [...new Set(raw.filter((token) => typeof token === "string" && token.trim()))];
};

const sendPushToUsers = async ({ userIds = [], title, body, data = {} }) => {
  const uniqueUserIds = [...new Set((userIds || []).filter(Boolean))];
  if (!uniqueUserIds.length || !title || !body) return { sent: 0, users: 0 };

  const userSnaps = await Promise.all(uniqueUserIds.map((uid) => db.collection("users").doc(uid).get()));
  const tokens = userSnaps.flatMap((snap) => (snap.exists ? collectTokensFromUser(snap.data() || {}) : []));
  if (!tokens.length) return { sent: 0, users: uniqueUserIds.length };

  const payloadData = Object.entries(data).reduce((acc, [key, value]) => {
    acc[key] = String(value ?? "");
    return acc;
  }, {});
  const clickPath = String(payloadData.path || "/").trim() || "/";
  const defaultWebAppUrl = String(process.env.WEB_APP_URL || "https://lutz1.github.io/damayan-savings").replace(/\/$/, "");
  const absoluteClickUrl = clickPath.startsWith("http")
    ? clickPath
    : `${defaultWebAppUrl}/${clickPath.replace(/^\/+/, "")}`;

  const message = {
    notification: { title, body },
    data: {
      ...payloadData,
      path: clickPath,
      absolutePath: absoluteClickUrl,
      title,
      body,
    },
    android: {
      priority: "high",
      notification: {
        sound: "default",
        defaultSound: true,
        channelId: "default",
      },
    },
    webpush: {
      headers: {
        Urgency: "high",
      },
      notification: {
        title,
        body,
        icon: `${defaultWebAppUrl}/logo192.png`,
        badge: `${defaultWebAppUrl}/logo192.png`,
        tag: `amayan-${payloadData.type || "notification"}`,
        renotify: true,
        requireInteraction: false,
      },
      fcmOptions: {
        link: absoluteClickUrl,
      },
    },
  };

  const chunks = [];
  for (let i = 0; i < tokens.length; i += 500) {
    chunks.push(tokens.slice(i, i + 500));
  }

  let sent = 0;
  for (const chunk of chunks) {
    const result = await admin.messaging().sendEachForMulticast({ ...message, tokens: chunk });
    sent += Number(result.successCount || 0);
  }

  return { sent, users: uniqueUserIds.length };
};

const createRiderApplicationReference = () => {
  const randomNumber = Math.floor(10000 + Math.random() * 90000);
  const suffix = Math.random().toString(36).slice(2, 4).toUpperCase();
  return `PR-${randomNumber}-${suffix}`;
};

const pickConfigValue = (...values) => {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const trimmedValue = String(value).trim();
    if (trimmedValue) return trimmedValue;
  }

  return "";
};

const getWebAppUrl = () =>
  pickConfigValue(
    process.env.WEB_APP_URL,
    process.env.FRONTEND_URL,
    "https://lutz1.github.io/damayan-savings"
  ).replace(/\/$/, "");

const getMailTransporter = () => {
  let runtimeConfig = {};

  try {
    runtimeConfig = typeof functions.config === "function" ? functions.config() || {} : {};
  } catch (error) {
    runtimeConfig = {};
  }

  const smtpConfig = runtimeConfig.smtp || {};
  const mailConfig = runtimeConfig.mail || {};

  const service = pickConfigValue(
    process.env.SMTP_SERVICE,
    process.env.MAIL_SERVICE,
    process.env.EMAIL_SERVICE,
    smtpConfig.service,
    mailConfig.service
  );
  const host = pickConfigValue(
    process.env.SMTP_HOST,
    process.env.MAIL_HOST,
    process.env.EMAIL_HOST,
    smtpConfig.host,
    mailConfig.host
  );
  const user = pickConfigValue(
    process.env.SMTP_USER,
    process.env.MAIL_USER,
    process.env.EMAIL_USER,
    process.env.GMAIL_USER,
    smtpConfig.user,
    mailConfig.user
  );
  const pass = pickConfigValue(
    process.env.SMTP_PASS,
    process.env.MAIL_PASS,
    process.env.EMAIL_PASS,
    process.env.GMAIL_APP_PASSWORD,
    smtpConfig.pass,
    mailConfig.pass
  );
  const from = pickConfigValue(
    process.env.SMTP_FROM,
    process.env.MAIL_FROM,
    process.env.EMAIL_FROM,
    smtpConfig.from,
    mailConfig.from,
    user
  );
  const port = Number(
    pickConfigValue(
      process.env.SMTP_PORT,
      process.env.MAIL_PORT,
      process.env.EMAIL_PORT,
      smtpConfig.port,
      mailConfig.port,
      service ? "0" : "587"
    )
  );
  const secure =
    pickConfigValue(
      process.env.SMTP_SECURE,
      process.env.MAIL_SECURE,
      process.env.EMAIL_SECURE,
      smtpConfig.secure,
      mailConfig.secure
    ).toLowerCase() === "true" || port === 465;

  if (!user || !pass || (!service && !host)) {
    return {
      transporter: null,
      from: from || user,
      reason: "SMTP is not configured in Firebase Functions yet.",
    };
  }

  const transporter = service
    ? nodemailer.createTransport({ service, auth: { user, pass } })
    : nodemailer.createTransport({ host, port, secure, auth: { user, pass } });

  return {
    transporter,
    from: from || user,
    reason: "",
  };
};

const sendRiderApplicationEmail = async ({ toEmail, applicantName, referenceNo, reviewEta = "3-5 business days" }) => {
  const mailer = getMailTransporter();
  if (!mailer?.transporter) {
    const reason = String(mailer?.reason || "SMTP is not configured in Firebase Functions yet.");
    console.warn(`[submitRiderApplication] ${reason} Skipping confirmation email.`);
    return { sent: false, skipped: true, reason };
  }

  const safeName = String(applicantName || "Applicant").trim() || "Applicant";
  const reviewPath = getWebAppUrl();
  const subject = "Plezz Rider Application Received";
  const text = [
    `Hello ${safeName},`,
    "",
    "Thank you for applying to Plezz Rider.",
    `Your application reference is ${referenceNo}.`,
    `Estimated review time: ${reviewEta}.`,
    "",
    "Our underwriting team is now reviewing your application details.",
    `You can return to the app here: ${reviewPath}`,
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;background:#f8fbff;padding:24px;color:#0f172a;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:24px;border:1px solid #dbe4f0;">
        <div style="font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#2563eb;">Plezz Rider</div>
        <h2 style="margin:12px 0 8px;font-size:24px;line-height:1.2;">You're all set!</h2>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#475569;">Hello ${safeName}, thank you for applying to Plezz Rider. Our underwriting team is reviewing your profile.</p>
        <div style="background:linear-gradient(180deg,#1e67da 0%,#1357c4 100%);border-radius:14px;padding:16px;color:#ffffff;margin-bottom:16px;">
          <div style="font-size:11px;opacity:.82;margin-bottom:4px;">APPLICATION ID</div>
          <div style="font-size:24px;font-weight:800;letter-spacing:.02em;">${referenceNo}</div>
        </div>
        <div style="background:#f8fbff;border-radius:12px;padding:12px 14px;margin-bottom:16px;font-size:14px;color:#334155;">
          <strong>Estimated review time:</strong> ${reviewEta}
        </div>
        <p style="margin:0;font-size:13px;line-height:1.6;color:#475569;">We’ll email you once your application has been verified by our team.</p>
      </div>
    </div>
  `;

  const info = await mailer.transporter.sendMail({
    from: mailer.from.includes("<") ? mailer.from : `Plezz Rider <${mailer.from}>`,
    to: toEmail,
    subject,
    text,
    html,
  });

  return {
    sent: true,
    messageId: info.messageId || "",
    reason: "",
  };
};

const sendRiderApprovalEmail = async ({
  toEmail,
  applicantName,
  riderId,
  defaultPassword = DEFAULT_RESET_PASSWORD,
  reviewRemarks = "",
}) => {
  const mailer = getMailTransporter();
  if (!mailer?.transporter) {
    const reason = String(mailer?.reason || "SMTP is not configured in Firebase Functions yet.");
    console.warn(`[reviewRiderApplication] ${reason} Skipping approval email.`);
    return { sent: false, skipped: true, reason };
  }

  const safeName = String(applicantName || "Rider").trim() || "Rider";
  const loginUrl = `${getWebAppUrl()}/rider/login`;
  const safeRemarks = String(reviewRemarks || "").trim();
  const subject = "Plezz Rider Application Approved";
  const text = [
    `Hello ${safeName},`,
    "",
    "Congratulations! Your Plezz Rider application has been approved.",
    `Rider ID: ${riderId}`,
    `Temporary password: ${defaultPassword}`,
    safeRemarks ? `Review remarks: ${safeRemarks}` : "",
    "",
    `Log in here: ${loginUrl}`,
    "For security, please change your password after your first login.",
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;background:#f8fbff;padding:24px;color:#0f172a;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;padding:24px;border:1px solid #dbe4f0;">
        <div style="font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#16a34a;">Plezz Rider Approved</div>
        <h2 style="margin:12px 0 8px;font-size:24px;line-height:1.2;">Welcome aboard, ${safeName}!</h2>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#475569;">Your rider application has been approved. You can now sign in using the credentials below.</p>
        <div style="background:linear-gradient(180deg,#16a34a 0%,#15803d 100%);border-radius:14px;padding:16px;color:#ffffff;margin-bottom:12px;">
          <div style="font-size:11px;opacity:.82;margin-bottom:4px;">RIDER ID</div>
          <div style="font-size:24px;font-weight:800;letter-spacing:.02em;">${riderId}</div>
        </div>
        <div style="background:#f8fbff;border-radius:12px;padding:12px 14px;margin-bottom:12px;font-size:14px;color:#334155;">
          <strong>Temporary password:</strong> ${defaultPassword}
        </div>
        ${safeRemarks ? `<div style="background:#fff7ed;border-radius:12px;padding:12px 14px;margin-bottom:12px;font-size:13px;color:#9a3412;"><strong>Review remarks:</strong> ${safeRemarks}</div>` : ""}
        <div style="margin-top:16px;">
          <a href="${loginUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 16px;border-radius:10px;font-weight:700;">Open Rider Login</a>
        </div>
        <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#64748b;">Please change your password after your first login for account security.</p>
      </div>
    </div>
  `;

  const info = await mailer.transporter.sendMail({
    from: mailer.from.includes("<") ? mailer.from : `Plezz Rider <${mailer.from}>`,
    to: toEmail,
    subject,
    text,
    html,
  });

  return {
    sent: true,
    messageId: info.messageId || "",
    reason: "",
  };
};

const attemptRiderApplicationEmail = async ({ applicationRef, toEmail, applicantName, referenceNo, reviewEta, logLabel = "submitRiderApplication" }) => {
  try {
    const mailResult = await sendRiderApplicationEmail({
      toEmail,
      applicantName,
      referenceNo,
      reviewEta,
    });

    const emailSent = Boolean(mailResult?.sent);
    const emailError = emailSent ? "" : String(mailResult?.reason || "").trim();

    if (applicationRef) {
      const updatePayload = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (emailSent) {
        updatePayload.emailSent = true;
        updatePayload.emailSentAt = admin.firestore.FieldValue.serverTimestamp();
        updatePayload.emailError = admin.firestore.FieldValue.delete();
      } else if (emailError) {
        updatePayload.emailSent = false;
        updatePayload.emailError = emailError;
      }

      await applicationRef.update(updatePayload);
    }

    return { emailSent, emailError };
  } catch (error) {
    const emailError = String(error?.message || "Confirmation email could not be sent.").trim();
    console.error(`[${logLabel}] Email warning:`, error);

    if (applicationRef) {
      await applicationRef.update({
        emailSent: false,
        emailError,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    return { emailSent: false, emailError };
  }
};

const createUniqueRiderId = async () => {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = `RIDER-${Math.floor(100000 + Math.random() * 900000)}`;
    const existingSnap = await db.collection("users").where("riderId", "==", candidate).limit(1).get();
    if (existingSnap.empty) {
      return candidate;
    }
  }

  return `RIDER-${Date.now().toString().slice(-8)}`;
};

const buildRiderAuthEmail = (riderId = "") => {
  const localPart = String(riderId || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

  return `${localPart || `rider${Date.now()}`}@plezzrider.local`;
};

exports.checkMemberEmail = functions.https.onCall(async (data) => {
  const safeEmail = String(data?.email || "").trim().toLowerCase();

  if (!safeEmail || !/^\S+@\S+\.\S+$/.test(safeEmail)) {
    throw new functions.https.HttpsError("invalid-argument", "Valid email is required.");
  }

  let exists = false;
  let role = null;
  let hasExistingApplication = false;
  let existingApplicationStatus = "";
  let existingReferenceNo = "";

  try {
    const userRecord = await admin.auth().getUserByEmail(safeEmail);
    exists = Boolean(userRecord?.uid);

    if (userRecord?.uid) {
      const userSnap = await db.collection("users").doc(userRecord.uid).get();
      if (userSnap.exists) {
        role = userSnap.data()?.role || null;
      }
    }
  } catch (error) {
    if (error?.code !== "auth/user-not-found") {
      console.error("[checkMemberEmail] ❌ Auth lookup failed:", error);
      throw new functions.https.HttpsError("internal", "Unable to verify email right now.");
    }
  }

  if (!exists) {
    const profileQuery = await db.collection("users").where("email", "==", safeEmail).limit(1).get();
    if (!profileQuery.empty) {
      exists = true;
      role = profileQuery.docs[0].data()?.role || null;
    }
  }

  const riderApplicationsSnap = await db.collection("riderApplications").where("memberEmail", "==", safeEmail).limit(10).get();
  const existingPending = riderApplicationsSnap.docs.find((docSnap) => {
    const status = String(docSnap.data()?.status || "").toUpperCase();
    return ["SUBMITTED", "UNDER_REVIEW", "PENDING", "APPROVED"].includes(status);
  });

  if (existingPending) {
    const existingData = existingPending.data() || {};
    hasExistingApplication = true;
    existingApplicationStatus = String(existingData.status || "UNDER_REVIEW").toUpperCase();
    existingReferenceNo = String(existingData.referenceNo || "").trim();
  }

  return {
    exists,
    role,
    hasExistingApplication,
    existingApplicationStatus,
    existingReferenceNo,
  };
});

exports.submitRiderApplication = functions.https.onCall(async (data, context) => {
  const applicant = data?.applicant || {};
  const vehicle = data?.vehicle || {};
  const verification = data?.verification || {};
  const documents = data?.documents || {};
  const safeEmail = String(applicant.email || "").trim().toLowerCase();
  const safePhone = String(applicant.phone || "").trim();
  const referenceNo = createRiderApplicationReference();
  const reviewEta = "3-5 business days";
  const fullName = String(applicant.fullName || [applicant.firstName, applicant.middleName, applicant.lastName, applicant.extName].filter(Boolean).join(" ")).trim();

  if (!safeEmail || !/^\S+@\S+\.\S+$/.test(safeEmail)) {
    throw new functions.https.HttpsError("invalid-argument", "A valid email address is required.");
  }

  if (!/^09\d{9}$/.test(safePhone)) {
    throw new functions.https.HttpsError("invalid-argument", "A valid 11-digit phone number is required.");
  }

  if (!String(applicant.firstName || applicant.fullName || "").trim() || !String(applicant.lastName || "").trim()) {
    throw new functions.https.HttpsError("invalid-argument", "Applicant first name and last name are required.");
  }

  if (!String(vehicle.vehicleType || "").trim() || !String(vehicle.model || "").trim() || !String(vehicle.plateNumber || "").trim()) {
    throw new functions.https.HttpsError("invalid-argument", "Vehicle details are incomplete.");
  }

  let memberUid = context.auth?.uid || "";
  let memberProfile = {};

  try {
    const authUser = await admin.auth().getUserByEmail(safeEmail);
    if (authUser?.uid) {
      memberUid = memberUid || authUser.uid;
      const memberSnap = await db.collection("users").doc(authUser.uid).get();
      if (memberSnap.exists) {
        memberProfile = memberSnap.data() || {};
      }
    }
  } catch (error) {
    if (error?.code !== "auth/user-not-found") {
      console.error("[submitRiderApplication] ❌ Auth lookup failed:", error);
      throw new functions.https.HttpsError("internal", "Unable to verify the member email right now.");
    }
  }

  if (!memberUid) {
    const profileQuery = await db.collection("users").where("email", "==", safeEmail).limit(1).get();
    if (!profileQuery.empty) {
      memberUid = profileQuery.docs[0].id;
      memberProfile = profileQuery.docs[0].data() || {};
    }
  }

  if (!memberUid && !memberProfile?.email) {
    throw new functions.https.HttpsError("not-found", "The email used in Step 1 is not registered as a member.");
  }

  const existingApps = await db.collection("riderApplications").where("memberEmail", "==", safeEmail).limit(5).get();
  const existingPending = existingApps.docs.find((docSnap) => {
    const status = String(docSnap.data()?.status || "").toUpperCase();
    return ["SUBMITTED", "UNDER_REVIEW", "PENDING"].includes(status);
  });

  if (existingPending) {
    const existingData = existingPending.data() || {};
    let emailSent = Boolean(existingData.emailSent);
    let emailError = String(existingData.emailError || "").trim();

    if (!emailSent) {
      const retryResult = await attemptRiderApplicationEmail({
        applicationRef: existingPending.ref,
        toEmail: safeEmail,
        applicantName: existingData.applicant?.fullName || fullName || "Applicant",
        referenceNo: existingData.referenceNo || referenceNo,
        reviewEta: existingData.reviewEta || reviewEta,
        logLabel: "submitRiderApplication:duplicate",
      });

      emailSent = retryResult.emailSent;
      emailError = retryResult.emailError;
    }

    return {
      success: true,
      duplicate: true,
      applicationId: existingPending.id,
      referenceNo: existingData.referenceNo || referenceNo,
      reviewEta: existingData.reviewEta || reviewEta,
      emailSent,
      emailError,
      status: existingData.status || "UNDER_REVIEW",
    };
  }
  const normalizedDocuments = Object.entries(documents || {}).reduce((accumulator, [key, value]) => {
    accumulator[key] = {
      name: String(value?.name || ""),
      type: String(value?.type || ""),
      downloadUrl: String(value?.downloadUrl || ""),
      storagePath: String(value?.storagePath || ""),
      scannedData: value?.scannedData || {},
    };
    return accumulator;
  }, {});

  const payload = {
    referenceNo,
    memberUid: memberUid || null,
    memberEmail: safeEmail,
    memberRole: String(memberProfile?.role || "MEMBER").toUpperCase(),
    memberUsername: String(memberProfile?.username || ""),
    status: "UNDER_REVIEW",
    reviewEta,
    submittedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    applicant: {
      firstName: String(applicant.firstName || "").trim(),
      middleName: String(applicant.middleName || "").trim(),
      lastName: String(applicant.lastName || "").trim(),
      extName: String(applicant.extName || "").trim(),
      fullName,
      email: safeEmail,
      phone: safePhone,
      birthDate: String(applicant.birthDate || "").trim(),
    },
    vehicle: {
      vehicleType: String(vehicle.vehicleType || "").trim(),
      model: String(vehicle.model || "").trim(),
      year: String(vehicle.year || "").trim(),
      plateNumber: String(vehicle.plateNumber || "").trim(),
      registrationExpiry: String(vehicle.registrationExpiry || "").trim(),
    },
    verification: {
      emailStatus: String(verification.emailStatus || "").trim(),
      faceMatchStatus: String(verification.faceMatchStatus || "").trim(),
      faceMatchMessage: String(verification.faceMatchMessage || "").trim(),
    },
    documents: normalizedDocuments,
    source: "rider-application-page",
    emailSent: false,
  };

  const applicationRef = await db.collection("riderApplications").add(payload);

  if (memberUid) {
    try {
      await db.collection("notifications").add({
        userId: memberUid,
        title: "Rider application submitted",
        message: `Your rider application (${referenceNo}) is now under review. Estimated review time is ${reviewEta}.`,
        type: "rider-application-submitted",
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        path: "/member/dashboard",
        referenceNo,
      });

      await sendPushToUsers({
        userIds: [memberUid],
        title: "Rider application submitted",
        body: `Application ${referenceNo} is under review (${reviewEta}).`,
        data: {
          type: "rider-application-submitted",
          path: "/member/dashboard",
          referenceNo,
        },
      });
    } catch (notificationError) {
      console.warn("[submitRiderApplication] Notification warning:", notificationError);
    }
  }

  const emailResult = await attemptRiderApplicationEmail({
    applicationRef,
    toEmail: safeEmail,
    applicantName: fullName || "Applicant",
    referenceNo,
    reviewEta,
  });

  return {
    success: true,
    applicationId: applicationRef.id,
    referenceNo,
    reviewEta,
    emailSent: emailResult.emailSent,
    emailError: emailResult.emailError,
    status: "UNDER_REVIEW",
  };
});

exports.reviewRiderApplication = functions.https.onCall(async (data, context) => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
  }

  const applicationId = String(data?.applicationId || "").trim();
  const reviewStatus = normalizeStatus(data?.status || "UNDER_REVIEW");
  const reviewRemarks = String(data?.reviewRemarks || "").trim();

  if (!applicationId) {
    throw new functions.https.HttpsError("invalid-argument", "Application ID is required.");
  }

  if (!["UNDER_REVIEW", "APPROVED", "REJECTED"].includes(reviewStatus)) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid rider application status.");
  }

  const reviewerSnap = await db.collection("users").doc(context.auth.uid).get();
  const reviewerData = reviewerSnap.exists ? reviewerSnap.data() || {} : {};
  const reviewerRole = normalizeStatus(reviewerData.role || "");

  if (!["ADMIN", "CEO", "SUPERADMIN"].includes(reviewerRole)) {
    throw new functions.https.HttpsError("permission-denied", "Not authorized to review rider applications.");
  }

  if (reviewStatus === "APPROVED" && !["CEO", "SUPERADMIN"].includes(reviewerRole)) {
    throw new functions.https.HttpsError("permission-denied", "Only SUPERADMIN or CEO can approve and generate Rider ID access.");
  }

  const applicationRef = db.collection("riderApplications").doc(applicationId);
  const applicationSnap = await applicationRef.get();

  if (!applicationSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Rider application not found.");
  }

  const applicationData = applicationSnap.data() || {};
  const applicantName = String(applicationData.applicant?.fullName || "Rider Applicant").trim() || "Rider Applicant";
  const memberEmail = String(applicationData.memberEmail || applicationData.applicant?.email || "").trim().toLowerCase();
  const memberUid = String(applicationData.memberUid || "").trim();

  const updatePayload = {
    status: reviewStatus,
    reviewRemarks,
    reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
    reviewedByUid: context.auth.uid,
    reviewedByRole: reviewerRole,
    reviewedByEmail: String(context.auth.token.email || reviewerData.email || "").trim(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  let generatedRider = null;
  let approvalEmailSent = false;
  let approvalEmailError = "";

  if (reviewStatus === "APPROVED") {
    const riderId = String(applicationData.riderId || "").trim() || await createUniqueRiderId();
    const riderLoginEmail = String(applicationData.riderLoginEmail || "").trim() || buildRiderAuthEmail(riderId);
    let riderUid = String(applicationData.riderUid || "").trim();
    let authRecord = null;

    if (riderUid) {
      try {
        authRecord = await admin.auth().getUser(riderUid);
      } catch (_error) {
        authRecord = null;
      }
    }

    if (!authRecord) {
      try {
        authRecord = await admin.auth().getUserByEmail(riderLoginEmail);
      } catch (_error) {
        authRecord = null;
      }
    }

    if (authRecord?.uid) {
      riderUid = authRecord.uid;
      await admin.auth().updateUser(riderUid, {
        email: riderLoginEmail,
        password: DEFAULT_RESET_PASSWORD,
        displayName: applicantName,
      });
    } else {
      const createdAuthUser = await admin.auth().createUser({
        email: riderLoginEmail,
        password: DEFAULT_RESET_PASSWORD,
        displayName: applicantName,
      });
      riderUid = createdAuthUser.uid;
    }

    await db.collection("users").doc(riderUid).set(
      {
        uid: riderUid,
        role: "RIDER",
        riderId,
        username: riderId,
        name: applicantName,
        fullName: applicantName,
        email: riderLoginEmail,
        loginEmail: riderLoginEmail,
        contactEmail: memberEmail,
        linkedMemberEmail: memberEmail,
        linkedMemberUid: memberUid || null,
        contactNumber: String(applicationData.applicant?.phone || "").trim(),
        phone: String(applicationData.applicant?.phone || "").trim(),
        address: String(applicationData.applicant?.address || "").trim(),
        riderApplicationId: applicationId,
        riderApplicationReferenceNo: String(applicationData.referenceNo || "").trim(),
        riderApplicationStatus: "APPROVED",
        vehicleInfo: applicationData.vehicle || {},
        createdAt: applicationData.approvedAt || admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    updatePayload.approvedAt = admin.firestore.FieldValue.serverTimestamp();
    updatePayload.riderUid = riderUid;
    updatePayload.riderId = riderId;
    updatePayload.riderLoginEmail = riderLoginEmail;
    updatePayload.riderPasswordReady = true;

    generatedRider = {
      riderUid,
      riderId,
      riderLoginEmail,
      defaultPassword: DEFAULT_RESET_PASSWORD,
    };

    if (memberUid) {
      try {
        await db.collection("notifications").add({
          userId: memberUid,
          title: "Rider application approved",
          message: `Your rider application has been approved. Rider ID: ${riderId}. Default password: ${DEFAULT_RESET_PASSWORD}.`,
          type: "rider-application-approved",
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          path: "/rider/login",
          riderId,
        });

        await sendPushToUsers({
          userIds: [memberUid],
          title: "Rider application approved",
          body: `Rider ID: ${riderId}. Default password: ${DEFAULT_RESET_PASSWORD}.`,
          data: {
            type: "RIDER_APPLICATION_APPROVED",
            riderId,
            path: "/rider/login",
          },
        });
      } catch (notificationError) {
        console.warn("[reviewRiderApplication] notification warning:", notificationError);
      }
    }

    if (memberEmail) {
      try {
        const mailResult = await sendRiderApprovalEmail({
          toEmail: memberEmail,
          applicantName,
          riderId,
          defaultPassword: DEFAULT_RESET_PASSWORD,
          reviewRemarks,
        });

        approvalEmailSent = Boolean(mailResult?.sent);
        approvalEmailError = approvalEmailSent ? "" : String(mailResult?.reason || "").trim();
      } catch (emailError) {
        approvalEmailSent = false;
        approvalEmailError = String(emailError?.message || "Approval email could not be sent.").trim();
        console.error("[reviewRiderApplication] approval email warning:", emailError);
      }
    } else {
      approvalEmailSent = false;
      approvalEmailError = "Applicant email is missing.";
    }

    if (approvalEmailSent) {
      updatePayload.approvalEmailSent = true;
      updatePayload.approvalEmailSentAt = admin.firestore.FieldValue.serverTimestamp();
      updatePayload.approvalEmailError = admin.firestore.FieldValue.delete();
    } else if (approvalEmailError) {
      updatePayload.approvalEmailSent = false;
      updatePayload.approvalEmailError = approvalEmailError;
    }
  }

  await applicationRef.set(updatePayload, { merge: true });

  return {
    success: true,
    applicationId,
    status: reviewStatus,
    riderId: generatedRider?.riderId || String(applicationData.riderId || "").trim(),
    defaultPassword: generatedRider?.defaultPassword || "",
    generatedRider,
    approvalEmailSent,
    approvalEmailError,
  };
});

exports.processDepositApproval = functions.https.onCall(async (data, context) => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
  }

  const depositId = String(data?.depositId || "").trim();
  const action = String(data?.action || "").trim().toLowerCase();
  const remarks = String(data?.remarks || "").trim();

  if (!depositId) {
    throw new functions.https.HttpsError("invalid-argument", "Deposit ID is required.");
  }

  if (!["approved", "rejected"].includes(action)) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid deposit action.");
  }

  const reviewerRef = db.collection("users").doc(context.auth.uid);
  const reviewerSnap = await reviewerRef.get();
  const reviewerData = reviewerSnap.exists ? reviewerSnap.data() || {} : {};
  const reviewerRole = String(reviewerData.role || "").toUpperCase();

  if (!["ADMIN", "CEO", "SUPERADMIN"].includes(reviewerRole)) {
    throw new functions.https.HttpsError("permission-denied", "Not authorized to review deposits.");
  }

  let notificationPayload = null;

  const result = await db.runTransaction(async (transaction) => {
    const depositRef = db.collection("deposits").doc(depositId);
    const depositSnap = await transaction.get(depositRef);

    if (!depositSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Deposit request not found.");
    }

    const depositData = depositSnap.data() || {};
    const currentStatus = String(depositData.status || "pending").toLowerCase();
    if (currentStatus !== "pending") {
      throw new functions.https.HttpsError("failed-precondition", "Deposit has already been reviewed.");
    }

    const depositUserId = String(depositData.userId || "").trim();
    if (!depositUserId) {
      throw new functions.https.HttpsError("failed-precondition", "Deposit request has no user ID.");
    }

    const updateData = {
      status: action,
      remarks,
      reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
      reviewedByUid: context.auth.uid,
      reviewedByEmail: context.auth.token.email || reviewerData.email || "",
      reviewedByUsername: reviewerData.username || reviewerData.name || "",
      reviewedByRole: reviewerRole,
    };

    let creditedAmount = 0;
    let userRef = null;
    let nextBalance = null;
    if (action === "approved") {
      userRef = db.collection("users").doc(depositUserId);
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Deposit user not found.");
      }

      const userData = userSnap.data() || {};
      const currentBalance = Number(userData.eWallet);
      const depositAmount = Number(depositData.netAmount || depositData.amount || 0);
      const safeBalance = Number.isFinite(currentBalance) ? currentBalance : 0;
      creditedAmount = Number.isFinite(depositAmount) ? depositAmount : 0;
      nextBalance = safeBalance + creditedAmount;
    }

    transaction.update(depositRef, updateData);

    if (action === "approved" && userRef) {
      transaction.update(userRef, {
        eWallet: nextBalance,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    notificationPayload = {
      userId: depositUserId,
      depositId,
      action,
      remarks,
      depositType: String(depositData.type || "Deposit").trim() || "Deposit",
      partner: String(depositData.partner || depositData.paymentMethod || "Cash In").trim() || "Cash In",
      referenceNumber: String(depositData.referenceNumber || "").trim(),
      amount: Number(depositData.amount || 0),
      charge: Number(depositData.charge || 0),
      netAmount: Number(depositData.netAmount || creditedAmount || depositData.amount || 0),
    };

    return {
      success: true,
      status: action,
      creditedAmount,
    };
  });

  if (notificationPayload?.userId) {
    const isCashIn = notificationPayload.depositType.toLowerCase().includes("cash in");
    const title = action === "approved"
      ? (isCashIn ? "Cash In Approved" : "Deposit Approved")
      : (isCashIn ? "Cash In Rejected" : "Deposit Rejected");
    const netAmountLabel = Number(notificationPayload.netAmount || 0).toLocaleString("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const message = action === "approved"
      ? `Your ${notificationPayload.depositType} via ${notificationPayload.partner} was approved. ${netAmountLabel} has been credited to your E-Wallet.`
      : `Your ${notificationPayload.depositType} via ${notificationPayload.partner} was rejected.${remarks ? ` Remarks: ${remarks}` : " Please review your receipt details and try again."}`;

    try {
      await db.collection("notifications").add({
        userId: notificationPayload.userId,
        title,
        message,
        type: action === "approved" ? "cash-in-approved" : "cash-in-rejected",
        read: false,
        depositId: notificationPayload.depositId,
        referenceNumber: notificationPayload.referenceNumber,
        amount: notificationPayload.amount,
        charge: notificationPayload.charge,
        netAmount: notificationPayload.netAmount,
        status: action,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await sendPushToUsers({
        userIds: [notificationPayload.userId],
        title,
        body: message,
        data: {
          type: action === "approved" ? "CASH_IN_APPROVED" : "CASH_IN_REJECTED",
          depositId: notificationPayload.depositId,
          status: action.toUpperCase(),
          path: "/member/cash-in",
        },
      });
    } catch (notificationError) {
      console.error("[processDepositApproval] notification error:", notificationError);
    }
  }

  return result;
});

exports.processWithdrawalApproval = functions.https.onCall(async (data, context) => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
  }

  const withdrawalId = String(data?.withdrawalId || "").trim();
  const action = String(data?.action || "").trim().toLowerCase();
  const remarks = String(data?.remarks || "").trim();

  if (!withdrawalId) {
    throw new functions.https.HttpsError("invalid-argument", "Withdrawal ID is required.");
  }

  if (!["approved", "rejected"].includes(action)) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid withdrawal action.");
  }

  const reviewerRef = db.collection("users").doc(context.auth.uid);
  const reviewerSnap = await reviewerRef.get();
  const reviewerData = reviewerSnap.exists ? reviewerSnap.data() || {} : {};
  const reviewerRole = String(reviewerData.role || "").toUpperCase();
  const reviewerEmail = String(context.auth.token.email || reviewerData.email || "").trim().toLowerCase();
  const restrictedEmails = ["admin1@gmail.com", "admin2@gmail.com"];

  if (!["SUPERADMIN", "CEO"].includes(reviewerRole) || restrictedEmails.includes(reviewerEmail)) {
    throw new functions.https.HttpsError("permission-denied", "Not authorized to review withdrawals.");
  }

  let notificationPayload = null;

  const result = await db.runTransaction(async (transaction) => {
    const withdrawalRef = db.collection("withdrawals").doc(withdrawalId);
    const withdrawalSnap = await transaction.get(withdrawalRef);

    if (!withdrawalSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Withdrawal request not found.");
    }

    const withdrawalData = withdrawalSnap.data() || {};
    const currentStatus = String(withdrawalData.status || "pending").toLowerCase();
    if (currentStatus !== "pending") {
      throw new functions.https.HttpsError("failed-precondition", "Withdrawal has already been reviewed.");
    }

    const withdrawalUserId = String(withdrawalData.userId || "").trim();
    if (!withdrawalUserId) {
      throw new functions.https.HttpsError("failed-precondition", "Withdrawal request has no user ID.");
    }

    const amount = Number(withdrawalData.amount || 0);
    const charge = Number(withdrawalData.charge || 0);
    const totalDeduction = Number(withdrawalData.totalDeduction || (amount + charge));
    const netAmount = Number(withdrawalData.netAmount || amount);

    let userRef = null;
    let refundBalance = null;
    if (action === "rejected") {
      userRef = db.collection("users").doc(withdrawalUserId);
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Withdrawal user not found.");
      }

      const userData = userSnap.data() || {};
      const currentBalance = Number(userData.eWallet || 0);
      refundBalance = currentBalance + totalDeduction;
    }

    const updateData = {
      status: action,
      remarks,
      reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
      reviewedByUid: context.auth.uid,
      reviewedByEmail: context.auth.token.email || reviewerData.email || "",
      reviewedByUsername: reviewerData.username || reviewerData.name || "",
      reviewedByRole: reviewerRole,
    };

    transaction.update(withdrawalRef, updateData);

    if (action === "rejected" && userRef) {
      transaction.update(userRef, {
        eWallet: refundBalance,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    notificationPayload = {
      userId: withdrawalUserId,
      withdrawalId,
      action,
      remarks,
      amount,
      charge,
      netAmount,
      paymentMethod: String(withdrawalData.paymentMethod || "Withdrawal").trim() || "Withdrawal",
      referenceNumber: String(withdrawalData.referenceNumber || withdrawalId).trim() || withdrawalId,
    };

    return {
      success: true,
      status: action,
      refundedAmount: action === "rejected" ? amount : 0,
    };
  });

  if (notificationPayload?.userId) {
    const formattedAmount = Number(notificationPayload.amount || 0).toLocaleString("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const title = action === "approved" ? "Withdrawal Approved" : "Withdrawal Rejected";
    const message = action === "approved"
      ? `Your withdrawal of ${formattedAmount} via ${notificationPayload.paymentMethod} has been approved and is now being processed.`
      : `Your withdrawal of ${formattedAmount} via ${notificationPayload.paymentMethod} was rejected.${remarks ? ` Remarks: ${remarks}` : " The full deducted amount has been returned to your wallet."}`;

    try {
      await db.collection("notifications").add({
        userId: notificationPayload.userId,
        title,
        message,
        type: action === "approved" ? "withdrawal-approved" : "withdrawal-rejected",
        read: false,
        withdrawalId: notificationPayload.withdrawalId,
        referenceNumber: notificationPayload.referenceNumber,
        amount: notificationPayload.amount,
        charge: notificationPayload.charge,
        netAmount: notificationPayload.netAmount,
        paymentMethod: notificationPayload.paymentMethod,
        status: action,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await sendPushToUsers({
        userIds: [notificationPayload.userId],
        title,
        body: message,
        data: {
          type: action === "approved" ? "WITHDRAWAL_APPROVED" : "WITHDRAWAL_REJECTED",
          withdrawalId: notificationPayload.withdrawalId,
          status: action.toUpperCase(),
          path: "/member/dashboard",
        },
      });
    } catch (notificationError) {
      console.error("[processWithdrawalApproval] notification error:", notificationError);
    }
  }

  return result;
});

exports.submitCashInRequest = functions.https.onCall(async (data, context) => {
  if (!context.auth?.uid) {
    throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
  }

  const userId = String(context.auth.uid || "").trim();
  const numAmount = Number(data?.amount || 0);
  const paymentMethod = String(data?.paymentMethod || "Manual").trim() || "Manual";
  const partnerName = String(data?.partner || paymentMethod || "Cash In Partner").trim() || "Cash In Partner";
  const qrName = String(data?.qrName || partnerName).trim() || partnerName;
  const receiptUrl = String(data?.receiptUrl || "").trim();
  const receiptName = String(data?.receiptName || "").trim();
  const source = String(data?.source || "manual").trim() || "manual";
  const clientRequestId = String(data?.clientRequestId || "").trim();
  const chargeRate = 0.015;

  if (!Number.isFinite(numAmount) || numAmount <= 0) {
    throw new functions.https.HttpsError("invalid-argument", "A valid cash in amount is required.");
  }

  const safeReferenceNumber = String(data?.referenceNumber || "").trim() || `DEP-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const charge = Number((numAmount * chargeRate).toFixed(2));
  const netAmount = Number((numAmount - charge).toFixed(2));

  return db.runTransaction(async (transaction) => {
    const userRef = db.collection("users").doc(userId);
    const userSnap = await transaction.get(userRef);

    if (!userSnap.exists) {
      throw new functions.https.HttpsError("not-found", "User not found.");
    }

    const userData = userSnap.data() || {};
    const depositRef = clientRequestId
      ? db.collection("deposits").doc(`cashin_${userId}_${clientRequestId}`)
      : db.collection("deposits").doc();

    const existingDepositSnap = await transaction.get(depositRef);
    if (existingDepositSnap.exists) {
      const existingData = existingDepositSnap.data() || {};
      return {
        success: true,
        deduped: true,
        depositId: depositRef.id,
        amount: Number(existingData.amount || numAmount),
        charge: Number(existingData.charge || charge),
        netAmount: Number(existingData.netAmount || netAmount),
        referenceNumber: existingData.referenceNumber || safeReferenceNumber,
        partnerName: existingData.partner || partnerName,
        qrName: existingData.qrName || qrName,
        status: existingData.status || "Pending",
      };
    }

    const depositName = userData.name || userData.fullName || userData.username || context.auth.token.email || "Member";
    const depositPayload = {
      userId,
      name: depositName,
      email: userData.email || context.auth.token.email || "",
      amount: numAmount,
      charge,
      chargeRate,
      netAmount,
      status: "Pending",
      type: "Cash In Request",
      paymentMethod,
      partner: partnerName,
      referenceNumber: safeReferenceNumber,
      qrName,
      receiptUrl,
      receiptName,
      source,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    transaction.set(depositRef, depositPayload);

    return {
      success: true,
      depositId: depositRef.id,
      amount: numAmount,
      charge,
      netAmount,
      referenceNumber: safeReferenceNumber,
      partnerName,
      qrName,
      status: "Pending",
    };
  });
});

exports.notifyMerchantOnNewOrder = functions.firestore
  .document("sales/{saleId}")
  .onCreate(async (snap, context) => {
    const sale = snap.data() || {};
    const status = normalizeStatus(sale.status);
    if (!["NEW", "PENDING"].includes(status)) return null;

    const merchantId = sale.merchantId;
    if (!merchantId) return null;

    await sendPushToUsers({
      userIds: [merchantId],
      title: "New Order",
      body: `You received a new order${sale.total ? ` (P${Number(sale.total).toFixed(2)})` : ""}.`,
      data: {
        type: "MERCHANT_NEW_ORDER",
        saleId: context.params.saleId,
      },
    });

    return null;
  });

exports.notifyMerchantOnNewOrderV2 = functions.firestore
  .document("orders/{orderId}")
  .onCreate(async (snap, context) => {
    const order = snap.data() || {};
    const status = normalizeStatus(order.status);
    if (!["NEW", "PENDING"].includes(status)) return null;

    const merchantId = order.merchantId;
    if (!merchantId) return null;

    await sendPushToUsers({
      userIds: [merchantId],
      title: "New Order",
      body: `You received a new order${order.total ? ` (P${Number(order.total).toFixed(2)})` : ""}.`,
      data: {
        type: "MERCHANT_NEW_ORDER",
        orderId: context.params.orderId,
      },
    });

    return null;
  });

exports.notifyOrderCancelled = functions.firestore
  .document("sales/{saleId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data() || {};
    const after = change.after.data() || {};

    const beforeStatus = normalizeStatus(before.status);
    const afterStatus = normalizeStatus(after.status);
    if (beforeStatus === afterStatus || afterStatus !== "CANCELLED") return null;

    const recipients = [after.merchantId, after.customerId].filter(Boolean);
    if (!recipients.length) return null;

    await sendPushToUsers({
      userIds: recipients,
      title: "Order Cancelled",
      body: `Order #${String(context.params.saleId).slice(-6)} has been cancelled.`,
      data: {
        type: "ORDER_CANCELLED",
        saleId: context.params.saleId,
      },
    });

    return null;
  });

exports.notifyOrderCancelledV2 = functions.firestore
  .document("orders/{orderId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data() || {};
    const after = change.after.data() || {};

    const beforeStatus = normalizeStatus(before.status);
    const afterStatus = normalizeStatus(after.status);
    if (beforeStatus === afterStatus || afterStatus !== "CANCELLED") return null;

    const recipients = [after.merchantId, after.customerId].filter(Boolean);
    if (!recipients.length) return null;

    await sendPushToUsers({
      userIds: recipients,
      title: "Order Cancelled",
      body: `Order #${String(context.params.orderId).slice(-6)} has been cancelled.`,
      data: {
        type: "ORDER_CANCELLED",
        orderId: context.params.orderId,
      },
    });

    return null;
  });

exports.notifyDeliveryLifecycle = functions.firestore
  .document("deliveries/{deliveryId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data() || {};
    const after = change.after.data() || {};

    const beforeStatus = normalizeStatus(before.status);
    const afterStatus = normalizeStatus(after.status);
    if (!afterStatus || beforeStatus === afterStatus) return null;

    if (afterStatus === "ARRIVED_MERCHANT") {
      await sendPushToUsers({
        userIds: [after.merchantId].filter(Boolean),
        title: "Rider Arrived",
        body: "Your rider has arrived for pickup.",
        data: {
          type: "RIDER_ARRIVED",
          deliveryId: context.params.deliveryId,
          orderId: after.orderId || "",
          saleId: after.saleId || "",
        },
      });
      return null;
    }

    if (afterStatus === "DELIVERED") {
      await sendPushToUsers({
        userIds: [after.merchantId, after.customerId].filter(Boolean),
        title: "Order Delivered",
        body: "The order has been delivered successfully.",
        data: {
          type: "ORDER_DELIVERED",
          deliveryId: context.params.deliveryId,
          orderId: after.orderId || "",
          saleId: after.saleId || "",
        },
      });
    }

    return null;
  });

// Support both Firestore snapshot APIs (exists boolean vs exists() method).
const docExists = (snap) => {
  if (!snap) return false;
  return typeof snap.exists === "function" ? snap.exists() : !!snap.exists;
};

// Initialize CORS middleware
const corsHandler = cors({ origin: true });
const setCorsHeaders = (res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
};

exports.resetUserPasswordDefault = functions.https.onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized: Missing or invalid token" });
      }

      const idToken = authHeader.substring("Bearer ".length);
      const { targetUid } = req.body || {};

      if (!targetUid) {
        return res.status(400).json({ error: "targetUid is required" });
      }

      const decoded = await admin.auth().verifyIdToken(idToken);
      const requesterSnap = await db.collection("users").doc(decoded.uid).get();
      if (!docExists(requesterSnap)) {
        return res.status(403).json({ error: "Requester profile not found" });
      }

      const requesterRole = normalizeStatus((requesterSnap.data() || {}).role);
      if (requesterRole !== "SUPERADMIN") {
        return res.status(403).json({ error: "Only SUPERADMIN can reset user passwords" });
      }

      const targetSnap = await db.collection("users").doc(String(targetUid)).get();
      if (!docExists(targetSnap)) {
        return res.status(404).json({ error: "Target user not found" });
      }

      await admin.auth().updateUser(String(targetUid), { password: DEFAULT_RESET_PASSWORD });

      return res.status(200).json({
        success: true,
        targetUid: String(targetUid),
        defaultPassword: DEFAULT_RESET_PASSWORD,
      });
    } catch (error) {
      console.error("[resetUserPasswordDefault] error:", error);
      return res.status(500).json({ error: "Failed to reset user password" });
    }
  });
});

exports.setMpin = functions.https.onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      const { idToken, mpin } = req.body || {};
      if (!idToken || !mpin) {
        return res.status(400).json({ error: "idToken and mpin are required" });
      }

      if (!/^\d{4}$/.test(String(mpin))) {
        return res.status(400).json({ error: "MPIN must be exactly 4 digits" });
      }

      const decoded = await admin.auth().verifyIdToken(String(idToken));
      const hash = await bcrypt.hash(String(mpin), 10);

      await db.collection("users").doc(decoded.uid).set(
        {
          mpinHash: hash,
          mpinSetAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return res.status(200).json({ success: true, message: "MPIN set successfully" });
    } catch (error) {
      console.error("[setMpin] error:", error);
      return res.status(500).json({ error: "Failed to set MPIN" });
    }
  });
});

exports.mpinLogin = functions.https.onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      const email = String(req.body?.email || "").trim();
      const mpin = String(req.body?.mpin || "").trim();

      if (!email || !mpin) {
        return res.status(400).json({ error: "email and mpin are required" });
      }

      if (!/^\d{4}$/.test(mpin)) {
        return res.status(400).json({ error: "MPIN must be exactly 4 digits" });
      }

      let userRecord;
      try {
        userRecord = await admin.auth().getUserByEmail(email);
      } catch (_error) {
        return res.status(401).json({ error: "Invalid email or MPIN" });
      }

      const userSnap = await db.collection("users").doc(userRecord.uid).get();
      if (!docExists(userSnap)) {
        return res.status(401).json({ error: "Invalid email or MPIN" });
      }

      const userData = userSnap.data() || {};
      if (!userData.mpinHash) {
        return res.status(401).json({ error: "MPIN not set for this account" });
      }

      const isMatch = await bcrypt.compare(mpin, String(userData.mpinHash));
      if (!isMatch) {
        return res.status(401).json({ error: "Invalid email or MPIN" });
      }

      const customToken = await admin.auth().createCustomToken(userRecord.uid);
      return res.status(200).json({
        success: true,
        customToken,
        role: normalizeStatus(userData.role || "MEMBER"),
      });
    } catch (error) {
      console.error("[mpinLogin] error:", error);
      if (error?.errorInfo?.code === "auth/insufficient-permission") {
        return res.status(500).json({
          error:
            "MPIN login is temporarily unavailable due to server IAM configuration. Please use password login while admin enables Service Account Token Creator.",
        });
      }
      return res.status(500).json({ error: "Login failed" });
    }
  });
});

exports.recoveryRequest = functions.https.onRequest(async (req, res) => {
  try {
    setCorsHeaders(res);
    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const safeEmail = String(req.body?.email || "").trim().toLowerCase();
    const requestType = normalizeStatus(req.body?.requestType);

    if (!safeEmail || !/^\S+@\S+\.\S+$/.test(safeEmail)) {
      return res.status(400).json({ error: "Valid email is required" });
    }

    if (!["PASSWORD", "MPIN"].includes(requestType)) {
      return res.status(400).json({ error: "requestType must be PASSWORD or MPIN" });
    }

    let userRecord = null;
    try {
      userRecord = await admin.auth().getUserByEmail(safeEmail);
    } catch (_error) {
      userRecord = null;
    }

    // Avoid account enumeration; still return success response.
    if (!userRecord?.uid) {
      return res.status(200).json({
        success: true,
        message: "Request submitted. If your account exists, Admin will review it shortly.",
      });
    }

    const userSnap = await db.collection("users").doc(userRecord.uid).get();
    const userData = docExists(userSnap) ? userSnap.data() || {} : {};

    const pendingSnap = await db
      .collection("accountRecoveryRequests")
      .where("uid", "==", userRecord.uid)
      .where("requestType", "==", requestType)
      .where("status", "==", "PENDING")
      .limit(1)
      .get();

    if (!pendingSnap.empty) {
      return res.status(200).json({
        success: true,
        requestId: pendingSnap.docs[0].id,
        message: "You already have a pending request. Please wait for Admin approval.",
      });
    }

    const created = await db.collection("accountRecoveryRequests").add({
      uid: userRecord.uid,
      email: safeEmail,
      username: userData.username || "",
      role: normalizeStatus(userData.role || "MEMBER"),
      requestType,
      status: "PENDING",
      requestedVia: "LOGIN",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Notify ADMIN/CEO/SUPERADMIN users so request appears in their notification bell in real-time.
    const adminsSnap = await db.collection("users").get();
    const adminRecipients = adminsSnap.docs
      .map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() || {}) }))
      .filter((userRow) => ["ADMIN", "CEO", "SUPERADMIN"].includes(normalizeStatus(userRow.role)));

    if (adminRecipients.length > 0) {
      const batch = db.batch();
      adminRecipients.forEach((adminUser) => {
        const recipientUid = String(adminUser.uid || adminUser.id || "").trim();
        const recipientDocId = String(adminUser.id || "").trim();
        if (!recipientUid && !recipientDocId) return;

        const notifRef = db.collection("notifications").doc();
        batch.set(notifRef, {
          userId: recipientUid || recipientDocId,
          recipientUid: recipientUid || recipientDocId,
          recipientDocId,
          title: requestType === "PASSWORD" ? "New Password Reset Request" : "New MPIN Reset Request",
          message: `${safeEmail} submitted a ${requestType === "PASSWORD" ? "password" : "MPIN"} recovery request.`,
          type: "info",
          read: false,
          requestId: created.id,
          requestType,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
      await batch.commit();

      const pushRecipients = [...new Set(adminRecipients.map((row) => String(row.uid || row.id || "").trim()).filter(Boolean))];
      await sendPushToUsers({
        userIds: pushRecipients,
        title: requestType === "PASSWORD" ? "New Password Reset Request" : "New MPIN Reset Request",
        body: `${safeEmail} submitted a ${requestType === "PASSWORD" ? "password" : "MPIN"} recovery request.`,
        data: {
          type: "ACCOUNT_RECOVERY_REQUEST",
          requestId: created.id,
          requestType,
          path: "/admin/password-reset-management",
        },
      });
    }

    return res.status(200).json({
      success: true,
      requestId: created.id,
      message: "Request sent to Admin successfully.",
    });
  } catch (error) {
    console.error("[recoveryRequest] error:", error);
    return res.status(500).json({ error: "Failed to submit recovery request" });
  }
});

exports.adminRecoveryRequestsList = functions.https.onRequest(async (req, res) => {
  try {
    setCorsHeaders(res);
    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { idToken } = req.body || {};
    if (!idToken) {
      return res.status(400).json({ error: "idToken is required" });
    }

    const decoded = await admin.auth().verifyIdToken(String(idToken));
    const requesterSnap = await db.collection("users").doc(decoded.uid).get();
    if (!docExists(requesterSnap)) {
      return res.status(403).json({ error: "Requester profile not found" });
    }

    const requesterRole = normalizeStatus((requesterSnap.data() || {}).role);
    if (!["SUPERADMIN", "ADMIN", "CEO"].includes(requesterRole)) {
      return res.status(403).json({ error: "Only SUPERADMIN/ADMIN/CEO can view recovery requests" });
    }

    const snap = await db
      .collection("accountRecoveryRequests")
      .orderBy("createdAt", "desc")
      .limit(500)
      .get();

    const requests = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    return res.status(200).json({ success: true, requests });
  } catch (error) {
    console.error("[adminRecoveryRequestsList] error:", error);
    return res.status(500).json({ error: "Failed to fetch recovery requests" });
  }
});

exports.adminRecoveryRequestsProcess = functions.https.onRequest(async (req, res) => {
  try {
    setCorsHeaders(res);
    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { idToken, requestId } = req.body || {};
    if (!idToken || !requestId) {
      return res.status(400).json({ error: "idToken and requestId are required" });
    }

    const decoded = await admin.auth().verifyIdToken(String(idToken));
    const requesterSnap = await db.collection("users").doc(decoded.uid).get();
    if (!docExists(requesterSnap)) {
      return res.status(403).json({ error: "Requester profile not found" });
    }

    const requesterRole = normalizeStatus((requesterSnap.data() || {}).role);
    if (requesterRole !== "SUPERADMIN") {
      return res.status(403).json({ error: "Only SUPERADMIN can process recovery requests" });
    }

    const recoveryRef = db.collection("accountRecoveryRequests").doc(String(requestId));
    const recoverySnap = await recoveryRef.get();
    if (!docExists(recoverySnap)) {
      return res.status(404).json({ error: "Recovery request not found" });
    }

    const requestData = recoverySnap.data() || {};
    const requestType = normalizeStatus(requestData.requestType);
    const status = normalizeStatus(requestData.status);
    const targetUid = String(requestData.uid || "").trim();

    if (status !== "PENDING") {
      return res.status(400).json({ error: "Recovery request is already processed" });
    }

    if (!targetUid) {
      return res.status(400).json({ error: "Recovery request has no target user" });
    }

    if (requestType === "PASSWORD") {
      await admin.auth().updateUser(targetUid, { password: DEFAULT_RESET_PASSWORD });
    } else if (requestType === "MPIN") {
      const hash = await bcrypt.hash(DEFAULT_RESET_MPIN, 10);
      await db.collection("users").doc(targetUid).set(
        {
          mpinHash: hash,
          mpinSetAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } else {
      return res.status(400).json({ error: "Unsupported request type" });
    }

    await recoveryRef.set(
      {
        status: "COMPLETED",
        processedByUid: decoded.uid,
        processedByRole: requesterRole,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        resolution:
          requestType === "PASSWORD"
            ? { type: "PASSWORD_DEFAULT", defaultPassword: DEFAULT_RESET_PASSWORD }
            : { type: "MPIN_DEFAULT", defaultMpin: DEFAULT_RESET_MPIN },
      },
      { merge: true }
    );

    await db.collection("notifications").add({
      userId: targetUid,
      title: requestType === "PASSWORD" ? "Password Reset Processed" : "MPIN Reset Processed",
      message:
        requestType === "PASSWORD"
          ? "Your password was reset by SUPERADMIN. Please login using default password and change it immediately."
          : "Your MPIN was reset by SUPERADMIN to default 1234. Please update it immediately.",
      type: "success",
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await sendPushToUsers({
      userIds: [targetUid],
      title: requestType === "PASSWORD" ? "Password Reset Processed" : "MPIN Reset Processed",
      body:
        requestType === "PASSWORD"
          ? "Your password reset is complete. Login with default password and update it now."
          : "Your MPIN reset is complete. Use default 1234 and update it now.",
      data: {
        type: "ACCOUNT_RECOVERY_PROCESSED",
        requestId: String(requestId),
        requestType,
        path: "/login",
      },
    });

    return res.status(200).json({
      success: true,
      requestId: String(requestId),
      requestType,
      defaultPassword: requestType === "PASSWORD" ? DEFAULT_RESET_PASSWORD : undefined,
      defaultMpin: requestType === "MPIN" ? DEFAULT_RESET_MPIN : undefined,
    });
  } catch (error) {
    console.error("[adminRecoveryRequestsProcess] error:", error);
    return res.status(500).json({ error: "Failed to process recovery request" });
  }
});

/**
 * Transfer Referral Reward to eWallet
 * Idempotent: Safe to retry without duplication
 */
exports.transferReferralReward = functions.https.onRequest(async (req, res) => {
  // Apply CORS middleware
  corsHandler(req, res, async () => {
    try {
      console.log("[transferReferralReward] 🔄 Request received:", req.method);

      // Only allow POST requests
      if (req.method !== "POST") {
        console.log("[transferReferralReward] Method:", req.method);
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      // Get authorization header
      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        console.error("[transferReferralReward] ❌ Missing or invalid authorization header");
        return res.status(401).json({ error: "Unauthorized: Missing or invalid token" });
      }

      const idToken = authHeader.substring("Bearer ".length);
      const { rewardId, amount } = req.body || {};

      console.log("[transferReferralReward] Input:", { rewardId, amount });

      // Validate input
      if (!rewardId || !amount) {
        console.error("[transferReferralReward] ❌ Missing required fields");
        return res.status(400).json({ error: "Missing required fields: rewardId, amount" });
      }

      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        console.error("[transferReferralReward] ❌ Invalid amount");
        return res.status(400).json({ error: "Amount must be greater than zero" });
      }

      // Verify user authentication
      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
        console.log("[transferReferralReward] ✅ User authenticated:", decodedToken.uid);
      } catch (error) {
        console.error("[transferReferralReward] ❌ Token verification failed:", error);
        return res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
      }

      const userId = decodedToken.uid;

      // Run transaction
      try {
        const result = await db.runTransaction(async (transaction) => {
          // Get the reward document
          const rewardRef = db.collection("referralReward").doc(rewardId);
          const rewardDoc = await transaction.get(rewardRef);

          if (!rewardDoc.exists) {
            throw new Error("Referral reward not found");
          }

          const rewardData = rewardDoc.data();

          // Verify reward belongs to the authenticated user
          if (rewardData.userId !== userId) {
            throw new Error("This reward does not belong to you");
          }

          // ✅ IDEMPOTENCY CHECK: If already transferred, return success
          if (rewardData.transferredAmount && rewardData.dateTransferred) {
            console.log(
              `[transferReferralReward] Reward ${rewardId} already transferred (idempotent return)`
            );
            return {
              success: true,
              alreadyTransferred: true,
              message: "This reward was already transferred",
              newBalance: rewardData.transferredAmount,
            };
          }

          // Prevent re-entry: Check if we're in the middle of transferring
          if (rewardData.transferring === true) {
            throw new Error("Transfer in progress");
          }

          // Get user document
          const userRef = db.collection("users").doc(userId);
          const userDoc = await transaction.get(userRef);

          if (!userDoc.exists) {
            throw new Error("User not found");
          }

          const userData = userDoc.data();
          const currentBalance = Number(userData.eWallet || 0);

          // Update user eWallet (add amount)
          transaction.update(userRef, {
            eWallet: currentBalance + numAmount,
            updatedAt: new Date(),
          });

          // Mark reward as transferred with all required fields
          transaction.update(rewardRef, {
            payoutReleased: true,
            dateTransferred: new Date(),
            transferredAmount: numAmount,
            transferring: false, // Clear the lock
          });

          // Create transfer log
          const logRef = db.collection("referralRewardTransferlogs").doc();
          transaction.set(logRef, {
            userId,
            rewardId,
            amount: rewardData.amount,
            transferredAmount: numAmount,
            source: rewardData.source || "Referral",
            status: "Transferred",
            createdAt: new Date(),
          });

          // Create deposit record for eWallet history
          const depositRef = db.collection("deposits").doc();
          let depositType = "Referral Reward Transfer";

          if (rewardData.source === "System Network Bonus" || numAmount === 15) {
            depositType = "System Network Bonus";
          } else if (rewardData.source === "Direct Invite Reward") {
            depositType = "Direct Invite Reward";
          } else if (rewardData.source === "Network Bonus") {
            depositType = "Network Bonus";
          }

          transaction.set(depositRef, {
            userId,
            amount: numAmount,
            status: "Approved",
            type: depositType,
            source: rewardData.source || "Referral",
            sourceRewardId: rewardId,
            createdAt: new Date(),
          });

          return {
            success: true,
            alreadyTransferred: false,
            newBalance: currentBalance + numAmount,
            depositId: depositRef.id,
          };
        });

        console.log(
          `[transferReferralReward] ✅ SUCCESS - user=${userId} reward=${rewardId} amount=₱${numAmount} newBalance=₱${result.newBalance}`
        );

        void (async () => {
          // 📊 Log to Render backend for monitoring
          try {
            const logUrl = process.env.RENDER_BACKEND_URL || "https://damayan-savings-backend.onrender.com";
            await fetch(`${logUrl}/api/log-event`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                level: "info",
                event: "referral_earnings_transfer_completed",
                data: {
                  userId,
                  rewardId,
                  amount: numAmount,
                  newBalance: result.newBalance,
                  alreadyTransferred: result.alreadyTransferred || false,
                  source: "Cloud Function",
                },
              }),
            });
          } catch (logError) {
            console.warn("[transferReferralReward] Warning: Failed to log to Render:", logError);
          }

          if (!result.alreadyTransferred) {
            const amountLabel = Number(numAmount || 0).toLocaleString("en-PH", {
              style: "currency",
              currency: "PHP",
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            });
            const title = "Referral Reward Credited";
            const message = `${amountLabel} from your referral rewards has been credited to your E-Wallet.`;

            try {
              await db.collection("notifications").add({
                userId,
                recipientUid: userId,
                title,
                message,
                type: "referral-reward-transfer",
                read: false,
                rewardId,
                amount: numAmount,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
              });

              await sendPushToUsers({
                userIds: [userId],
                title,
                body: message,
                data: {
                  type: "REFERRAL_REWARD_TRANSFER",
                  rewardId,
                  amount: numAmount,
                  path: "/member/dashboard",
                },
              });
            } catch (notificationError) {
              console.warn("[transferReferralReward] Notification warning:", notificationError);
            }
          }
        })();

        return res.json(result);
      } catch (transactionError) {
        console.error("[transferReferralReward] ❌ Transaction failed:", transactionError);
        res.status(400).json({ error: transactionError.message || "Transfer failed" });
      }
    } catch (error) {
      console.error("[transferReferralReward] ❌ Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

/**
 * Transfer Override Upline Reward to eWallet
 * HTTP function with explicit CORS support
 * Idempotent: Safe to retry without duplication
 */
exports.transferOverrideReward = functions.https.onRequest(async (req, res) => {
  // Apply CORS middleware
  corsHandler(req, res, async () => {
    try {
      console.log("[transferOverrideReward] 🔄 Request received:", req.method);

      // Only allow POST requests
      if (req.method !== "POST") {
        console.log("[transferOverrideReward] Method:", req.method);
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      // Get authorization header
      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        console.error("[transferOverrideReward] ❌ Missing or invalid authorization header");
        return res.status(401).json({ error: "Unauthorized: Missing or invalid token" });
      }

      const idToken = authHeader.substring("Bearer ".length);
      const { overrideId, amount } = req.body || {};

      console.log("[transferOverrideReward] Input:", { overrideId, amount });

      // Validate input
      if (!overrideId || !amount) {
        console.error("[transferOverrideReward] ❌ Missing required fields");
        return res.status(400).json({ error: "Missing required fields: overrideId, amount" });
      }

      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        console.error("[transferOverrideReward] ❌ Invalid amount");
        return res.status(400).json({ error: "Amount must be greater than zero" });
      }

      // Verify user authentication
      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
        console.log("[transferOverrideReward] ✅ User authenticated:", decodedToken.uid);
      } catch (error) {
        console.error("[transferOverrideReward] ❌ Token verification failed:", error);
        return res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
      }

      const userId = decodedToken.uid;

      // Run transaction
      try {
        const result = await db.runTransaction(async (transaction) => {
          // Try both uplineRewards and override collections
          let rewardRef;
          let rewardData;

          // First try uplineRewards collection
          const uplineRewardRef = db.collection("uplineRewards").doc(overrideId);
          const uplineRewardDoc = await transaction.get(uplineRewardRef);

          if (uplineRewardDoc.exists) {
            rewardRef = uplineRewardRef;
            rewardData = uplineRewardDoc.data();
          } else {
            // Try override collection
            const overrideRef = db.collection("override").doc(overrideId);
            const overrideDoc = await transaction.get(overrideRef);

            if (overrideDoc.exists) {
              rewardRef = overrideRef;
              rewardData = overrideDoc.data();
            } else {
              throw new Error("Override reward not found");
            }
          }

          // Verify reward belongs to the authenticated user
          if (rewardData.uplineId !== userId) {
            throw new Error("This reward does not belong to you");
          }

          // ✅ IDEMPOTENCY CHECK: If already credited, return success
          if (rewardData.claimed || rewardData.status === "Credited") {
            console.log(
              `[transferOverrideReward] Reward ${overrideId} already credited (idempotent return)`
            );
            return {
              success: true,
              alreadyTransferred: true,
              message: "This reward was already credited",
              newBalance: rewardData.amount,
            };
          }

          // Check if reward is due
          let dueDate = rewardData.dueDate || rewardData.releaseDate;
          if (dueDate) {
            if (typeof dueDate === "object" && dueDate.seconds) {
              dueDate = new Date(dueDate.seconds * 1000);
            } else if (typeof dueDate === "string" || typeof dueDate === "number") {
              dueDate = new Date(dueDate);
            }
          }

          const now = new Date();
          if (dueDate && now < dueDate) {
            throw new Error("Reward is not yet due. Please wait until the due date has passed.");
          }

          // Get user document
          const userRef = db.collection("users").doc(userId);
          const userDoc = await transaction.get(userRef);

          if (!userDoc.exists) {
            throw new Error("User not found");
          }

          const userData = userDoc.data();
          const currentBalance = Number(userData.eWallet || 0);

          // Update user eWallet (add amount)
          transaction.update(userRef, {
            eWallet: currentBalance + numAmount,
            updatedAt: new Date(),
          });

          // Mark reward as claimed and status as Credited
          transaction.update(rewardRef, {
            claimed: true,
            claimedAt: new Date(),
            status: "Credited",
          });

          // Create override transaction record for audit trail
          const transactionRef = db.collection("overrideTransactions").doc();
          transaction.set(transactionRef, {
            userId,
            overrideId,
            amount: numAmount,
            status: "Credited",
            createdAt: new Date(),
          });

          return {
            success: true,
            alreadyTransferred: false,
            newBalance: currentBalance + numAmount,
          };
        });

        console.log(
          `[transferOverrideReward] ✅ SUCCESS - user=${userId} override=${overrideId} amount=₱${numAmount} newBalance=₱${result.newBalance}`
        );

        void (async () => {
          // 📊 Log to Render backend for monitoring
          try {
            const logUrl = process.env.RENDER_BACKEND_URL || "https://damayan-savings-backend.onrender.com";
            await fetch(`${logUrl}/api/log-event`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                level: "info",
                event: "override_earnings_transfer_completed",
                data: {
                  userId,
                  overrideId,
                  amount: numAmount,
                  newBalance: result.newBalance,
                  alreadyTransferred: result.alreadyTransferred || false,
                  source: "Cloud Function",
                },
              }),
            });
          } catch (logError) {
            console.warn("[transferOverrideReward] Warning: Failed to log to Render:", logError);
          }

          if (!result.alreadyTransferred) {
            const amountLabel = Number(numAmount || 0).toLocaleString("en-PH", {
              style: "currency",
              currency: "PHP",
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            });
            const title = "Override Reward Credited";
            const message = `${amountLabel} from your override rewards has been credited to your E-Wallet.`;

            try {
              await db.collection("notifications").add({
                userId,
                recipientUid: userId,
                title,
                message,
                type: "override-reward-transfer",
                read: false,
                overrideId,
                amount: numAmount,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
              });

              await sendPushToUsers({
                userIds: [userId],
                title,
                body: message,
                data: {
                  type: "OVERRIDE_REWARD_TRANSFER",
                  overrideId,
                  amount: numAmount,
                  path: "/member/dashboard",
                },
              });
            } catch (notificationError) {
              console.warn("[transferOverrideReward] Notification warning:", notificationError);
            }
          }
        })();

        return res.json(result);
      } catch (transactionError) {
        console.error("[transferOverrideReward] ❌ Transaction failed:", transactionError);
        res.status(400).json({ error: transactionError.message || "Transfer failed" });
      }
    } catch (error) {
      console.error("[transferOverrideReward] ❌ Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

/**
 * Add Capital Share Entry
 * Idempotent: Uses clientRequestId to prevent duplicates
 * Secure: Requires Bearer token authentication
 */
exports.addCapitalShare = functions.https.onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      console.log("[capital-share] 🔄 Request received");

      if (req.method !== "POST") {
        console.error("[capital-share] ❌ Invalid method:", req.method);
        return res.status(405).json({ error: "Method not allowed" });
      }

      // Extract Bearer token from Authorization header
      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        console.error("[capital-share] ❌ Missing or invalid authorization header");
        return res.status(401).json({ error: "Unauthorized: Missing or invalid token" });
      }

      const idToken = authHeader.substring("Bearer ".length);
      const { amount, entryDate, referredBy, clientRequestId } = req.body || {};

      console.log("[capital-share] Validating input:", { amount, entryDate, referredBy, clientRequestId });

      // Validate input
      if (!amount || !entryDate) {
        console.error("[capital-share] ❌ Missing required fields");
        return res.status(400).json({ error: "Missing required fields: amount, entryDate" });
      }

      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        console.error("[capital-share] ❌ Invalid amount");
        return res.status(400).json({ error: "Amount must be greater than zero" });
      }

      if (numAmount < 1000) {
        console.error("[capital-share] ❌ Amount below minimum (₱1000)");
        return res.status(400).json({ error: "Minimum capital share amount is ₱1,000" });
      }

      // Verify user authentication
      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
        console.log("[capital-share] ✅ User authenticated:", decodedToken.uid);
      } catch (error) {
        console.error("[capital-share] ❌ Token verification failed:", error);
        return res.status(401).json({ error: "Unauthorized" });
      }

      const userId = decodedToken.uid;

      // Run transaction
      try {
        const result = await db.runTransaction(async (transaction) => {
          // Get user document
          const userRef = db.collection("users").doc(userId);
          const userDoc = await transaction.get(userRef);
          if (!userDoc.exists) {
            throw new Error("User not found");
          }

          const userData = userDoc.data();
          const walletBalance = Number(userData.eWallet || 0);

          // Idempotency: Check if entry already exists using clientRequestId
          const entryRef = clientRequestId
            ? db.collection("capitalShareEntries").doc(`${userId}_${clientRequestId}`)
            : db.collection("capitalShareEntries").doc();

          const existingEntrySnap = await transaction.get(entryRef);
          if (existingEntrySnap.exists) {
            const existingData = existingEntrySnap.data() || {};
            console.log(`[capital-share] Entry already exists (deduped) - entryId=${entryRef.id}`);
            return {
              success: true,
              entryId: entryRef.id,
              newBalance: walletBalance,
              deduped: true,
              lockInPortion: existingData.lockInPortion || 0,
              transferablePortion: existingData.transferablePortion || 0,
            };
          }

          // Check wallet balance
          if (walletBalance < numAmount) {
            throw new Error("Insufficient wallet balance");
          }

          // Get existing entries to calculate cumulative lock-in
          const existingEntriesSnap = await db
            .collection("capitalShareEntries")
            .where("userId", "==", userId)
            .get();

          let cumulativeLockIn = 0;
          existingEntriesSnap.docs.forEach((doc) => {
            const data = doc.data();
            cumulativeLockIn += data.lockInPortion || 0;
          });

          // Calculate lock-in: 25% of the added amount
          const lockInPortion = numAmount * 0.25;
          const transferablePortion = numAmount - lockInPortion;

          const addCalendarMonths = (baseDate, monthsToAdd) => {
            const result = new Date(baseDate);
            const originalDay = result.getDate();
            result.setDate(1);
            result.setMonth(result.getMonth() + monthsToAdd);
            const lastDayOfTargetMonth = new Date(
              result.getFullYear(),
              result.getMonth() + 1,
              0
            ).getDate();
            result.setDate(Math.min(originalDay, lastDayOfTargetMonth));
            return result;
          };

          // Calculate when the entry becomes transferable
          const now = new Date();
          const transferableAfterDate = addCalendarMonths(now, 1);
          const nextProfitDate = addCalendarMonths(now, 1);

          // Create capital share entry
          transaction.set(entryRef, {
            userId,
            amount: numAmount,
            date: new Date(entryDate),
            profit: 0,
            profitStatus: "Pending",
            lockInPortion,
            transferablePortion,
            status: "Approved",
            createdAt: new Date(),
            transferableAfterDate,
            nextProfitDate,
          });

          // Deduct from user wallet
          transaction.update(userRef, {
            eWallet: walletBalance - numAmount,
            updatedAt: new Date(),
          });

          // Create deposit record for eWallet history
          const depositRef = db.collection("deposits").doc(`${entryRef.id}_deposit`);
          transaction.set(depositRef, {
            userId,
            amount: numAmount,
            status: "Approved",
            type: "Capital Share Added",
            sourceEntryId: entryRef.id,
            createdAt: new Date(),
          });

          // Store multi-level network bonus in override collection:
          // L1=3% (direct upline), L2=1%, L3=1%
          const levelPercentages = [0.03, 0.01, 0.01];
          let currentUplineUsername = userData.referredBy || referredBy || null;
          const releaseDate = addCalendarMonths(now, 1);
          const visitedUplines = new Set();

          for (let i = 0; i < levelPercentages.length && currentUplineUsername; i += 1) {
            if (visitedUplines.has(currentUplineUsername)) {
              break;
            }
            visitedUplines.add(currentUplineUsername);

            const uplineQuery = await db
              .collection("users")
              .where("username", "==", currentUplineUsername)
              .limit(1)
              .get();

            if (uplineQuery.empty) {
              break;
            }

            const uplineDoc = uplineQuery.docs[0];
            const uplineData = uplineDoc.data() || {};
            const uplineId = uplineDoc.id;
            const level = i + 1;
            const bonusAmount = numAmount * levelPercentages[i];

            const overrideRef = db.collection("override").doc(`${entryRef.id}_override_l${level}`);
            transaction.set(overrideRef, {
              uplineId,
              fromUserId: userId,
              fromUsername: userData.username || "",
              uplineUsername: currentUplineUsername,
              amount: bonusAmount,
              type: `Level ${level} Capital Share Bonus`,
              networkLevel: level,
              status: "Pending",
              createdAt: new Date(),
              releaseDate,
            });

            currentUplineUsername = uplineData.referredBy || null;
          }

          return {
            success: true,
            entryId: entryRef.id,
            newBalance: walletBalance - numAmount,
            lockInPortion,
            transferablePortion,
          };
        });

        console.info(
          `[capital-share] ✅ ENTRY CREATED - user=${userId} amount=₱${numAmount} lockIn=₱${result.lockInPortion} transferable=₱${result.transferablePortion} entryId=${result.entryId}`
        );

        // 📊 Log to Render backend for monitoring
        try {
          const logUrl = process.env.RENDER_BACKEND_URL || "https://damayan-savings-backend.onrender.com";
          await fetch(`${logUrl}/api/log-event`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              level: "info",
              event: "capital_share_entry_created",
              data: {
                userId,
                entryId: result.entryId,
                amount: numAmount,
                lockInPortion: result.lockInPortion,
                transferablePortion: result.transferablePortion,
                deduped: result.deduped || false,
                source: "Cloud Function",
              },
            }),
          });
        } catch (logError) {
          console.warn("[capital-share] Warning: Failed to log to Render:", logError);
        }

        res.json(result);
      } catch (transactionError) {
        console.error("[capital-share] ❌ Transaction failed:", transactionError);
        res.status(400).json({ error: transactionError.message });
      }
    } catch (error) {
      console.error("[capital-share] ❌ Error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

/**
 * Add Payback Entry
 * Idempotent: Uses clientRequestId to prevent duplicates
 * Secure: Requires Bearer token authentication
 */
exports.addPaybackEntry = functions.https.onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      console.log("[payback-entry] 🔄 Request received");

      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const idToken = authHeader.substring("Bearer ".length);
      const { uplineUsername, amount, entryDate, clientRequestId } = req.body || {};

      if (!uplineUsername || !amount || !entryDate) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount < 300) {
        return res.status(400).json({ error: "Minimum payback entry is ₱300" });
      }

      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
      } catch (error) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const userId = decodedToken.uid;

      const result = await db.runTransaction(async (transaction) => {
        const userRef = db.collection("users").doc(userId);
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) throw new Error("User not found");

        const userData = userDoc.data();
        const walletBalance = userData.eWallet || 0;

        const paybackRef = clientRequestId
          ? db.collection("paybackEntries").doc(`${userId}_${clientRequestId}`)
          : db.collection("paybackEntries").doc();

        const existingSnap = await transaction.get(paybackRef);
        if (existingSnap.exists) {
          return {
            success: true,
            paybackEntryId: paybackRef.id,
            newBalance: walletBalance,
            deduped: true,
          };
        }

        if (walletBalance < numAmount) throw new Error("Insufficient wallet balance");

        const uplineQuery = await db
          .collection("users")
          .where("username", "==", uplineUsername)
          .limit(1)
          .get();

        if (uplineQuery.empty) throw new Error("Upline not found");

        const uplineData = uplineQuery.docs[0].data();
        const uplineId = uplineQuery.docs[0].id;

        transaction.update(userRef, {
          eWallet: walletBalance - numAmount,
          updatedAt: new Date(),
        });

        const expirationDate = new Date(new Date(entryDate).getTime() + 30 * 24 * 60 * 60 * 1000);
        transaction.set(paybackRef, {
          userId,
          uplineUsername,
          amount: numAmount,
          date: new Date(entryDate),
          expirationDate,
          status: "Approved",
          createdAt: new Date(),
        });

        const uplineRewardRef = db.collection("uplineRewards").doc(`${paybackRef.id}_upline`);
        transaction.set(uplineRewardRef, {
          uplineId,
          uplineUsername,
          fromUserId: userId,
          amount: 65,
          status: "Pending",
          dueDate: expirationDate,
          claimed: false,
          createdAt: new Date(),
        });

        return {
          success: true,
          paybackEntryId: paybackRef.id,
          newBalance: walletBalance - numAmount,
          uplineReward: 65,
        };
      });

      console.info(`[payback-entry] ✅ SUCCESS - user=${userId} upline=${uplineUsername} amount=₱${numAmount}`);

      // 📊 Log to Render
      try {
        fetch("https://damayan-savings-backend.onrender.com/api/log-event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            level: "info",
            event: "payback_entry_created",
            data: {
              userId,
              uplineUsername,
              amount: numAmount,
              entryId: result.paybackEntryId,
              newBalance: result.newBalance,
              deduped: result.deduped || false,
              source: "Cloud Function",
            },
          }),
        });
      } catch (logError) {
        console.warn("[payback-entry] Warning: Failed to log to Render:", logError);
      }

      res.json(result);
    } catch (error) {
      console.error("[payback-entry] ❌ Error:", error);
      res.status(400).json({ error: error.message || "Internal server error" });
    }
  });
});

/**
 * Transfer Funds (Send Money)
 * Idempotent: Uses clientRequestId to prevent duplicates
 */
exports.transferFunds = functions.https.onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      console.log("[transfer-funds] 🔄 Request received");

      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const idToken = authHeader.substring("Bearer ".length);
      const { recipientUsername, amount, clientRequestId, message } = req.body || {};

      if (!recipientUsername || !amount) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ error: "Amount must be greater than zero" });
      }

      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
      } catch (error) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const senderId = decodedToken.uid;
      const charge = numAmount * 0.02;
      const totalDeduction = numAmount + charge;
      const transferAmount = numAmount;

      const result = await db.runTransaction(async (transaction) => {
        const senderRef = db.collection("users").doc(senderId);
        const senderDoc = await transaction.get(senderRef);
        if (!senderDoc.exists) throw new Error("Sender not found");

        const senderData = senderDoc.data() || {};
        const senderName = senderData.name || senderData.username || "Member";
        const senderUsername = senderData.username || "";
        const currentBalance = Number(senderData.eWallet || 0);

        const transferRef = clientRequestId
          ? db.collection("transferFunds").doc(`${senderId}_${clientRequestId}`)
          : db.collection("transferFunds").doc();

        const existingSnap = await transaction.get(transferRef);
        if (existingSnap.exists) {
          const existingData = existingSnap.data() || {};
          return {
            success: true,
            newBalance: currentBalance,
            transferId: transferRef.id,
            deduped: true,
            recipientId: existingData.recipientId || "",
            recipientName: existingData.recipientName || existingData.recipientUsername || recipientUsername,
            senderName: existingData.senderName || senderName,
            senderUsername: existingData.senderUsername || senderUsername,
          };
        }

        if (currentBalance < totalDeduction) throw new Error("Insufficient wallet balance");

        const recipientQuery = await db
          .collection("users")
          .where("username", "==", recipientUsername)
          .limit(1)
          .get();

        if (recipientQuery.empty) throw new Error("Recipient not found");

        const recipientDoc = recipientQuery.docs[0];
        if (senderId === recipientDoc.id) throw new Error("Cannot transfer to yourself");

        const recipientRef = db.collection("users").doc(recipientDoc.id);
        const recipientData = recipientDoc.data() || {};
        const recipientName = recipientData.name || recipientData.username || recipientUsername;

        transaction.update(senderRef, {
          eWallet: Number(currentBalance - totalDeduction),
        });

        const recipientBalance = Number(recipientData.eWallet || 0);
        transaction.update(recipientRef, {
          eWallet: Number(recipientBalance + transferAmount),
        });

        transaction.set(transferRef, {
          senderId,
          senderName,
          senderUsername,
          recipientUsername,
          recipientName,
          recipientId: recipientDoc.id,
          amount: numAmount,
          charge,
          netAmount: transferAmount,
          totalDeduction,
          status: "Approved",
          message: String(message || "").trim(),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return {
          success: true,
          newBalance: currentBalance - totalDeduction,
          transferId: transferRef.id,
          recipientId: recipientDoc.id,
          recipientName,
          senderName,
          senderUsername,
        };
      });

      console.info(`[transfer-funds] ✅ SUCCESS - sender=${senderId} recipient=${recipientUsername} amount=₱${numAmount} charge=₱${charge} totalDeduction=₱${totalDeduction}`);

      // 📊 Log to Render
      try {
        fetch("https://damayan-savings-backend.onrender.com/api/log-event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            level: "info",
            event: "wallet_transfer_completed",
            data: {
              senderId,
              recipientUsername,
              amount: numAmount,
              charge,
              netAmount: transferAmount,
              totalDeduction,
              transferId: result.transferId,
              newBalance: result.newBalance,
              deduped: result.deduped || false,
              source: "Cloud Function",
            },
          }),
        });
      } catch (logError) {
        console.warn("[transfer-funds] Warning: Failed to log to Render:", logError);
      }

      if (!result.deduped) {
        const formattedAmount = numAmount.toLocaleString("en-PH", {
          style: "currency",
          currency: "PHP",
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        const safeNote = String(message || "").trim();
        const safeNoteSuffix = safeNote ? ` Note: ${safeNote}` : "";
        const senderNotificationMessage = `You sent ${formattedAmount} to @${recipientUsername}.${safeNoteSuffix}`;
        const recipientNotificationMessage = `${result.senderName || result.senderUsername || "A member"} sent you ${formattedAmount}.${safeNoteSuffix}`;

        try {
          await Promise.all([
            db.collection("notifications").add({
              userId: senderId,
              recipientUid: senderId,
              title: "Transfer Successful",
              message: senderNotificationMessage,
              type: "send-money",
              read: false,
              transferId: result.transferId,
              senderId,
              recipientId: result.recipientId || "",
              recipientUsername,
              amount: numAmount,
              charge,
              netAmount: transferAmount,
              totalDeduction,
              path: "/member",
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            }),
            result.recipientId
              ? db.collection("notifications").add({
                  userId: result.recipientId,
                  recipientUid: result.recipientId,
                  title: "Money Received",
                  message: recipientNotificationMessage,
                  type: "money-received",
                  read: false,
                  transferId: result.transferId,
                  senderId,
                  senderUsername: result.senderUsername || "",
                  senderName: result.senderName || "",
                  amount: numAmount,
                  charge,
                  netAmount: transferAmount,
                  totalDeduction,
                  path: "/member",
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
                })
              : Promise.resolve(),
          ]);

          await Promise.all([
            sendPushToUsers({
              userIds: [senderId],
              title: "Transfer Successful",
              body: senderNotificationMessage,
              data: {
                type: "send-money",
                path: "/member",
                transferId: result.transferId,
                recipientUsername,
                amount: numAmount,
              },
            }),
            result.recipientId
              ? sendPushToUsers({
                  userIds: [result.recipientId],
                  title: "Money Received",
                  body: recipientNotificationMessage,
                  data: {
                    type: "money-received",
                    path: "/member",
                    transferId: result.transferId,
                    senderId,
                    senderUsername: result.senderUsername || "",
                    amount: numAmount,
                  },
                })
              : Promise.resolve(),
          ]);
        } catch (notificationError) {
          console.warn("[transfer-funds] Notification delivery warning:", notificationError);
        }
      }

      res.json(result);
    } catch (error) {
      console.error("[transfer-funds] ❌ Error:", error);
      res.status(400).json({ error: error.message || "Internal server error" });
    }
  });
});

/**
 * Transfer Monthly Profit
 * Idempotent: Uses clientRequestId to prevent duplicates
 */
exports.transferProfit = functions.https.onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      console.log("[transfer-profit] 🔄 Request received");

      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const idToken = authHeader.substring("Bearer ".length);
      const { entryId, amount, clientRequestId } = req.body || {};

      if (!entryId || !amount) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ error: "Invalid amount" });
      }

      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
      } catch (error) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const userId = decodedToken.uid;

      const result = await db.runTransaction(async (transaction) => {
        const depositRef = clientRequestId
          ? db.collection("deposits").doc(`profit_${userId}_${clientRequestId}`)
          : db.collection("deposits").doc();

        const existingSnap = await transaction.get(depositRef);
        if (existingSnap.exists && existingSnap.data().status === "Approved") {
          return {
            success: true,
            newBalance: 0,
            deduped: true,
          };
        }

        const entryRef = db.collection("capitalShareEntries").doc(entryId);
        const entryDoc = await transaction.get(entryRef);
        if (!entryDoc.exists) throw new Error("Entry not found");

        const entryData = entryDoc.data();
        if (entryData.userId !== userId) throw new Error("Not your entry");
        if (!entryData.profit || entryData.profitStatus === "Claimed") throw new Error("Profit unavailable");

        const userRef = db.collection("users").doc(userId);
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) throw new Error("User not found");

        const userData = userDoc.data();
        const currentBalance = Number(userData.eWallet || 0);

        transaction.update(userRef, {
          eWallet: currentBalance + numAmount,
          updatedAt: new Date(),
        });

        transaction.update(entryRef, {
          profitStatus: "Claimed",
          profit: 0,
          profitClaimedAmount: numAmount,
          profitClaimedAt: new Date(),
        });

        transaction.set(depositRef, {
          userId,
          amount: numAmount,
          status: "Approved",
          type: "Monthly Profit Transfer",
          sourceEntryId: entryId,
          createdAt: new Date(),
        });

        return {
          success: true,
          newBalance: currentBalance + numAmount,
          transferId: depositRef.id,
        };
      });

      console.info(`[transfer-profit] ✅ SUCCESS - user=${userId} entryId=${entryId} amount=₱${numAmount}`);

      // 📊 Log to Render
      try {
        fetch("https://damayan-savings-backend.onrender.com/api/log-event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            level: "info",
            event: "monthly_profit_transfer_completed",
            data: {
              userId,
              entryId,
              amount: numAmount,
              newBalance: result.newBalance,
              deduped: result.deduped || false,
              source: "Cloud Function",
            },
          }),
        });
      } catch (logError) {
        console.warn("[transfer-profit] Warning: Failed to log to Render:", logError);
      }

      res.json(result);
    } catch (error) {
      console.error("[transfer-profit] ❌ Error:", error);
      res.status(400).json({ error: error.message || "Internal server error" });
    }
  });
});

/**
 * Transfer Capital Share
 * Idempotent: Uses clientRequestId to prevent duplicates
 */
exports.transferCapitalShare = functions.https.onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      console.log("[transfer-capital-share] 🔄 Request received");

      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const idToken = authHeader.substring("Bearer ".length);
      const { entryId, amount, clientRequestId } = req.body || {};

      if (!entryId || !amount) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ error: "Invalid amount" });
      }

      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
      } catch (error) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const userId = decodedToken.uid;

      const result = await db.runTransaction(async (transaction) => {
        const depositRef = clientRequestId
          ? db.collection("deposits").doc(`capshare_${userId}_${clientRequestId}`)
          : db.collection("deposits").doc();

        const existingSnap = await transaction.get(depositRef);
        if (existingSnap.exists && existingSnap.data().sourceEntryId === entryId) {
          return {
            success: true,
            newBalance: 0,
            deduped: true,
          };
        }

        const entryRef = db.collection("capitalShareEntries").doc(entryId);
        const entryDoc = await transaction.get(entryRef);
        if (!entryDoc.exists) throw new Error("Entry not found");

        const entryData = entryDoc.data();
        if (entryData.userId !== userId) throw new Error("Not your entry");

        const userRef = db.collection("users").doc(userId);
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) throw new Error("User not found");

        const userData = userDoc.data();
        const currentBalance = Number(userData.eWallet || 0);

        transaction.update(userRef, {
          eWallet: currentBalance + numAmount,
          updatedAt: new Date(),
        });

        transaction.update(entryRef, {
          transferredAmount: (entryData.transferredAmount || 0) + numAmount,
          transferredAt: new Date(),
        });

        transaction.set(depositRef, {
          userId,
          amount: numAmount,
          status: "Approved",
          type: "Capital Share Transfer",
          sourceEntryId: entryId,
          createdAt: new Date(),
        });

        return {
          success: true,
          newBalance: currentBalance + numAmount,
          transferId: depositRef.id,
        };
      });

      console.info(`[transfer-capital-share] ✅ SUCCESS - user=${userId} entryId=${entryId} amount=₱${numAmount}`);

      // 📊 Log to Render
      try {
        fetch("https://damayan-savings-backend.onrender.com/api/log-event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            level: "info",
            event: "capital_share_transfer_completed",
            data: {
              userId,
              entryId,
              amount: numAmount,
              newBalance: result.newBalance,
              deduped: result.deduped || false,
              source: "Cloud Function",
            },
          }),
        });
      } catch (logError) {
        console.warn("[transfer-capital-share] Warning: Failed to log to Render:", logError);
      }

      res.json(result);
    } catch (error) {
      console.error("[transfer-capital-share] ❌ Error:", error);
      res.status(400).json({ error: error.message || "Internal server error" });
    }
  });
});

/**
 * Transfer Passive Income (Payback Entry Transfer)
 * Idempotent: Uses clientRequestId to prevent duplicates
 */
exports.transferPassiveIncome = functions.https.onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      console.log("[transfer-passive-income] 🔄 Request received");

      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const idToken = authHeader.substring("Bearer ".length);
      const { paybackEntryId, amount, clientRequestId } = req.body || {};

      if (!paybackEntryId || !amount) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ error: "Invalid amount" });
      }

      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
      } catch (error) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const userId = decodedToken.uid;
      const fee = numAmount * 0.01;
      const net = numAmount - fee;

      const result = await db.runTransaction(async (transaction) => {
        const transferRef = clientRequestId
          ? db.collection("passiveTransfers").doc(`passive_${userId}_${clientRequestId}`)
          : db.collection("passiveTransfers").doc();
        const legacyTransferRef = clientRequestId
          ? db.collection("passiveIncomeTransfers").doc(`${userId}_${clientRequestId}`)
          : null;

        const paybackRef = db.collection("paybackEntries").doc(paybackEntryId);
        const [existingSnap, legacySnap, paybackDoc] = await Promise.all([
          transaction.get(transferRef),
          legacyTransferRef ? transaction.get(legacyTransferRef) : Promise.resolve(null),
          transaction.get(paybackRef),
        ]);

        if (!paybackDoc.exists) {
          throw new Error("Payback entry not found");
        }

        const paybackData = paybackDoc.data() || {};
        if (paybackData.userId !== userId) {
          throw new Error("Unauthorized: Not your payback entry");
        }

        const expirationDate = getDateValue(paybackData.expirationDate) || getDateValue(paybackData.date);
        if (!expirationDate || expirationDate > new Date()) {
          throw new Error("Profit not yet matured");
        }

        const expectedProfit = Number(paybackData.amount || 0) * 0.02;
        if (Math.abs(expectedProfit - numAmount) > 0.01) {
          throw new Error("Invalid profit amount");
        }

        const userRef = db.collection("users").doc(userId);
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) {
          throw new Error("User not found");
        }

        const userData = userDoc.data() || {};
        const currentBalance = Number(userData.eWallet || 0);
        const alreadyTransferred = Boolean(paybackData.transferred || existingSnap.exists || legacySnap?.exists);

        if (alreadyTransferred) {
          if (!paybackData.transferred) {
            transaction.update(paybackRef, {
              transferred: true,
              transferredAt: paybackData.transferredAt || admin.firestore.FieldValue.serverTimestamp(),
              lastTransferId: existingSnap.exists ? transferRef.id : legacyTransferRef?.id || paybackData.lastTransferId || transferRef.id,
            });
          }

          return {
            success: true,
            newBalance: currentBalance,
            transferId: existingSnap.exists ? transferRef.id : legacyTransferRef?.id || paybackData.lastTransferId || transferRef.id,
            deduped: true,
            alreadyTransferred: true,
          };
        }

        transaction.update(userRef, {
          eWallet: isNaN(currentBalance) ? net : Number(currentBalance + net),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        transaction.update(paybackRef, {
          transferred: true,
          transferredAt: admin.firestore.FieldValue.serverTimestamp(),
          lastTransferId: transferRef.id,
          lastTransferredAmount: numAmount,
        });

        transaction.set(transferRef, {
          userId,
          paybackEntryId,
          amount: numAmount,
          fee,
          netAmount: net,
          clientRequestId: clientRequestId || null,
          type: "Passive Income Earn",
          status: "Credited",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return {
          success: true,
          newBalance: currentBalance + net,
          transferId: transferRef.id,
          alreadyTransferred: false,
          deduped: false,
        };
      });

      if (!result.deduped) {
        const grossAmountLabel = Number(numAmount || 0).toLocaleString("en-PH", {
          style: "currency",
          currency: "PHP",
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        const netAmountLabel = Number(net || 0).toLocaleString("en-PH", {
          style: "currency",
          currency: "PHP",
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });

        await db.collection("notifications").add({
          userId,
          recipientUid: userId,
          title: "Passive Income Credited",
          message: `${grossAmountLabel} passive income was transferred successfully. ${netAmountLabel} was credited to your E-Wallet after the 1% fee.`,
          type: "passive-income-transfer",
          read: false,
          amount: numAmount,
          netAmount: net,
          paybackEntryId,
          transferId: result.transferId,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        await sendPushToUsers({
          userIds: [userId],
          title: "Passive Income Credited",
          body: `${netAmountLabel} is now in your E-Wallet.`,
          data: {
            type: "PASSIVE_INCOME_TRANSFER",
            transferId: result.transferId,
            paybackEntryId,
            amount: numAmount,
            netAmount: net,
            path: "/member/income/payback",
          },
        }).catch((pushError) => {
          console.warn("[transfer-passive-income] Push notification warning:", pushError);
        });
      }

      console.info(`[transfer-passive-income] ✅ SUCCESS - user=${userId} paybackId=${paybackEntryId} amount=₱${numAmount} net=₱${net}`);

      // 📊 Log to Render
      try {
        fetch("https://damayan-savings-backend.onrender.com/api/log-event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            level: "info",
            event: "passive_income_transfer_completed",
            data: {
              userId,
              paybackEntryId,
              amount: numAmount,
              netAmount: net,
              newBalance: result.newBalance,
              deduped: result.deduped || false,
              source: "Cloud Function",
            },
          }),
        });
      } catch (logError) {
        console.warn("[transfer-passive-income] Warning: Failed to log to Render:", logError);
      }

      res.json(result);
    } catch (error) {
      console.error("[transfer-passive-income] ❌ Error:", error);
      res.status(400).json({ error: error.message || "Internal server error" });
    }
  });
});

/**
 * Purchase Activation Code
 * Idempotent: Safe to retry via clientRequestId
 */
exports.purchaseActivationCode = functions.https.onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized: Missing or invalid token" });
      }

      const idToken = authHeader.substring("Bearer ".length);
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const userId = decodedToken.uid;

      const { codeType, clientRequestId } = req.body || {};

      if (!codeType) {
        return res.status(400).json({ error: "Missing required field: codeType" });
      }

      const result = await db.runTransaction(async (transaction) => {
        // Idempotency check
        if (clientRequestId) {
          const idempotencyRef = db.collection("purchaseCodesIdempotency").doc(`${userId}_${clientRequestId}`);
          const existingSnap = await transaction.get(idempotencyRef);
          if (docExists(existingSnap)) {
            const data = existingSnap.data();
            return {
              success: true,
              deduped: true,
              code: data.code,
              codeId: data.codeId,
              amount: Number(data.amount || 0),
              isCapitalRenewalEligible: Boolean(data.isCapitalRenewalEligible),
            };
          }
        }

        const userRef = db.collection("users").doc(userId);
        const userSnap = await transaction.get(userRef);
        if (!docExists(userSnap)) {
          throw new Error("User account not found");
        }

        const userData = userSnap.data();
        const pricing = resolvePurchaseCodePricing(userData);
        const isCapitalRenewalEligible = codeType === "capital" && pricing.isCapitalRenewalEligible;
        const amount =
          codeType === "capital"
            ? pricing.capitalPrice
            : pricing.downlinePrice;

        const currentBalance = Number(userData.eWallet || 0);
        if (currentBalance < amount) {
          throw new Error("Insufficient wallet balance");
        }

        const randomCode = "TCLC-" + Math.random().toString(36).substring(2, 10).toUpperCase();
        const purchaseRef = db.collection("purchaseCodes").doc();

        transaction.set(purchaseRef, {
          userId,
          name: userData.name || "",
          email: userData.email || "",
          code: randomCode,
          type: codeType === "capital" ? "Activate Capital Share" : "Downline Code",
          amount,
          used: false,
          status: "Success",
          createdAt: new Date(),
        });

        transaction.update(userRef, { eWallet: currentBalance - amount });

        // Store idempotency key
        if (clientRequestId) {
          const idempotencyRef = db.collection("purchaseCodesIdempotency").doc(`${userId}_${clientRequestId}`);
          transaction.set(idempotencyRef, {
            code: randomCode,
            codeId: purchaseRef.id,
            amount,
            isCapitalRenewalEligible,
            createdAt: new Date(),
          });
        }

        return {
          success: true,
          code: randomCode,
          codeId: purchaseRef.id,
          amount,
          isCapitalRenewalEligible,
          newBalance: currentBalance - amount,
        };
      });

      // Log to Render
      try {
        fetch("https://damayan-savings-backend.onrender.com/api/log-event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            level: "info",
            event: "activation_code_purchased",
            data: {
              userId,
              codeType,
              amount: result.amount,
              newBalance: result.newBalance,
              deduped: result.deduped || false,
              isCapitalRenewalEligible: result.isCapitalRenewalEligible || false,
              source: "Cloud Function",
            },
          }),
        });
      } catch (logError) {
        console.warn("[purchase-activation-code] Warning: Failed to log to Render:", logError);
      }

      res.json(result);
    } catch (error) {
      console.error("[purchase-activation-code] Error:", error);
      res.status(400).json({ error: error.message || "Internal server error" });
    }
  });
});

/**
 * Get Purchase Code Pricing
 * Returns canonical prices used by purchaseActivationCode
 */
exports.getPurchaseCodePricing = functions.https.onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized: Missing or invalid token" });
      }

      const idToken = authHeader.substring("Bearer ".length);
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const userId = decodedToken.uid;

      const userSnap = await db.collection("users").doc(userId).get();
      if (!docExists(userSnap)) {
        return res.status(404).json({ error: "User account not found" });
      }

      const pricing = resolvePurchaseCodePricing(userSnap.data() || {});
      return res.json(pricing);
    } catch (error) {
      console.error("[get-purchase-code-pricing] Error:", error);
      return res.status(400).json({ error: error.message || "Internal server error" });
    }
  });
});

/**
 * Create Withdrawal Request
 * Idempotent: Safe to retry via clientRequestId
 */
exports.createWithdrawal = functions.https.onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized: Missing or invalid token" });
      }

      const idToken = authHeader.substring("Bearer ".length);
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const userId = decodedToken.uid;

      const { amount, paymentMethod, qrUrl, clientRequestId } = req.body || {};

      if (!amount || !paymentMethod || !qrUrl) {
        return res.status(400).json({ error: "Missing required fields: amount, paymentMethod, qrUrl" });
      }

      const numAmount = parseFloat(amount);
      if (isNaN(numAmount) || numAmount < 100) {
        return res.status(400).json({ error: "Minimum withdrawal is ₱100" });
      }

      const result = await db.runTransaction(async (transaction) => {
        // Idempotency check
        if (clientRequestId) {
          const idempotencyRef = db.collection("withdrawalIdempotency").doc(`${userId}_${clientRequestId}`);
          const existingSnap = await transaction.get(idempotencyRef);
          if (docExists(existingSnap)) {
            const data = existingSnap.data();
            return { success: true, deduped: true, withdrawalId: data.withdrawalId };
          }
        }

        const userRef = db.collection("users").doc(userId);
        const userSnap = await transaction.get(userRef);
        if (!docExists(userSnap)) {
          throw new Error("User account not found");
        }

        const userData = userSnap.data();
        const currentBalance = Number(userData.eWallet || 0);
        const charge = Number((numAmount * 0.05).toFixed(2));
        const totalDeduction = Number((numAmount + charge).toFixed(2));
        const netAmount = numAmount;

        if (currentBalance < totalDeduction) {
          throw new Error("Insufficient wallet balance");
        }

        const withdrawalRef = db.collection("withdrawals").doc();
        transaction.set(withdrawalRef, {
          userId,
          name: userData.name || "",
          email: userData.email || "",
          amount: numAmount,
          paymentMethod,
          charge,
          netAmount,
          totalDeduction,
          qrUrl,
          status: "Pending",
          createdAt: new Date(),
        });

        transaction.update(userRef, {
          eWallet: currentBalance - totalDeduction,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Store idempotency key
        if (clientRequestId) {
          const idempotencyRef = db.collection("withdrawalIdempotency").doc(`${userId}_${clientRequestId}`);
          transaction.set(idempotencyRef, {
            withdrawalId: withdrawalRef.id,
            createdAt: new Date(),
          });
        }

        return {
          success: true,
          withdrawalId: withdrawalRef.id,
          newBalance: currentBalance - totalDeduction,
          charge,
          netAmount,
          totalDeduction,
        };
      });

      // Log to Render
      try {
        fetch("https://damayan-savings-backend.onrender.com/api/log-event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            level: "info",
            event: "withdrawal_created",
            data: {
              userId,
              amount: numAmount,
              paymentMethod,
              charge: result.charge,
              netAmount: result.netAmount,
              newBalance: result.newBalance,
              deduped: result.deduped || false,
              source: "Cloud Function",
            },
          }),
        });
      } catch (logError) {
        console.warn("[create-withdrawal] Warning: Failed to log to Render:", logError);
      }

      res.json(result);
    } catch (error) {
      console.error("[create-withdrawal] Error:", error);
      res.status(400).json({ error: error.message || "Internal server error" });
    }
  });
});

/**
 * Create Capital Share Voucher (WALK_IN or OFW)
 * Idempotent: Safe to retry via clientRequestId
 */
exports.createCapitalShareVoucher = functions.https.onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized: Missing or invalid token" });
      }

      const idToken = authHeader.substring("Bearer ".length);
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const userId = decodedToken.uid;

      const {
        voucherType,
        voucherCode,
        voucherIssuedAt,
        branchId,
        branchName,
        branchAddress,
        branchEmail,
        voucherKind,
        voucherStatus,
        claimablePercent,
        pointsConvertPercent,
        holdReason,
        sourceRewardLabel,
        splitGroupId,
        rewardConfigId,
        clientRequestId,
      } = req.body || {};

      if (!voucherType || !voucherCode) {
        return res.status(400).json({ error: "Missing required fields: voucherType, voucherCode" });
      }

      const result = await db.runTransaction(async (transaction) => {
        // Check user's capital activation date (vouchers only for activations >= Mar 4, 2026)
        const userRef = admin.firestore().collection("users").doc(userId);
        const userSnap = await transaction.get(userRef);
        
        if (!docExists(userSnap)) {
          throw new Error("User not found");
        }
        
        const userData = userSnap.data();
        const capitalActivatedAt = userData.capitalActivatedAt?.toDate?.() || (userData.capitalActivatedAt ? new Date(userData.capitalActivatedAt) : null);
        const voucherCutoffDate = new Date("2026-03-04"); // Implementation date
        
        // Vouchers only eligible for new activations (after Mar 4, 2026)
        if (!capitalActivatedAt || capitalActivatedAt < voucherCutoffDate) {
          throw new Error("Vouchers are only available for capital share activated after March 4, 2026. Please renew or reactivate your capital share to be eligible for vouchers.");
        }
        
        // Idempotency check
        if (clientRequestId) {
          const idempotencyKey = voucherKind ? `${userId}_${clientRequestId}_${voucherKind}` : `${userId}_${clientRequestId}`;
          const idempotencyRef = db.collection("voucherIdempotency").doc(idempotencyKey);
          const existingSnap = await transaction.get(idempotencyRef);
          if (existingSnap.exists) {
            const data = existingSnap.data();
            return { success: true, deduped: true, voucherId: data.voucherId };
          }
        }

        const voucherRef = db.collection("capitalShareVouchers").doc(userId);
        const voucherSnap = await transaction.get(voucherRef);

        let existingVouchers = [];
        if (voucherSnap.exists) {
          existingVouchers = voucherSnap.data().vouchers || [];
        }

        const parsedIssuedAt = voucherIssuedAt ? new Date(voucherIssuedAt) : new Date();
        const newVoucher = {
          voucherType,
          voucherCode,
          voucherStatus: voucherStatus || "ACTIVE",
          voucherKind: voucherKind || null, // Track voucher kind (RICE, MEAT, POINTS, etc.)
          claimablePercent: Number(claimablePercent || 100),
          pointsConvertPercent: Number(pointsConvertPercent || 0),
          holdReason: holdReason || "",
          sourceRewardLabel: sourceRewardLabel || "",
          splitGroupId: splitGroupId || null,
          rewardConfigId: rewardConfigId || null,
          branchId: branchId || null,
          branchName: branchName || "",
          branchAddress: branchAddress || "",
          branchEmail: branchEmail || "",
          voucherIssuedAt: parsedIssuedAt,
          createdAt: new Date(),
        };

        existingVouchers.push(newVoucher);

        transaction.set(voucherRef, {
          vouchers: existingVouchers,
          voucherType,
          voucherCode,
          voucherIssuedAt: parsedIssuedAt,
          lastUpdatedAt: new Date(),
        });

        // Store idempotency key
        if (clientRequestId) {
          const idempotencyKey = voucherKind ? `${userId}_${clientRequestId}_${voucherKind}` : `${userId}_${clientRequestId}`;
          const idempotencyRef = db.collection("voucherIdempotency").doc(idempotencyKey);
          transaction.set(idempotencyRef, {
            voucherId: userId,
            createdAt: new Date(),
          });
        }

        return {
          success: true,
          voucherId: userId,
          voucherCode,
          voucherType,
        };
      });

      // Log to Render
      try {
        fetch("https://damayan-savings-backend.onrender.com/api/log-event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            level: "info",
            event: "capital_share_voucher_created",
            data: {
              userId,
              voucherType,
              voucherCode,
              branchName,
              deduped: result.deduped || false,
              source: "Cloud Function",
            },
          }),
        });
      } catch (logError) {
        console.warn("[create-capital-share-voucher] Warning: Failed to log to Render:", logError);
      }

      res.json(result);
    } catch (error) {
      console.error("[create-capital-share-voucher] Error:", error);
      res.status(400).json({ error: error.message || "Internal server error" });
    }
  });
});

/**
 * Create Invite and Associated Rewards
 * Complex transaction: creates pendingInvites, consumes code, creates referral rewards and network bonuses
 * Idempotent: Safe to retry via clientRequestId
 */
exports.createInviteAndRewards = functions.https.onRequest(async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }

      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized: Missing or invalid token" });
      }

      const idToken = authHeader.substring("Bearer ".length);
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const inviterId = decodedToken.uid;

      const {
        codeId,
        inviteeEmail,
        inviteeName,
        inviteeUsername,
        contactNumber,
        inviteeAddress,
        inviteeRole,
        referralCode,
        clientRequestId,
      } = req.body || {};

      if (!codeId || !inviteeEmail || !inviteeUsername || !inviteeRole) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const result = await db.runTransaction(async (transaction) => {
        // Idempotency check
        if (clientRequestId) {
          const idempotencyRef = db.collection("inviteIdempotency").doc(`${inviterId}_${clientRequestId}`);
          const existingSnap = await transaction.get(idempotencyRef);
          if (existingSnap.exists) {
            const data = existingSnap.data();
            return { success: true, deduped: true, inviteId: data.inviteId };
          }
        }

        // 1️⃣ Get inviter data
        const inviterRef = db.collection("users").doc(inviterId);
        const inviterSnap = await transaction.get(inviterRef);
        if (!inviterSnap.exists) {
          throw new Error("Inviter not found");
        }
        const inviterData = inviterSnap.data();

        // 2️⃣ Verify and consume activation code
        const codeRef = db.collection("purchaseCodes").doc(codeId);
        const codeSnap = await transaction.get(codeRef);
        if (!codeSnap.exists) {
          throw new Error("Activation code not found");
        }

        const codeData = codeSnap.data();
        if (codeData.used) {
          throw new Error("Activation code already used");
        }
        if (codeData.userId !== inviterId) {
          throw new Error("Activation code does not belong to your account");
        }

        // 3️⃣ Create pending invite
        const pendingInviteRef = db.collection("pendingInvites").doc();
        transaction.set(pendingInviteRef, {
          inviterId,
          inviterUsername: inviterData.username || "",
          inviterRole: inviterData.role || "",
          inviteeEmail,
          inviteeName,
          inviteeUsername,
          contactNumber,
          address: inviteeAddress || "",
          role: inviteeRole,
          code: codeData.code,
          referralCode,
          referredBy: inviterData.username || "",
          referrerRole: inviterData.role || "",
          status: "Pending Approval",
          createdAt: new Date(),
        });

        // 4️⃣ Mark code as used
        transaction.update(codeRef, {
          used: true,
          usedAt: new Date(),
          usedByInviteeEmail: inviteeEmail,
        });

        // 5️⃣ Create direct referral reward
        const directRewardMap = {
          MasterMD: 235,
          MD: 210,
          MS: 160,
          MI: 140,
          Agent: 120,
        };
        const directReward = directRewardMap[inviterData.role] || 0;

        if (directReward > 0) {
          const referralRef = db.collection("referralReward").doc();
          transaction.set(referralRef, {
            userId: inviterId,
            username: inviterData.username || "",
            role: inviterData.role || "",
            amount: directReward,
            source: inviteeUsername,
            type: "Direct Invite Reward",
            approved: false,
            createdAt: new Date(),
          });
        }

        // 6️⃣ Create network/upline bonuses if applicable
        if (inviterData.uplineId) {
          const uplineRef = db.collection("users").doc(inviterData.uplineId);
          const uplineSnap = await transaction.get(uplineRef);
          if (uplineSnap.exists) {
            const uplineData = uplineSnap.data();
            const networkBonusMap = {
              MasterMD: 30,
              MD: 20,
              MS: 15,
              MI: 10,
              Agent: 5,
            };
            const networkBonus = networkBonusMap[uplineData.role] || 0;

            if (networkBonus > 0) {
              const networkRef = db.collection("referralReward").doc();
              transaction.set(networkRef, {
                userId: inviterData.uplineId,
                username: uplineData.username || "",
                role: uplineData.role || "",
                amount: networkBonus,
                source: inviteeUsername,
                type: "Network Bonus",
                approved: false,
                createdAt: new Date(),
              });
            }
          }
        }

        // Store idempotency key
        if (clientRequestId) {
          const idempotencyRef = db.collection("inviteIdempotency").doc(`${inviterId}_${clientRequestId}`);
          transaction.set(idempotencyRef, {
            inviteId: pendingInviteRef.id,
            createdAt: new Date(),
          });
        }

        return {
          success: true,
          inviteId: pendingInviteRef.id,
          directReward,
          inviteeUsername,
        };
      });

      // Log to Render
      try {
        fetch("https://damayan-savings-backend.onrender.com/api/log-event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            level: "info",
            event: "invite_created_with_rewards",
            data: {
              inviterId,
              inviteeUsername,
              inviteeEmail,
              inviteeRole: inviteeRole,
              directReward: result.directReward,
              deduped: result.deduped || false,
              source: "Cloud Function",
            },
          }),
        });
      } catch (logError) {
        console.warn("[create-invite-and-rewards] Warning: Failed to log to Render:", logError);
      }

      res.json(result);
    } catch (error) {
      console.error("[create-invite-and-rewards] Error:", error);
      res.status(400).json({ error: error.message || "Internal server error" });
    }
  });
});
