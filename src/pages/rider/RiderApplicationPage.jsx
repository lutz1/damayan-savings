import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchSignInMethodsForEmail, onAuthStateChanged } from "firebase/auth";
import { addDoc, collection, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import {
  ArrowBackRounded,
  ArrowForwardRounded,
  AutoAwesomeRounded,
  BadgeOutlined,
  CalendarTodayRounded,
  CheckCircleRounded,
  ChevronRightRounded,
  CloudUploadRounded,
  ContentCopyRounded,
  DescriptionOutlined,
  DirectionsBikeRounded,
  EmailRounded,
  FilePresentRounded,
  InfoOutlined,
  MailOutlineRounded,
  PersonRounded,
  PhoneIphoneRounded,
  ShieldOutlined,
  TaskAltRounded,
  WarningAmberRounded,
} from "@mui/icons-material";
import { CircularProgress } from "@mui/material";
import { app, auth, db, storage } from "../../firebase";
import plezzIcon from "../../assets/plezzicon.png";
import riderPreview from "../../assets/riderlogo.jpg";
import "./RiderApplicationPage.css";

const DOCUMENT_ITEMS = [
  {
    key: "driverLicense",
    label: "Driver's License",
    hint: "Take a photo of your valid driver's license.",
    accept: "image/*,.pdf",
    required: true,
  },
  {
    key: "vehicleORCR",
    label: "Vehicle OR/CR",
    hint: "Take a clear photo of your OR/CR or registration copy.",
    accept: "image/*,.pdf",
    required: true,
  },
  {
    key: "governmentId",
    label: "Government ID",
    hint: "Passport, UMID, or National ID accepted.",
    accept: "image/*,.pdf",
    required: true,
  },
  {
    key: "selfiePhoto",
    label: "Selfie Photo",
    hint: "Optional selfie for faster profile verification.",
    accept: "image/*",
    required: false,
  },
];

const DEFAULT_FORM = {
  fullName: "",
  email: "",
  phone: "",
  birthYear: "1992",
  age: "32",
  civilStatus: "Resident",
  address: "",
  municipality: "Metro Manila",
  memberSince: new Date().getFullYear().toString(),
  vehicleType: "Motorcycle",
  plateNumber: "",
  color: "Black",
  yearModel: "2025",
  licenseNumber: "",
  serviceArea: "Metro Manila (NCR)",
  notes: "Ready for full-time delivery coverage.",
};

const firstFilled = (...values) =>
  values.find((value) => value !== undefined && value !== null && String(value).trim() !== "");

const cleanDetectedValue = (value = "") =>
  String(value || "")
    .replace(/[|_*~`]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const toTitleCase = (value = "") =>
  cleanDetectedValue(value)
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const extractFieldFromText = (text = "", patterns = []) => {
  for (const pattern of patterns) {
    const match = String(text).match(pattern);
    const value = cleanDetectedValue(match?.[1] || "");
    if (value) return value;
  }

  return "";
};

const getYearFromText = (value = "") => {
  const matches = [...String(value).matchAll(/\b(19[5-9]\d|20[01]\d)\b/g)]
    .map((match) => Number(match[1]))
    .filter((year) => year <= new Date().getFullYear());

  return matches[0] ? String(matches[0]) : "";
};

const getAgeFromYear = (yearValue = "") => {
  const year = Number(String(yearValue).match(/\d{4}/)?.[0] || 0);
  if (!year) return "";

  const age = new Date().getFullYear() - year;
  return age > 0 ? String(age) : "";
};

const inferMunicipality = (address = "") => {
  const parts = cleanDetectedValue(address)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.length ? parts[parts.length - 1] : "";
};

const looksLikePersonName = (line = "") => {
  const value = cleanDetectedValue(line);
  if (value.split(" ").length < 2) return false;
  if (!/^[A-Za-z ,.'-]+$/.test(value)) return false;

  return !/(republic|philippines|national|license|identification|driver|signature|address|birth|sex|male|female|expiry|restrictions|blood|agency|authority|card)/i.test(value);
};

const formatDetectedFullName = (surname = "", given = "", middle = "") => {
  const lastName = toTitleCase(surname);
  const firstName = toTitleCase(given);
  const middleName = toTitleCase(middle);

  if (lastName || firstName || middleName) {
    return `${lastName}${firstName ? `, ${firstName}` : ""}${middleName ? ` ${middleName}` : ""}`.trim();
  }

  return "";
};

const extractNameFromText = (text = "") => {
  const combined = String(text || "");
  const surname = extractFieldFromText(combined, [/surname\s*[:\-]?\s*([A-Za-z ,.'-]{2,40})/i, /last\s*name\s*[:\-]?\s*([A-Za-z ,.'-]{2,40})/i]);
  const given = extractFieldFromText(combined, [/given\s*names?\s*[:\-]?\s*([A-Za-z ,.'-]{2,40})/i, /first\s*name\s*[:\-]?\s*([A-Za-z ,.'-]{2,40})/i]);
  const middle = extractFieldFromText(combined, [/middle\s*name\s*[:\-]?\s*([A-Za-z ,.'-]{2,40})/i]);

  if (surname || given || middle) {
    return formatDetectedFullName(surname, given, middle);
  }

  const labeledName = extractFieldFromText(combined, [/(?:full\s*name|name)\s*[:\-]?\s*([A-Za-z ,.'-]{5,80})/i]);
  if (labeledName) return toTitleCase(labeledName);

  const lineCandidate = combined
    .split(/\r?\n/)
    .map(cleanDetectedValue)
    .find(looksLikePersonName);

  return lineCandidate ? toTitleCase(lineCandidate) : "";
};

const extractAddressFromText = (text = "") => {
  const combined = String(text || "");
  const directMatch = extractFieldFromText(combined, [
    /(?:address|residence(?:\s*address)?|place\s*of\s*residence)\s*[:\-]?\s*([A-Za-z0-9 ,.#/-]{8,160})/i,
  ]);

  if (directMatch) return directMatch;

  const lines = combined.split(/\r?\n/).map(cleanDetectedValue).filter(Boolean);
  const addressIndex = lines.findIndex((line) => /address|residence/i.test(line));
  if (addressIndex >= 0) {
    return cleanDetectedValue([lines[addressIndex].replace(/.*?(address|residence)\s*[:\-]?/i, ""), lines[addressIndex + 1], lines[addressIndex + 2]].filter(Boolean).join(", "));
  }

  return "";
};

const extractIdentityFields = (text = "", docKey = "") => {
  const normalizedText = String(text || "");
  const address = extractAddressFromText(normalizedText);
  const birthDate = extractFieldFromText(normalizedText, [
    /(?:date\s*of\s*birth|birth\s*date|dob)\s*[:\-]?\s*([A-Za-z0-9 ,/-]{6,30})/i,
    /\b((?:0?[1-9]|1[0-2])[\/-](?:0?[1-9]|[12]\d|3[01])[\/-](?:19|20)\d{2})\b/,
    /\b([A-Z][a-z]{2,8}\s+\d{1,2},\s*(?:19|20)\d{2})\b/,
  ]);
  const birthYear = getYearFromText(birthDate || normalizedText);
  const licenseNumber = extractFieldFromText(normalizedText, [
    /(?:license\s*(?:no\.?|number)?|lic(?:ense|ence)\s*(?:no\.?|number)?|dl\s*no\.?)\D{0,8}([A-Z0-9-]{5,})/i,
  ]);
  const licenseExpiryRaw = docKey === "driverLicense"
    ? extractFieldFromText(normalizedText, [
        /(?:expiry\s*date|expiration\s*date|valid\s*until|expires?\s*on|license\s*validity|expiry)\s*[:\-]?\s*([A-Za-z0-9 ,/-]{6,30})/i,
      ])
    : "";
  const fallbackLicenseDate = docKey === "driverLicense"
    ? [...normalizedText.matchAll(/\b(?:0?[1-9]|1[0-2])[\/-](?:0?[1-9]|[12]\d|3[01])[\/-](?:19|20)\d{2}\b/g)].map((match) => match[0]).pop() || ""
    : "";
  const licenseExpiryDate = parseDetectedDate(licenseExpiryRaw || fallbackLicenseDate || "");
  const licenseExpiry = licenseExpiryDate ? formatDateForInput(licenseExpiryDate) : "";
  const fullName = extractNameFromText(normalizedText);
  const municipality = inferMunicipality(address);

  return {
    fullName,
    address,
    municipality,
    birthYear,
    age: getAgeFromYear(birthYear),
    licenseNumber: docKey === "driverLicense" ? licenseNumber : "",
    licenseExpiry: docKey === "driverLicense" ? licenseExpiry : "",
    isExpired: docKey === "driverLicense" ? Boolean(licenseExpiry && isExpiredDateValue(licenseExpiry)) : false,
  };
};

const collectScannedFields = (documents = {}) =>
  ["governmentId", "driverLicense", "vehicleORCR"]
    .map((key) => documents[key]?.scannedData || {})
    .reduce((accumulator, scannedData) => {
      Object.entries(scannedData).forEach(([field, value]) => {
        if (!accumulator[field] && cleanDetectedValue(value)) {
          accumulator[field] = cleanDetectedValue(value);
        }
      });
      return accumulator;
    }, {});

const pickAutofillValue = (fieldKey, currentValue, ...fallbacks) => {
  const defaultValue = DEFAULT_FORM[fieldKey];
  const normalizedCurrent = typeof currentValue === "string" ? currentValue.trim() : currentValue;
  const isUnedited = normalizedCurrent === "" || normalizedCurrent === defaultValue;

  if (!isUnedited) return currentValue;

  return firstFilled(...fallbacks, defaultValue, "") ?? "";
};

const prettifyFileName = (fileName = "") =>
  fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b(front|back|selfie|id|government|driver|drivers|license|photo|image|img|scan|copy|document)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => (part.length <= 3 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()))
    .join(" ");

const inferFullNameFromDocuments = (documents = {}) => {
  const guessedName = ["governmentId", "driverLicense", "selfiePhoto"]
    .map((key) => prettifyFileName(documents[key]?.name || ""))
    .find((value) => value && value.split(" ").length >= 2);

  return guessedName || "";
};

const loadTesseract = async () => {
  if (typeof window === "undefined") return null;
  if (window.Tesseract) return window.Tesseract;

  await new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-tesseract="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load OCR.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
    script.async = true;
    script.dataset.tesseract = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load OCR."));
    document.body.appendChild(script);
  });

  return window.Tesseract || null;
};

const prepareImageForOcr = async (file) => {
  if (!file?.type?.startsWith("image/")) return file;

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Unable to read the uploaded image."));
      img.src = objectUrl;
    });

    if (!image.width || !image.height) {
      throw new Error("Unable to read the uploaded image.");
    }

    const scale = Math.max(1, 1400 / image.width, 900 / image.height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(900, Math.round(image.width * scale));
    canvas.height = Math.max(600, Math.round(image.height * scale));

    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return file;

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.filter = "grayscale(1) contrast(1.15) brightness(1.05)";
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    return canvas;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const loadImageElementFromFile = (file) =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Unable to read the uploaded image."));
    };

    image.src = objectUrl;
  });

const getPrimaryFaceBox = async (image) => {
  const width = image?.naturalWidth || image?.width || 0;
  const height = image?.naturalHeight || image?.height || 0;
  const fallbackBox = width && height
    ? {
        x: width * 0.18,
        y: height * 0.12,
        width: width * 0.64,
        height: height * 0.64,
      }
    : null;

  if (typeof window === "undefined" || !("FaceDetector" in window)) {
    return fallbackBox;
  }

  try {
    const detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
    const faces = await detector.detect(image);
    return faces?.[0]?.boundingBox || fallbackBox;
  } catch (error) {
    console.warn("FaceDetector unavailable, using fallback crop:", error);
    return fallbackBox;
  }
};

const createFaceDescriptor = (image, boundingBox) => {
  if (!image || !boundingBox?.width || !boundingBox?.height) return [];

  const paddingX = boundingBox.width * 0.18;
  const paddingY = boundingBox.height * 0.2;
  const sourceWidth = image.naturalWidth || image.width || 0;
  const sourceHeight = image.naturalHeight || image.height || 0;

  const sx = Math.max(0, boundingBox.x - paddingX);
  const sy = Math.max(0, boundingBox.y - paddingY);
  const sw = Math.min(sourceWidth - sx, boundingBox.width + paddingX * 2);
  const sh = Math.min(sourceHeight - sy, boundingBox.height + paddingY * 2);

  const canvas = document.createElement("canvas");
  canvas.width = 24;
  canvas.height = 24;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return [];

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.filter = "grayscale(1) contrast(1.2) brightness(1.05)";
  context.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  const values = [];

  for (let index = 0; index < data.length; index += 4) {
    const luminance = (0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2]) / 255;
    values.push(luminance);
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / (values.length || 1);
  return values.map((value) => value - mean);
};

const cosineSimilarity = (vectorA = [], vectorB = []) => {
  if (!vectorA.length || vectorA.length !== vectorB.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let index = 0; index < vectorA.length; index += 1) {
    dot += vectorA[index] * vectorB[index];
    normA += vectorA[index] ** 2;
    normB += vectorB[index] ** 2;
  }

  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

const compareFaceImages = async (licenseFile, selfieFile) => {
  const [licenseImage, selfieImage] = await Promise.all([
    loadImageElementFromFile(licenseFile),
    loadImageElementFromFile(selfieFile),
  ]);

  const [licenseFaceBox, selfieFaceBox] = await Promise.all([
    getPrimaryFaceBox(licenseImage),
    getPrimaryFaceBox(selfieImage),
  ]);

  if (!licenseFaceBox || !selfieFaceBox) {
    return {
      status: "review",
      score: 0,
      message: "Face Recognition could not clearly detect a face in one of the uploads. Please use a clearer front-facing photo for manual review.",
    };
  }

  const licenseDescriptor = createFaceDescriptor(licenseImage, licenseFaceBox);
  const selfieDescriptor = createFaceDescriptor(selfieImage, selfieFaceBox);
  const rawSimilarity = cosineSimilarity(licenseDescriptor, selfieDescriptor);
  const similarityScore = Math.max(0, Math.min(1, (rawSimilarity + 1) / 2));
  const percent = Math.round(similarityScore * 100);

  if (similarityScore >= 0.6) {
    return {
      status: "matched",
      score: similarityScore,
      message: `Face Recognition passed and matched the selfie with the driver's license photo (${percent}% similarity).`,
    };
  }

  if (similarityScore >= 0.42) {
    return {
      status: "review",
      score: similarityScore,
      message: `Face Recognition passed with manual review (${percent}% similarity). You may continue, but using a clearer selfie can improve the match.`,
    };
  }

  return {
    status: "mismatch",
    score: similarityScore,
    message: `Face Recognition could not confidently match the selfie with the driver's license photo (${percent}% similarity). Please use the same person and retake the scan.`,
  };
};

const summarizeScannedFields = (scannedData = {}) => {
  const labels = {
    fullName: "full name",
    birthYear: "birth year",
    address: "address",
    licenseNumber: "license no.",
    licenseExpiry: "license expiry",
    plateNumber: "plate number",
    model: "model",
    year: "year model",
    registrationExpiry: "OR/CR expiry",
    vehicleType: "vehicle type",
  };

  const extracted = Object.entries(scannedData)
    .filter(([, value]) => cleanDetectedValue(value))
    .map(([key]) => labels[key] || key);

  return extracted.length ? extracted.join(", ") : "";
};

const formatDateForInput = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDetectedDate = (value = "") => {
  const cleaned = cleanDetectedValue(value).replace(/\./g, "/");
  if (!cleaned) return null;

  const numeric = cleaned.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-]((?:19|20)\d{2})\b/);
  if (numeric) {
    const month = Number(numeric[1]);
    const day = Number(numeric[2]);
    const year = Number(numeric[3]);
    const parsed = new Date(year, month - 1, day);

    if (parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day) {
      return parsed;
    }
  }

  const parsed = new Date(cleaned);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const isExpiredDateValue = (value = "") => {
  const parsedDate = parseDetectedDate(value);
  if (!parsedDate) return false;

  const expiryDate = new Date(parsedDate);
  expiryDate.setHours(23, 59, 59, 999);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return expiryDate < today;
};

const extractVehicleFields = (text = "") => {
  const normalizedText = String(text || "");
  const plateNumber = cleanDetectedValue(
    extractFieldFromText(normalizedText, [
      /(?:plate\s*(?:no\.?|number)?|plateno\.?)\s*[:#-]?\s*([A-Z0-9-]{5,12})/i,
    ])
  ).toUpperCase();

  const model = toTitleCase(
    extractFieldFromText(normalizedText, [
      /(?:make\/model|vehicle\s*model|model)\s*[:#-]?\s*([A-Za-z0-9 .-]{2,40})/i,
      /(?:make)\s*[:#-]?\s*([A-Za-z0-9 .-]{2,40})/i,
    ])
  );

  const year =
    extractFieldFromText(normalizedText, [
      /(?:year(?:\s*model)?|model\s*year)\s*[:#-]?\s*((?:19|20)\d{2})/i,
    ]) || getYearFromText(normalizedText);

  const expiryRaw = extractFieldFromText(normalizedText, [
    /(?:expiry\s*date|expiration\s*date|valid\s*until|expires?\s*on|registration\s*(?:expiry|expiration|validity|until))\s*[:#-]?\s*([A-Za-z0-9,\/-]{6,30})/i,
  ]);

  const fallbackDateMatch = normalizedText.match(/\b(?:0?[1-9]|1[0-2])[\/-](?:0?[1-9]|[12]\d|3[01])[\/-](?:19|20)\d{2}\b/);
  const expiryDate = parseDetectedDate(expiryRaw || fallbackDateMatch?.[0] || "");
  const registrationExpiry = expiryDate ? formatDateForInput(expiryDate) : "";

  const lowerText = normalizedText.toLowerCase();
  const vehicleType = lowerText.includes("e-bike") || lowerText.includes("ebike")
    ? "E-bike"
    : lowerText.includes("scooter")
      ? "Scooter"
      : lowerText.includes("motorcycle")
        ? "Motorcycle"
        : "";

  return {
    plateNumber,
    model,
    year,
    registrationExpiry,
    vehicleType,
    isExpired: Boolean(registrationExpiry && isExpiredDateValue(registrationExpiry)),
  };
};

const getDocumentIcon = (key) => {
  switch (key) {
    case "driverLicense":
      return <BadgeOutlined sx={{ fontSize: 18 }} />;
    case "vehicleORCR":
      return <DirectionsBikeRounded sx={{ fontSize: 18 }} />;
    case "governmentId":
      return <PersonRounded sx={{ fontSize: 18 }} />;
    case "selfiePhoto":
      return <CloudUploadRounded sx={{ fontSize: 18 }} />;
    default:
      return <DescriptionOutlined sx={{ fontSize: 18 }} />;
  }
};

const buildAutofillForm = (previousForm, profile, currentUser, documents, prefill = {}) => {
  const typedIdentifier = String(prefill.identifier || "").trim();
  const prefillEmail = typedIdentifier.includes("@") ? typedIdentifier : "";
  const prefillPhone = /^09\d{9}$/.test(typedIdentifier) ? typedIdentifier : "";
  const inferredName = inferFullNameFromDocuments(documents);
  const scannedFields = collectScannedFields(documents);
  const memberSince = profile?.createdAt?.seconds
    ? new Date(profile.createdAt.seconds * 1000).getFullYear().toString()
    : new Date().getFullYear().toString();

  return {
    ...previousForm,
    fullName: pickAutofillValue("fullName", previousForm.fullName, scannedFields.fullName, profile?.fullName, profile?.name, currentUser?.displayName, inferredName, "Rider Applicant"),
    email: pickAutofillValue("email", previousForm.email, profile?.email, currentUser?.email, prefillEmail),
    phone: pickAutofillValue("phone", previousForm.phone, profile?.contactNumber, profile?.phone, prefillPhone),
    birthYear: pickAutofillValue("birthYear", previousForm.birthYear, scannedFields.birthYear, profile?.birthYear, profile?.yearBorn),
    age: pickAutofillValue("age", previousForm.age, scannedFields.age, profile?.age),
    civilStatus: pickAutofillValue("civilStatus", previousForm.civilStatus, profile?.civilStatus, "Resident"),
    address: pickAutofillValue("address", previousForm.address, scannedFields.address, profile?.address, profile?.streetAddress, "Zone 1, Barangay Central"),
    municipality: pickAutofillValue("municipality", previousForm.municipality, scannedFields.municipality || inferMunicipality(scannedFields.address), profile?.city, profile?.municipality, "Metro Manila"),
    memberSince: pickAutofillValue("memberSince", previousForm.memberSince, memberSince),
    vehicleType: pickAutofillValue("vehicleType", previousForm.vehicleType, profile?.vehicleType),
    plateNumber: pickAutofillValue("plateNumber", previousForm.plateNumber, profile?.licensePlate, profile?.plateNumber),
    color: pickAutofillValue("color", previousForm.color, profile?.vehicleColor),
    yearModel: pickAutofillValue("yearModel", previousForm.yearModel, profile?.yearModel),
    licenseNumber: pickAutofillValue("licenseNumber", previousForm.licenseNumber, scannedFields.licenseNumber, profile?.licenseNumber),
    serviceArea: pickAutofillValue("serviceArea", previousForm.serviceArea, profile?.serviceArea),
    notes: pickAutofillValue("notes", previousForm.notes, profile?.notes),
  };
};

const createReferenceNo = () => {
  const randomNumber = Math.floor(10000 + Math.random() * 90000);
  const suffix = Math.random().toString(36).slice(2, 4).toUpperCase();
  return `PR-${randomNumber}-${suffix}`;
};

const uploadApplicationDocument = async (userId, docKey, file) => {
  if (!userId || !file) return null;

  const safeFileName = String(file.name || `${docKey}.jpg`).replace(/[^A-Za-z0-9._-]+/g, "_");
  const fileRef = storageRef(storage, `users/${userId}/riderApplications/${docKey}/${Date.now()}_${safeFileName}`);

  await uploadBytes(fileRef, file, {
    contentType: file.type || "application/octet-stream",
  });

  const downloadUrl = await getDownloadURL(fileRef);

  return {
    storagePath: fileRef.fullPath,
    downloadUrl,
  };
};

const firebaseFunctions = getFunctions(app, "us-central1");

export default function RiderApplicationPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm] = useState({
    lastName: "",
    firstName: "",
    middleName: "",
    extName: "",
    email: "",
    phone: "",
    birthDate: "",
    vehicleType: "",
    model: "",
    year: "",
    plateNumber: "",
    registrationExpiry: "",
  });
  const [emailStatus, setEmailStatus] = useState("idle");
  const [emailMessage, setEmailMessage] = useState("Only registered members can continue to the next step.");
  const [phoneError, setPhoneError] = useState("");
  const [documents, setDocuments] = useState({});
  const [vehicleDocError, setVehicleDocError] = useState("");
  const [vehicleScanStatus, setVehicleScanStatus] = useState("idle");
  const [vehicleScanMessage, setVehicleScanMessage] = useState("");
  const [driverLicenseScanStatus, setDriverLicenseScanStatus] = useState("idle");
  const [driverLicenseScanMessage, setDriverLicenseScanMessage] = useState("");
  const [faceMatchStatus, setFaceMatchStatus] = useState("idle");
  const [faceMatchMessage, setFaceMatchMessage] = useState("Upload your Driver's License first, then start Face Recognition with a clear selfie.");
  const [verificationError, setVerificationError] = useState("");
  const [draftNotice, setDraftNotice] = useState("");
  const [certifyAccepted, setCertifyAccepted] = useState(false);
  const [submittingApplication, setSubmittingApplication] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [copyStatus, setCopyStatus] = useState("");
  const vehicleOrcrInputRef = useRef(null);

  useEffect(() => () => {
    [
      documents.vehicleORCR?.preview,
      documents.driverLicense?.preview,
      documents.governmentId?.preview,
      documents.selfiePhoto?.preview,
    ]
      .filter(Boolean)
      .forEach((previewUrl) => URL.revokeObjectURL(previewUrl));
  }, [documents.vehicleORCR?.preview, documents.driverLicense?.preview, documents.governmentId?.preview, documents.selfiePhoto?.preview]);

  const isVehicleOrcrExpired = useMemo(() => isExpiredDateValue(form.registrationExpiry), [form.registrationExpiry]);
  const isDriverLicenseExpired = useMemo(
    () => Boolean(documents.driverLicense?.scannedData?.licenseExpiry && isExpiredDateValue(documents.driverLicense.scannedData.licenseExpiry)),
    [documents.driverLicense?.scannedData?.licenseExpiry]
  );
  const canContinueToVehicle = emailStatus === "found" && /^09\d{9}$/.test(form.phone);
  const canContinueToDocuments = Boolean(
    String(form.vehicleType || "").trim() &&
    String(form.model || "").trim() &&
    /^\d{4}$/.test(String(form.year || "")) &&
    String(form.plateNumber || "").trim() &&
    String(form.registrationExpiry || "").trim() &&
    documents.vehicleORCR?.name &&
    !isVehicleOrcrExpired &&
    vehicleScanStatus !== "scanning"
  );
  const canContinueToComplete = Boolean(
    documents.driverLicense?.name &&
    !isDriverLicenseExpired &&
    documents.governmentId?.name &&
    documents.selfiePhoto?.name &&
    ["matched", "review"].includes(faceMatchStatus)
  );
  const canSubmitApplication = canContinueToComplete && certifyAccepted;
  const applicantDisplayName = [form.firstName, form.middleName, form.lastName, form.extName].filter(Boolean).join(" ") || "Rider Applicant";
  const applicantBirthDateLabel = form.birthDate
    ? new Date(`${form.birthDate}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "Not provided";

  const progressPercent = currentStep === 1 ? 25 : currentStep === 2 ? 50 : currentStep === 3 ? 75 : 100;
  const stepHeading =
    currentStep === 1
      ? "Personal Information"
      : currentStep === 2
        ? "Vehicle Information"
        : currentStep === 3
          ? "Verification Documents"
          : currentStep === 4
            ? "Review & Submit"
            : "Application Submitted";
  const stepCountLabel = currentStep > 4 ? "Submitted" : `Step ${Math.min(currentStep, 4)} of 4`;

  const handleFieldChange = (key, value) => {
    if (key === "phone") {
      const digitsOnly = value.replace(/\D/g, "").slice(0, 11);
      setForm((prev) => ({ ...prev, phone: digitsOnly }));
      setPhoneError(digitsOnly && !/^09\d{9}$/.test(digitsOnly) ? "Phone number must be 11 digits and start with 09." : "");
      return;
    }

    if (key === "year") {
      const digitsOnly = value.replace(/\D/g, "").slice(0, 4);
      setForm((prev) => ({ ...prev, year: digitsOnly }));
      return;
    }

    if (key === "plateNumber") {
      const normalizedPlate = value.toUpperCase().replace(/[^A-Z0-9\- ]/g, "").slice(0, 12);
      setForm((prev) => ({ ...prev, plateNumber: normalizedPlate }));
      return;
    }

    if (key === "registrationExpiry") {
      setForm((prev) => ({ ...prev, registrationExpiry: value }));
      if (!value || !isExpiredDateValue(value)) {
        setVehicleDocError("");
      }
      return;
    }

    if (key === "email") {
      setEmailStatus("idle");
      setEmailMessage("");
    }

    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const checkRegisteredEmail = async () => {
    const normalizedEmail = String(form.email || "").trim().toLowerCase();

    if (!normalizedEmail) {
      setEmailStatus("invalid");
      setEmailMessage("Email address is required.");
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setEmailStatus("invalid");
      setEmailMessage("Enter a valid email address.");
      return false;
    }

    setEmailStatus("checking");
    setEmailMessage("Validating registered member email...");

    try {
      const checkMemberEmail = httpsCallable(firebaseFunctions, "checkMemberEmail");
      const result = await checkMemberEmail({ email: normalizedEmail });

      if (result?.data?.hasExistingApplication) {
        const existingStatus = String(result?.data?.existingApplicationStatus || "UNDER_REVIEW")
          .replace(/_/g, " ")
          .toLowerCase();
        const referenceSuffix = result?.data?.existingReferenceNo ? ` Reference: ${result.data.existingReferenceNo}.` : "";
        setEmailStatus("submitted");
        setEmailMessage(`You've already submitted a rider application and it is currently ${existingStatus}.${referenceSuffix}`);
        return false;
      }

      if (result?.data?.exists) {
        setEmailStatus("found");
        setEmailMessage("Registered member email found.");
        return true;
      }

      setEmailStatus("missing");
      setEmailMessage("This email is not registered in the system yet.");
      return false;
    } catch (error) {
      console.warn("Cloud Function email verification unavailable, trying Firebase Auth fallback:", error);
    }

    try {
      const methods = await fetchSignInMethodsForEmail(auth, normalizedEmail);
      if (Array.isArray(methods) && methods.length > 0) {
        setEmailStatus("found");
        setEmailMessage("Registered member email found.");
        return true;
      }

      setEmailStatus("missing");
      setEmailMessage("This email is not registered in the system yet.");
      return false;
    } catch (fallbackError) {
      console.warn("Fallback email verification failed:", fallbackError);
      setEmailStatus("error");
      setEmailMessage("Email verification service is temporarily unavailable. Please try again later.");
      return false;
    }
  };

  const handleVehicleOrcrUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (documents.vehicleORCR?.preview) {
      URL.revokeObjectURL(documents.vehicleORCR.preview);
    }

    const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : "";

    setDocuments((prev) => ({
      ...prev,
      vehicleORCR: {
        name: file.name,
        type: file.type,
        size: file.size,
        preview,
        scannedData: {},
      },
    }));
    setVehicleDocError("");
    setVehicleScanStatus("scanning");
    setVehicleScanMessage("Smart AI scan is reading your Vehicle OR/CR...");

    try {
      if (!file.type.startsWith("image/")) {
        throw new Error("OCR works best with image uploads.");
      }

      const Tesseract = await loadTesseract();
      if (!Tesseract?.recognize) {
        throw new Error("OCR service unavailable.");
      }

      const preparedImage = await prepareImageForOcr(file);
      const result = await Tesseract.recognize(preparedImage, "eng", {
        logger: () => {},
      });
      const scannedData = extractVehicleFields(result?.data?.text || "");
      const detectedSummary = summarizeScannedFields(scannedData);

      setDocuments((prev) => ({
        ...prev,
        vehicleORCR: {
          ...prev.vehicleORCR,
          scannedData,
        },
      }));

      setForm((prev) => ({
        ...prev,
        vehicleType: prev.vehicleType || scannedData.vehicleType || prev.vehicleType,
        model: prev.model || scannedData.model || prev.model,
        year: prev.year || scannedData.year || prev.year,
        plateNumber: prev.plateNumber || scannedData.plateNumber || prev.plateNumber,
        registrationExpiry: prev.registrationExpiry || scannedData.registrationExpiry || prev.registrationExpiry,
      }));

      if (scannedData.isExpired) {
        setVehicleScanStatus("expired");
        setVehicleDocError("Vehicle OR/CR is expired. Please upload a valid, updated document.");
        setVehicleScanMessage("Smart AI detected that your Vehicle OR/CR appears expired. Please upload a renewed OR/CR.");
        return;
      }

      setVehicleScanStatus(detectedSummary ? "complete" : "uploaded");
      setVehicleScanMessage(
        detectedSummary
          ? `Smart AI autofilled ${detectedSummary}. Please review the details below.`
          : "Vehicle OR/CR uploaded. Smart AI could not read every field, so please complete the missing details manually."
      );
    } catch (error) {
      console.error("Vehicle OR/CR scan failed:", error);
      setVehicleScanStatus("uploaded");
      setVehicleScanMessage(
        file.type === "application/pdf"
          ? "Vehicle OR/CR PDF uploaded. Smart AI scan works best with a clear photo, so please verify the fields manually."
          : "Vehicle OR/CR uploaded, but Smart AI could not scan it clearly. Please verify the fields manually."
      );
    }
  };

  const runFaceRecognition = async (licenseFile = documents.driverLicense?.file, selfieFile = documents.selfiePhoto?.file) => {
    if (!licenseFile) {
      setFaceMatchStatus("error");
      setFaceMatchMessage("Upload your Driver's License first before starting Face Recognition.");
      return false;
    }

    if (!selfieFile) {
      setFaceMatchStatus("error");
      setFaceMatchMessage("Upload or capture a clear selfie to start Face Recognition.");
      return false;
    }

    setFaceMatchStatus("scanning");
    setFaceMatchMessage("Comparing the selfie with the Driver's License photo...");

    try {
      const result = await compareFaceImages(licenseFile, selfieFile);
      setFaceMatchStatus(result.status);
      setFaceMatchMessage(result.message);
      return result.status === "matched" || result.status === "review";
    } catch (error) {
      console.error("Face recognition failed:", error);
      setFaceMatchStatus("error");
      setFaceMatchMessage("Face Recognition could not complete. Please upload a clearer driver's license and selfie.");
      return false;
    }
  };

  const handleVerificationDocumentUpload = async (docKey, event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (documents[docKey]?.preview) {
      URL.revokeObjectURL(documents[docKey].preview);
    }

    const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : "";

    setDocuments((prev) => ({
      ...prev,
      [docKey]: {
        name: file.name,
        type: file.type,
        size: file.size,
        file,
        preview,
        scannedData: {},
      },
    }));

    setVerificationError("");
    setDraftNotice("");

    if (docKey === "driverLicense") {
      setDriverLicenseScanStatus("scanning");
      setDriverLicenseScanMessage("Checking your Driver's License details and expiry date...");
    }

    if (["driverLicense", "governmentId"].includes(docKey) && file.type.startsWith("image/")) {
      try {
        const Tesseract = await loadTesseract();
        if (Tesseract?.recognize) {
          const preparedImage = await prepareImageForOcr(file);
          const result = await Tesseract.recognize(preparedImage, "eng", { logger: () => {} });
          const scannedData = extractIdentityFields(result?.data?.text || "", docKey);

          setDocuments((prev) => ({
            ...prev,
            [docKey]: {
              ...prev[docKey],
              scannedData,
            },
          }));

          if (docKey === "driverLicense") {
            if (scannedData.isExpired) {
              setDriverLicenseScanStatus("expired");
              setDriverLicenseScanMessage(
                `Smart AI detected that your Driver's License appears expired${scannedData.licenseExpiry ? ` as of ${scannedData.licenseExpiry}` : ""}. Please upload a valid, updated license.`
              );
            } else if (scannedData.licenseExpiry) {
              setDriverLicenseScanStatus("complete");
              setDriverLicenseScanMessage(`Smart AI checked your Driver's License and it appears valid until ${scannedData.licenseExpiry}.`);
            } else {
              setDriverLicenseScanStatus("uploaded");
              setDriverLicenseScanMessage("Driver's License uploaded. Smart AI could not clearly read the expiry date, so please make sure the photo is clear.");
            }
          }
        } else if (docKey === "driverLicense") {
          setDriverLicenseScanStatus("uploaded");
          setDriverLicenseScanMessage("Driver's License uploaded. Smart AI scan is currently unavailable, so the expiry date may need manual review.");
        }
      } catch (error) {
        console.warn(`Unable to scan ${docKey}:`, error);
        if (docKey === "driverLicense") {
          setDriverLicenseScanStatus("uploaded");
          setDriverLicenseScanMessage("Driver's License uploaded, but Smart AI could not verify the expiry date clearly. Please ensure the expiry date is readable.");
        }
      }
    } else if (docKey === "driverLicense") {
      setDriverLicenseScanStatus("uploaded");
      setDriverLicenseScanMessage(
        file.type === "application/pdf"
          ? "Driver's License PDF uploaded. Please ensure the expiry date is visible for manual review."
          : "Driver's License uploaded."
      );
    }

    if (docKey === "driverLicense") {
      if (documents.selfiePhoto?.file) {
        await runFaceRecognition(file, documents.selfiePhoto.file);
      } else {
        setFaceMatchStatus("idle");
        setFaceMatchMessage("Driver's License uploaded. Now upload or capture a selfie to start Face Recognition.");
      }
    }

    if (docKey === "selfiePhoto") {
      await runFaceRecognition(documents.driverLicense?.file, file);
    }

    event.target.value = "";
  };

  const handleSaveDraft = () => {
    const safeDocuments = Object.entries(documents).reduce((accumulator, [key, value]) => {
      accumulator[key] = {
        name: value?.name || "",
        type: value?.type || "",
        scannedData: value?.scannedData || {},
      };
      return accumulator;
    }, {});

    localStorage.setItem(
      "riderApplicationDraft",
      JSON.stringify({
        savedAt: new Date().toISOString(),
        form,
        documents: safeDocuments,
      })
    );

    setDraftNotice("Draft saved on this device.");
  };

  const handleContinueToVehicle = async () => {
    const phoneIsValid = /^09\d{9}$/.test(form.phone);
    if (!phoneIsValid) {
      setPhoneError("Phone number must be 11 digits and start with 09.");
      return;
    }

    const emailExists = await checkRegisteredEmail();
    if (!emailExists) return;

    setCurrentStep(2);
  };

  const handleContinueToDocuments = () => {
    if (!documents.vehicleORCR?.name) {
      setVehicleDocError("Vehicle OR/CR is required before continuing.");
      return;
    }

    if (!form.registrationExpiry) {
      setVehicleDocError("Please confirm the OR/CR expiry date before continuing.");
      return;
    }

    if (isVehicleOrcrExpired) {
      setVehicleDocError("Vehicle OR/CR is expired. Please upload a valid, updated document.");
      return;
    }

    setVehicleDocError("");
    setCurrentStep(3);
  };

  const handleContinueToComplete = () => {
    if (!documents.driverLicense?.name) {
      setVerificationError("Driver's License is required before continuing.");
      return;
    }

    if (isDriverLicenseExpired) {
      setVerificationError(
        `Driver's License appears expired${documents.driverLicense?.scannedData?.licenseExpiry ? ` as of ${documents.driverLicense.scannedData.licenseExpiry}` : ""}. Please upload a valid, updated license before continuing.`
      );
      return;
    }

    if (!documents.selfiePhoto?.name) {
      setVerificationError("Face Recognition is required. Please capture or upload a selfie.");
      return;
    }

    if (!["matched", "review"].includes(faceMatchStatus)) {
      setVerificationError("Please complete the Face Recognition step before continuing.");
      return;
    }

    if (!documents.governmentId?.name) {
      setVerificationError("Government ID is required before continuing.");
      return;
    }

    setVerificationError("");
    setCurrentStep(4);
  };

  const handleSubmitApplication = async () => {
    if (!certifyAccepted) {
      setVerificationError("Please certify that all information is true and accurate before submitting.");
      return;
    }

    if (submittingApplication) return;

    setSubmittingApplication(true);
    setVerificationError("");
    setDraftNotice("");
    setCopyStatus("");

    try {
      const uploadedDocuments = {};

      for (const [docKey, docValue] of Object.entries(documents)) {
        if (!docValue?.name) continue;

        let uploadedMeta = null;
        if (auth.currentUser?.uid && docValue.file) {
          try {
            uploadedMeta = await uploadApplicationDocument(auth.currentUser.uid, docKey, docValue.file);
          } catch (uploadError) {
            console.warn(`Unable to upload ${docKey} to Firebase Storage:`, uploadError);
          }
        }

        uploadedDocuments[docKey] = {
          name: docValue.name || "",
          type: docValue.type || "",
          scannedData: docValue.scannedData || {},
          ...uploadedMeta,
        };
      }

      const submitRiderApplication = httpsCallable(firebaseFunctions, "submitRiderApplication");
      const result = await submitRiderApplication({
        applicant: {
          lastName: form.lastName,
          firstName: form.firstName,
          middleName: form.middleName,
          extName: form.extName,
          fullName: applicantDisplayName,
          email: form.email,
          phone: form.phone,
          birthDate: form.birthDate,
        },
        vehicle: {
          vehicleType: form.vehicleType,
          model: form.model,
          year: form.year,
          plateNumber: form.plateNumber,
          registrationExpiry: form.registrationExpiry,
        },
        verification: {
          emailStatus,
          faceMatchStatus,
          faceMatchMessage,
        },
        documents: uploadedDocuments,
      });

      const responseData = result?.data || {};
      setSubmissionResult({
        applicationId: responseData.applicationId || "",
        referenceNo: responseData.referenceNo || createReferenceNo(),
        reviewEta: responseData.reviewEta || "3-5 business days",
        emailSent: Boolean(responseData.emailSent),
        emailError: String(responseData.emailError || ""),
      });
      localStorage.removeItem("riderApplicationDraft");
      setCurrentStep(5);
    } catch (error) {
      console.error("Unable to submit rider application:", error);
      setVerificationError("Unable to submit your application right now. Please try again.");
    } finally {
      setSubmittingApplication(false);
    }
  };

  const handleCopyReference = async () => {
    const referenceNo = submissionResult?.referenceNo;
    if (!referenceNo) return;

    try {
      await navigator.clipboard.writeText(referenceNo);
      setCopyStatus("Copied");
    } catch (error) {
      console.error("Unable to copy reference number:", error);
      setCopyStatus("Copy failed");
    }
  };

  const handleReturnToDashboard = () => {
    const role = String(localStorage.getItem("userRole") || "").toUpperCase();

    if (["ADMIN", "CEO", "SUPERADMIN"].includes(role)) {
      navigate("/admin/dashboard");
      return;
    }

    if (role === "RIDER") {
      navigate("/rider/dashboard");
      return;
    }

    if (["MASTERMD", "MD", "MS", "MI", "AGENT", "MEMBER", "MERCHANT"].includes(role)) {
      navigate("/member/dashboard");
      return;
    }

    navigate("/rider/login");
  };

  return (
    <div className="rider-application-page">
      <div className="rider-application-shell">
        <div className="rider-application-topbar">
          {currentStep !== 5 ? (
            <button type="button" className="rider-application-back" onClick={() => (currentStep === 1 ? navigate("/rider/login") : setCurrentStep((prev) => prev - 1))}>
              <ArrowBackRounded sx={{ fontSize: 18 }} />
              <span>Back</span>
            </button>
          ) : null}
          <div className="rider-application-brand">
            <img src={plezzIcon} alt="PLEZZ Rider" className="rider-application-brand-icon" />
            <span>Plezz Rider</span>
          </div>
        </div>

        <div className="rider-application-card">
          {currentStep !== 5 && (
            <>
              <div className="rider-application-progress-row">
                <div>
                  <div className="rider-application-kicker">Registration</div>
                  <div className="rider-application-step-meta">{stepHeading}</div>
                </div>
                <div className="rider-application-step-pill">{stepCountLabel}</div>
              </div>

              <div className="rider-application-progress-bar">
                <span style={{ width: `${progressPercent}%` }} />
              </div>
            </>
          )}

          {currentStep === 1 && (
            <>
              <div className="rider-application-form-card">
                <div className="rider-application-name-grid">
                  <label className="rider-application-field-group">
                    <span className="rider-application-field-label">Last Name</span>
                    <div className="rider-application-field-shell">
                      <input
                        value={form.lastName}
                        onChange={(e) => handleFieldChange("lastName", e.target.value)}
                        className="rider-application-clean-input"
                        placeholder="Surname"
                      />
                      <PersonRounded className="rider-application-field-icon" sx={{ fontSize: 18 }} />
                    </div>
                  </label>

                  <label className="rider-application-field-group">
                    <span className="rider-application-field-label">First Name</span>
                    <div className="rider-application-field-shell">
                      <input
                        value={form.firstName}
                        onChange={(e) => handleFieldChange("firstName", e.target.value)}
                        className="rider-application-clean-input"
                        placeholder="Given name"
                      />
                      <PersonRounded className="rider-application-field-icon" sx={{ fontSize: 18 }} />
                    </div>
                  </label>

                  <label className="rider-application-field-group">
                    <span className="rider-application-field-label">Middle Name</span>
                    <div className="rider-application-field-shell">
                      <input
                        value={form.middleName}
                        onChange={(e) => handleFieldChange("middleName", e.target.value)}
                        className="rider-application-clean-input"
                        placeholder="Middle name"
                      />
                      <PersonRounded className="rider-application-field-icon" sx={{ fontSize: 18 }} />
                    </div>
                  </label>

                  <label className="rider-application-field-group">
                    <span className="rider-application-field-label">Ext. Name (if applicable)</span>
                    <div className="rider-application-field-shell">
                      <input
                        value={form.extName}
                        onChange={(e) => handleFieldChange("extName", e.target.value)}
                        className="rider-application-clean-input"
                        placeholder="Jr., Sr., III"
                      />
                      <PersonRounded className="rider-application-field-icon" sx={{ fontSize: 18 }} />
                    </div>
                  </label>
                </div>

                <label className="rider-application-field-group">
                  <span className="rider-application-field-label">Email Address</span>
                  <div className="rider-application-field-shell">
                    <input
                      value={form.email}
                      onChange={(e) => handleFieldChange("email", e.target.value)}
                      onBlur={checkRegisteredEmail}
                      className="rider-application-clean-input"
                      placeholder="name@example.com"
                    />
                    {emailStatus === "checking" ? (
                      <CircularProgress size={16} thickness={5} sx={{ color: "#2563eb" }} />
                    ) : (
                      <EmailRounded className="rider-application-field-icon" sx={{ fontSize: 18 }} />
                    )}
                  </div>
                  {emailMessage ? (
                    <div className={`rider-application-field-feedback is-${emailStatus === "found" ? "success" : emailStatus === "checking" ? "checking" : "error"}`}>
                      {emailMessage}
                    </div>
                  ) : null}
                </label>

                <label className="rider-application-field-group">
                  <span className="rider-application-field-label">Phone Number</span>
                  <div className="rider-application-field-shell">
                    <input
                      value={form.phone}
                      onChange={(e) => handleFieldChange("phone", e.target.value)}
                      className="rider-application-clean-input"
                      placeholder="09XXXXXXXXX"
                      inputMode="numeric"
                      maxLength={11}
                    />
                    <PhoneIphoneRounded className="rider-application-field-icon" sx={{ fontSize: 18 }} />
                  </div>
                  {phoneError ? <div className="rider-application-field-feedback is-error">{phoneError}</div> : null}
                </label>

                <label className="rider-application-field-group">
                  <span className="rider-application-field-label">Date of Birth</span>
                  <div className="rider-application-field-shell">
                    <input
                      type="date"
                      value={form.birthDate}
                      onChange={(e) => handleFieldChange("birthDate", e.target.value)}
                      className="rider-application-clean-input rider-application-date-input"
                      max={new Date().toISOString().split("T")[0]}
                    />
                    <CalendarTodayRounded className="rider-application-field-icon" sx={{ fontSize: 18 }} />
                  </div>
                </label>

                <div className="rider-application-info-box">
                  <CheckCircleRounded sx={{ fontSize: 18 }} />
                  <span>
                    We need this information to verify your identity and ensure you meet the minimum age requirement for rides in your region.
                  </span>
                </div>
              </div>

              <div className="rider-application-step-actions">
                <button type="button" className="rider-application-exit-btn" onClick={() => navigate("/rider/login")}>
                  Exit Application
                </button>

                <button
                  type="button"
                  className="rider-application-primary-btn"
                  onClick={handleContinueToVehicle}
                  disabled={!canContinueToVehicle || emailStatus === "checking"}
                >
                  <span>{emailStatus === "checking" ? "Checking member account..." : "Continue to Step 2"}</span>
                  {emailStatus !== "checking" && <ArrowForwardRounded sx={{ fontSize: 18 }} />}
                </button>
              </div>
            </>
          )}

          {currentStep === 2 && (
            <>
              <div className="rider-application-form-card">
                <div className="rider-application-upload-summary">
                  <AutoAwesomeRounded sx={{ fontSize: 18 }} />
                  <span>Upload your Vehicle OR/CR and let Smart AI scan autofill the vehicle details.</span>
                </div>

                <input
                  ref={vehicleOrcrInputRef}
                  id="rider-vehicle-orcr-upload"
                  type="file"
                  accept="image/*,.pdf"
                  className="rider-application-document-input"
                  onChange={handleVehicleOrcrUpload}
                />

                <label className="rider-application-upload-card is-registration-card" htmlFor="rider-vehicle-orcr-upload">
                  <div className="rider-application-registration-row">
                    <div className="rider-application-registration-icon">{getDocumentIcon("vehicleORCR")}</div>
                    <div className="rider-application-registration-body">
                      <div className="rider-application-upload-card-top">
                        <div>
                          <div className="rider-application-upload-title">Vehicle OR/CR</div>
                          <div className="rider-application-upload-hint">Required. Upload a clear and updated OR/CR so Smart AI can scan and autofill the fields below.</div>
                        </div>
                        <span className={`rider-application-upload-status ${documents.vehicleORCR?.name ? "is-complete" : ""} ${isVehicleOrcrExpired ? "is-warning" : ""}`}>
                          {isVehicleOrcrExpired ? "Expired" : documents.vehicleORCR?.name ? "Uploaded" : "Required"}
                        </span>
                      </div>

                      <div className="rider-application-upload-box">
                        {documents.vehicleORCR?.preview ? (
                          <img src={documents.vehicleORCR.preview} alt="Vehicle OR/CR preview" className="rider-application-upload-preview" />
                        ) : (
                          <>
                            <CloudUploadRounded sx={{ fontSize: 22 }} />
                            <span>Tap to upload your Vehicle OR/CR</span>
                            <small>JPG, PNG, or PDF</small>
                          </>
                        )}
                      </div>

                      <div className="rider-application-registration-footer">
                        <span className="rider-application-registration-link">{documents.vehicleORCR?.name || "Choose document"}</span>
                        <span className="rider-application-smart-action">{vehicleScanStatus === "scanning" ? "Scanning..." : "Smart AI scan"}</span>
                      </div>

                      {documents.vehicleORCR?.scannedData && summarizeScannedFields(documents.vehicleORCR.scannedData) ? (
                        <div className="rider-application-registration-detected">Detected: {summarizeScannedFields(documents.vehicleORCR.scannedData)}</div>
                      ) : null}
                    </div>
                  </div>
                </label>

                {vehicleDocError ? <div className="rider-application-field-feedback is-error">{vehicleDocError}</div> : null}

                <div className="rider-application-grid">
                  <label className="rider-application-field-group">
                    <span className="rider-application-field-label">Vehicle Type</span>
                    <div className="rider-application-field-shell rider-application-select-shell">
                      <DirectionsBikeRounded className="rider-application-field-icon is-leading" sx={{ fontSize: 18 }} />
                      <select
                        value={form.vehicleType}
                        onChange={(e) => handleFieldChange("vehicleType", e.target.value)}
                        className="rider-application-clean-input rider-application-clean-select"
                      >
                        <option value="">Select your vehicle type</option>
                        <option value="Motorcycle">Motorcycle</option>
                        <option value="Scooter">Scooter</option>
                        <option value="E-bike">E-bike</option>
                      </select>
                      <ChevronRightRounded className="rider-application-field-icon rider-application-select-arrow" sx={{ fontSize: 18 }} />
                    </div>
                  </label>

                  <label className="rider-application-field-group">
                    <span className="rider-application-field-label">Model</span>
                    <div className="rider-application-field-shell">
                      <input
                        value={form.model}
                        onChange={(e) => handleFieldChange("model", e.target.value)}
                        className="rider-application-clean-input"
                        placeholder="e.g. Honda Click"
                      />
                      <DirectionsBikeRounded className="rider-application-field-icon" sx={{ fontSize: 18 }} />
                    </div>
                  </label>

                  <label className="rider-application-field-group">
                    <span className="rider-application-field-label">Year Model</span>
                    <div className="rider-application-field-shell">
                      <input
                        value={form.year}
                        onChange={(e) => handleFieldChange("year", e.target.value)}
                        className="rider-application-clean-input"
                        placeholder="2025"
                        inputMode="numeric"
                        maxLength={4}
                      />
                      <CalendarTodayRounded className="rider-application-field-icon" sx={{ fontSize: 18 }} />
                    </div>
                  </label>

                  <label className="rider-application-field-group">
                    <span className="rider-application-field-label">Plate Number</span>
                    <div className="rider-application-field-shell">
                      <input
                        value={form.plateNumber}
                        onChange={(e) => handleFieldChange("plateNumber", e.target.value)}
                        className="rider-application-clean-input"
                        placeholder="ABC-1234"
                      />
                      <BadgeOutlined className="rider-application-field-icon" sx={{ fontSize: 18 }} />
                    </div>
                  </label>
                </div>

                <label className="rider-application-field-group rider-application-full-width">
                  <span className="rider-application-field-label">OR/CR Expiry Date</span>
                  <div className="rider-application-field-shell">
                    <input
                      type="date"
                      value={form.registrationExpiry}
                      onChange={(e) => handleFieldChange("registrationExpiry", e.target.value)}
                      className="rider-application-clean-input rider-application-date-input"
                    />
                    <CalendarTodayRounded className="rider-application-field-icon" sx={{ fontSize: 18 }} />
                  </div>
                </label>

                {vehicleScanStatus !== "idle" && vehicleScanMessage ? (
                  <div className={`rider-application-note ${vehicleScanStatus === "complete" ? "is-success" : vehicleScanStatus === "expired" ? "is-warning" : vehicleScanStatus === "error" ? "is-error" : ""}`}>
                    <AutoAwesomeRounded sx={{ fontSize: 18 }} />
                    <span>{vehicleScanMessage}</span>
                  </div>
                ) : null}

                {isVehicleOrcrExpired ? (
                  <div className="rider-application-note is-warning">
                    <WarningAmberRounded sx={{ fontSize: 18 }} />
                    <span>
                      The uploaded Vehicle OR/CR appears expired{form.registrationExpiry ? ` as of ${form.registrationExpiry}.` : "."} Please upload a valid, updated document before continuing.
                    </span>
                  </div>
                ) : null}

                <button
                  type="button"
                  className="rider-application-primary-btn rider-application-inline-submit"
                  onClick={handleContinueToDocuments}
                  disabled={!canContinueToDocuments}
                >
                  <span>{vehicleScanStatus === "scanning" ? "Scanning OR/CR..." : "Continue to Step 3"}</span>
                  {vehicleScanStatus !== "scanning" && <ArrowForwardRounded sx={{ fontSize: 18 }} />}
                </button>
              </div>

              <div className="rider-application-vehicle-showcase">
                <div className="rider-application-vehicle-banner">
                  <img src={riderPreview} alt="Vehicle preview" className="rider-application-vehicle-photo" />
                  <div className="rider-application-vehicle-overlay">
                    <span className="rider-application-vehicle-badge">Rider Fit</span>
                    <strong className="rider-application-vehicle-copy">Reliable city starts with a complete, valid, and well-maintained vehicle.</strong>
                  </div>
                </div>

                <div className="rider-application-info-box is-muted">
                  <WarningAmberRounded sx={{ fontSize: 18 }} />
                  <span>
                    Your Vehicle OR/CR is required and must be valid. If Smart AI detects that it is expired, you will need to upload a renewed copy before moving forward.
                  </span>
                </div>
              </div>
            </>
          )}

          {currentStep === 3 && (
            <>
              <div className="rider-application-form-card">
                <h1 className="rider-application-title">Verification Documents</h1>
                <p className="rider-application-subtitle">
                  Please upload clear copies of your documents. Ensure all details are legible and match the form.
                </p>

                <div className="rider-application-upload-list is-registration">
                  <input
                    id="rider-driver-license-upload"
                    type="file"
                    accept="image/*,.pdf"
                    capture="environment"
                    className="rider-application-document-input"
                    onChange={(event) => handleVerificationDocumentUpload("driverLicense", event)}
                  />

                  <label className="rider-application-upload-card is-registration-card" htmlFor="rider-driver-license-upload">
                    <div className="rider-application-registration-row">
                      <div className="rider-application-registration-icon">{getDocumentIcon("driverLicense")}</div>
                      <div className="rider-application-registration-body">
                        <div className="rider-application-upload-card-top">
                          <div>
                            <div className="rider-application-upload-title">Driver's License</div>
                            <div className="rider-application-upload-hint">Professional or non-professional ID card.</div>
                          </div>
                          <span className={`rider-application-upload-status ${documents.driverLicense?.name ? "is-complete" : ""} ${driverLicenseScanStatus === "scanning" || driverLicenseScanStatus === "expired" ? "is-warning" : ""}`}>
                            {driverLicenseScanStatus === "scanning"
                              ? "Scanning"
                              : isDriverLicenseExpired
                                ? "Expired"
                                : documents.driverLicense?.name
                                  ? "Uploaded"
                                  : "Required"}
                          </span>
                        </div>

                        <div className="rider-application-upload-box">
                          {documents.driverLicense?.preview ? (
                            <img src={documents.driverLicense.preview} alt="Driver's license preview" className="rider-application-upload-preview" />
                          ) : (
                            <>
                              <FilePresentRounded sx={{ fontSize: 22 }} />
                              <span>Take a photo of your Driver's License</span>
                              <small>Front side, readable photo</small>
                            </>
                          )}
                        </div>

                        <div className="rider-application-registration-footer">
                          <span className="rider-application-registration-link">{documents.driverLicense?.name || "Choose document"}</span>
                          <span className="rider-application-smart-action">Secure upload</span>
                        </div>

                        {documents.driverLicense?.scannedData && summarizeScannedFields(documents.driverLicense.scannedData) ? (
                          <div className="rider-application-registration-detected">Detected: {summarizeScannedFields(documents.driverLicense.scannedData)}</div>
                        ) : null}
                      </div>
                    </div>
                  </label>

                  <input
                    id="rider-face-recognition-upload"
                    type="file"
                    accept="image/*"
                    capture="user"
                    className="rider-application-document-input"
                    onChange={(event) => handleVerificationDocumentUpload("selfiePhoto", event)}
                  />

                  <label className="rider-application-upload-card is-registration-card" htmlFor="rider-face-recognition-upload">
                    <div className="rider-application-registration-row">
                      <div className="rider-application-registration-icon">{getDocumentIcon("selfiePhoto")}</div>
                      <div className="rider-application-registration-body">
                        <div className="rider-application-upload-card-top">
                          <div>
                            <div className="rider-application-upload-title">Face Recognition</div>
                            <div className="rider-application-upload-hint">Scan selfie to verify your identity against the Driver's License photo.</div>
                          </div>
                          <span className={`rider-application-upload-status ${faceMatchStatus === "matched" || faceMatchStatus === "review" ? "is-complete" : ""} ${faceMatchStatus === "scanning" ? "is-warning" : ""} ${faceMatchStatus === "mismatch" || faceMatchStatus === "error" ? "is-error" : ""}`}>
                            {faceMatchStatus === "matched"
                              ? "Passed"
                              : faceMatchStatus === "review"
                                ? "Passed"
                                : faceMatchStatus === "scanning"
                                  ? "Scanning"
                                  : faceMatchStatus === "mismatch"
                                    ? "Retry"
                                    : "Required"}
                          </span>
                        </div>

                        <div className="rider-application-upload-box">
                          {documents.selfiePhoto?.preview ? (
                            <img src={documents.selfiePhoto.preview} alt="Face recognition preview" className="rider-application-upload-preview" />
                          ) : (
                            <>
                              <PersonRounded sx={{ fontSize: 22 }} />
                              <span>Start Scan</span>
                              <small>Allow camera or upload a selfie</small>
                            </>
                          )}
                        </div>

                        <div className="rider-application-registration-footer">
                          <span className="rider-application-registration-link">{documents.selfiePhoto?.name || "Tap to start face scan"}</span>
                          <span className="rider-application-smart-action">{faceMatchStatus === "scanning" ? "Matching..." : faceMatchStatus === "matched" || faceMatchStatus === "review" ? "Passed" : "Start Scan"}</span>
                        </div>
                      </div>
                    </div>
                  </label>

                  <input
                    id="rider-government-id-upload"
                    type="file"
                    accept="image/*,.pdf"
                    capture="environment"
                    className="rider-application-document-input"
                    onChange={(event) => handleVerificationDocumentUpload("governmentId", event)}
                  />

                  <label className="rider-application-upload-card is-registration-card" htmlFor="rider-government-id-upload">
                    <div className="rider-application-registration-row">
                      <div className="rider-application-registration-icon">{getDocumentIcon("governmentId")}</div>
                      <div className="rider-application-registration-body">
                        <div className="rider-application-upload-card-top">
                          <div>
                            <div className="rider-application-upload-title">Government ID</div>
                            <div className="rider-application-upload-hint">UMID, Passport, or PhilSys / National ID.</div>
                          </div>
                          <span className={`rider-application-upload-status ${documents.governmentId?.name ? "is-complete" : ""}`}>
                            {documents.governmentId?.name ? "Uploaded" : "Required"}
                          </span>
                        </div>

                        <div className="rider-application-upload-box">
                          {documents.governmentId?.preview ? (
                            <img src={documents.governmentId.preview} alt="Government ID preview" className="rider-application-upload-preview" />
                          ) : (
                            <>
                              <CloudUploadRounded sx={{ fontSize: 22 }} />
                              <span>Take a photo</span>
                              <small>Back-up identity check</small>
                            </>
                          )}
                        </div>

                        <div className="rider-application-registration-footer">
                          <span className="rider-application-registration-link">{documents.governmentId?.name || "Choose document"}</span>
                          <span className="rider-application-smart-action">Required</span>
                        </div>

                        {documents.governmentId?.scannedData && summarizeScannedFields(documents.governmentId.scannedData) ? (
                          <div className="rider-application-registration-detected">Detected: {summarizeScannedFields(documents.governmentId.scannedData)}</div>
                        ) : null}
                      </div>
                    </div>
                  </label>
                </div>

                {driverLicenseScanMessage ? (
                  <div className={`rider-application-note ${driverLicenseScanStatus === "complete" ? "is-success" : driverLicenseScanStatus === "expired" ? "is-warning" : driverLicenseScanStatus === "error" ? "is-error" : ""}`}>
                    <AutoAwesomeRounded sx={{ fontSize: 18 }} />
                    <span>{driverLicenseScanMessage}</span>
                  </div>
                ) : null}

                {faceMatchMessage ? (
                  <div className={`rider-application-note ${faceMatchStatus === "matched" || faceMatchStatus === "review" ? "is-success" : faceMatchStatus === "mismatch" || faceMatchStatus === "error" ? "is-error" : ""}`}>
                    <AutoAwesomeRounded sx={{ fontSize: 18 }} />
                    <span>{faceMatchMessage}</span>
                  </div>
                ) : null}

                {verificationError ? (
                  <div className="rider-application-note is-error">
                    <WarningAmberRounded sx={{ fontSize: 18 }} />
                    <span>{verificationError}</span>
                  </div>
                ) : null}

                {draftNotice ? (
                  <div className="rider-application-note is-success">
                    <TaskAltRounded sx={{ fontSize: 18 }} />
                    <span>{draftNotice}</span>
                  </div>
                ) : null}

                <div className="rider-application-review-card rider-application-tips-card">
                  <div className="rider-application-section-title">
                    <CheckCircleRounded sx={{ fontSize: 18 }} />
                    <span>Submission Tips</span>
                  </div>
                  <ul className="rider-application-tips-list">
                    <li>Take document photos on a dark, flat surface.</li>
                    <li>Avoid glare from overhead lighting.</li>
                    <li>Ensure all four corners are visible.</li>
                  </ul>
                </div>
              </div>

              <div className="rider-application-step-actions is-single">
                <button type="button" className="rider-application-secondary-btn" onClick={handleSaveDraft}>
                  Save Draft
                </button>
                <button
                  type="button"
                  className="rider-application-primary-btn"
                  onClick={handleContinueToComplete}
                  disabled={!canContinueToComplete || faceMatchStatus === "scanning"}
                >
                  <span>{faceMatchStatus === "scanning" ? "Verifying face match..." : "Continue to Step 4"}</span>
                  {faceMatchStatus !== "scanning" && <ArrowForwardRounded sx={{ fontSize: 18 }} />}
                </button>
              </div>
            </>
          )}

          {currentStep === 4 && (
            <>
              <div className="rider-application-review-card rider-application-review-hero">
                <div className="rider-application-review-hero-top">
                  <span className="rider-application-review-hero-kicker">Step 4 of 4</span>
                  <TaskAltRounded sx={{ fontSize: 18 }} />
                </div>
                <h1 className="rider-application-review-hero-title">Confirm Your Details</h1>
                <p className="rider-application-review-hero-copy">
                  Please ensure all information is accurate to avoid delays in your verification process.
                </p>
              </div>

              <div className="rider-application-review-card">
                <div className="rider-application-review-header">
                  <div className="rider-application-section-title">
                    <PersonRounded sx={{ fontSize: 18 }} />
                    <span>Personal Information</span>
                  </div>
                  <button type="button" className="rider-application-review-edit" onClick={() => setCurrentStep(1)}>
                    Edit
                  </button>
                </div>

                <div className="rider-application-avatar-card">
                  <img
                    src={documents.selfiePhoto?.preview || riderPreview}
                    alt="Applicant preview"
                    className="rider-application-avatar-image"
                  />
                  <div>
                    <div className="rider-application-avatar-name">{applicantDisplayName}</div>
                    <div className="rider-application-avatar-meta">{applicantBirthDateLabel}</div>
                  </div>
                </div>

                <div className="rider-application-review-grid">
                  <div>
                    <span>Email Address</span>
                    <strong>{form.email || "Not provided"}</strong>
                  </div>
                  <div>
                    <span>Phone</span>
                    <strong>{form.phone || "Not provided"}</strong>
                  </div>
                </div>
              </div>

              <div className="rider-application-review-card">
                <div className="rider-application-review-header">
                  <div className="rider-application-section-title">
                    <CheckCircleRounded sx={{ fontSize: 18 }} />
                    <span>Documents Verified</span>
                  </div>
                  <button type="button" className="rider-application-review-edit" onClick={() => setCurrentStep(3)}>
                    Edit
                  </button>
                </div>

                <div className="rider-application-doc-list">
                  <div className="rider-application-doc-row">
                    <TaskAltRounded sx={{ fontSize: 18, color: "#2563eb" }} />
                    <div>
                      <span>Driver's License</span>
                      <strong>{documents.driverLicense?.name ? "Verified identity document" : "Pending upload"}</strong>
                    </div>
                  </div>
                  <div className="rider-application-doc-row">
                    <TaskAltRounded sx={{ fontSize: 18, color: "#2563eb" }} />
                    <div>
                      <span>Government ID</span>
                      <strong>{documents.governmentId?.name ? "Back-up identity verified" : "Pending upload"}</strong>
                    </div>
                  </div>
                  <div className="rider-application-doc-row">
                    <TaskAltRounded sx={{ fontSize: 18, color: "#2563eb" }} />
                    <div>
                      <span>Face Scan Profile</span>
                      <strong>{faceMatchStatus === "matched" || faceMatchStatus === "review" ? "Review identity confirmed" : "Face scan pending"}</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rider-application-review-card">
                <div className="rider-application-review-header">
                  <div className="rider-application-section-title">
                    <DirectionsBikeRounded sx={{ fontSize: 18 }} />
                    <span>Vehicle Info</span>
                  </div>
                  <button type="button" className="rider-application-review-edit" onClick={() => setCurrentStep(2)}>
                    Edit
                  </button>
                </div>

                <div className="rider-application-review-grid">
                  <div>
                    <span>Vehicle Type</span>
                    <strong>{form.vehicleType || "Not provided"}</strong>
                  </div>
                  <div>
                    <span>Make / Model</span>
                    <strong>{form.model || "Not provided"}</strong>
                  </div>
                  <div>
                    <span>Year</span>
                    <strong>{form.year || "Not provided"}</strong>
                  </div>
                  <div>
                    <span>Plate Number</span>
                    <strong>{form.plateNumber || "Not provided"}</strong>
                  </div>
                </div>
              </div>

              <label className="rider-application-review-card rider-application-certify-card">
                <input
                  type="checkbox"
                  checked={certifyAccepted}
                  onChange={(e) => setCertifyAccepted(e.target.checked)}
                />
                <span>
                  I certify that all information provided is true and accurate. I understand that any false statements may lead to immediate disqualification.
                </span>
              </label>

              {verificationError ? (
                <div className="rider-application-note is-error">
                  <WarningAmberRounded sx={{ fontSize: 18 }} />
                  <span>{verificationError}</span>
                </div>
              ) : null}

              {draftNotice ? (
                <div className="rider-application-note is-success">
                  <TaskAltRounded sx={{ fontSize: 18 }} />
                  <span>{draftNotice}</span>
                </div>
              ) : null}

              <div className="rider-application-step-actions">
                <button type="button" className="rider-application-secondary-btn" onClick={() => setCurrentStep(3)}>
                  Back
                </button>
                <button
                  type="button"
                  className="rider-application-primary-btn"
                  onClick={handleSubmitApplication}
                  disabled={!canSubmitApplication || submittingApplication}
                >
                  <span>{submittingApplication ? "Submitting application..." : "Submit Application"}</span>
                  {!submittingApplication && <ArrowForwardRounded sx={{ fontSize: 18 }} />}
                </button>
              </div>
            </>
          )}

          {currentStep === 5 && (
            <div className="rider-application-form-card rider-application-submitted-card">
              <div className="rider-application-submitted-icon">
                <TaskAltRounded sx={{ fontSize: 32 }} />
              </div>

              <h1 className="rider-application-submitted-title">You're all set!</h1>
              <p className="rider-application-submitted-copy">
                Thank you for applying to Plezz Rider. Our underwriting team is reviewing your profile.
              </p>

              <div className="rider-application-submit-reference">
                <div>
                  <span className="rider-application-submit-reference-label">Application ID</span>
                  <strong>{submissionResult?.referenceNo || createReferenceNo()}</strong>
                </div>
                <button type="button" className="rider-application-copy-btn" onClick={handleCopyReference}>
                  <ContentCopyRounded sx={{ fontSize: 18 }} />
                </button>
              </div>
              {copyStatus ? <div className="rider-application-copy-feedback">{copyStatus}</div> : null}

              <div className="rider-application-submit-meta">
                <InfoOutlined sx={{ fontSize: 18 }} />
                <span>Estimated review time: {submissionResult?.reviewEta || "3-5 business days"}</span>
              </div>

              <div className="rider-application-submit-next-title">What happens next?</div>

              <div className="rider-application-submit-next-list">
                <div className="rider-application-submit-next-card">
                  <div className="rider-application-submit-next-icon">
                    <MailOutlineRounded sx={{ fontSize: 18 }} />
                  </div>
                  <div>
                    <strong>Check your inbox</strong>
                    <span>
                      {submissionResult?.emailSent
                        ? `We sent a confirmation email to ${form.email}.`
                        : submissionResult?.emailError
                        ? "Your application was saved, but confirmation email is temporarily unavailable."
                        : "We’ll send you an email once your application has been reviewed by our team."}
                    </span>
                  </div>
                </div>

                <div className="rider-application-submit-next-card">
                  <div className="rider-application-submit-next-icon">
                    <ShieldOutlined sx={{ fontSize: 18 }} />
                  </div>
                  <div>
                    <strong>Safety First</strong>
                    <span>While you wait, ensure your riding gear meets our safety standards for active service.</span>
                  </div>
                </div>
              </div>

              <button type="button" className="rider-application-primary-btn" onClick={handleReturnToDashboard}>
                Return to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
