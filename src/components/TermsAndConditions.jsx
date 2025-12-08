import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  Box,
} from "@mui/material";

const TermsAndConditions = ({ open, onClose, onAccept }) => {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontWeight: "bold" }}>
        Damayan Savings – Standard Terms & Conditions
      </DialogTitle>

      <DialogContent
        dividers
        sx={{
          maxHeight: "60vh",
          overflowY: "auto",
          scrollBehavior: "smooth",
          pr: 2,
        }}
      >
        <Box sx={{ whiteSpace: "pre-line" }}>
          <Typography variant="h6" sx={{ mt: 1, mb: 1, fontWeight: "bold" }}>
            1. Acceptance of Terms
          </Typography>
          <Typography variant="body2">
            By accessing or using the Damayan Savings System, you agree to fully
            comply with these Terms & Conditions. If you do not agree, you must
            discontinue system use immediately.
          </Typography>

          <Typography variant="h6" sx={{ mt: 2, mb: 1, fontWeight: "bold" }}>
            2. User Responsibilities
          </Typography>
          <Typography variant="body2">
            • All information you submit must be accurate and truthful.
            {"\n"}• You must use your account for authorized financial and
            membership activities only.
            {"\n"}• You are responsible for keeping your login credentials
            confidential.
            {"\n"}• You must immediately report any unauthorized access or
            suspicious activity.
          </Typography>

          <Typography variant="h6" sx={{ mt: 2, mb: 1, fontWeight: "bold" }}>
            3. System Usage Policy
          </Typography>
          <Typography variant="body2">
            • Misuse of system modules—including alteration of records, false
            reporting, or system manipulation—is strictly prohibited.
            {"\n"}• Any attempt to exploit, bypass, or interfere with system
            operations will result in account suspension and investigation.
            {"\n"}• All system activities are **monitored and logged** for
            audit, transparency, and security.
          </Typography>

          <Typography variant="h6" sx={{ mt: 2, mb: 1, fontWeight: "bold" }}>
            4. Data Privacy Compliance  
            <Typography variant="caption">(RA 10173 – Philippine Data Privacy Act of 2012)</Typography>
          </Typography>
          <Typography variant="body2">
            Damayan Savings is committed to protecting your personal information
            in compliance with the Data Privacy Act of 2012. By using the
            system, you agree to the collection and processing of the following:
            {"\n"}• Personal identification details (Name, Address, Contact Number)
            {"\n"}• Financial records, contributions, deposits, loans, and payouts
            {"\n"}• Uploaded valid IDs, receipts, and required documents
            {"\n"}• System-generated logs for security monitoring
            {"\n\n"}
            The organization shall:
            {"\n"}• Store your data securely
            {"\n"}• Restrict access to authorized personnel only
            {"\n"}• Not sell or disclose your personal information without
            consent, unless required by law
          </Typography>

          <Typography variant="h6" sx={{ mt: 2, mb: 1, fontWeight: "bold" }}>
            5. Member’s Obligations
          </Typography>
          <Typography variant="body2">
            • Provide updated, valid, and accurate personal information.
            {"\n"}• Upload only legitimate documents (e.g., receipts, IDs,
            payment proofs).
            {"\n"}• Follow all policies regarding deposits, payouts, and
            membership procedures.
            {"\n"}• Avoid sharing screenshots that contain confidential system
            information.
          </Typography>

          <Typography variant="h6" sx={{ mt: 2, mb: 1, fontWeight: "bold" }}>
            6. Limitations of Liability
          </Typography>
          <Typography variant="body2">
            Damayan Savings is not liable for:
            {"\n"}• User mistakes (wrong input, wrong uploads, incorrect amounts)
            {"\n"}• Lost access due to forgotten passwords
            {"\n"}• Device issues, unstable internet, or user-side errors
            {"\n"}• Damages resulting from unauthorized sharing of credentials
          </Typography>

          <Typography variant="h6" sx={{ mt: 2, mb: 1, fontWeight: "bold" }}>
            7. Policy Updates
          </Typography>
          <Typography variant="body2">
            The organization reserves the right to update or modify these Terms
            & Conditions at any time. Continued use of the system signifies your
            acceptance of all updates.
          </Typography>

          <Typography
            variant="subtitle2"
            sx={{ mt: 3, textAlign: "center", fontWeight: "bold" }}
          >
            By clicking ACCEPT, you acknowledge that you have read, understood,
            and agree to the Damayan Savings Terms & Conditions.
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>

        <Button variant="contained" onClick={onAccept}>
          Accept
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TermsAndConditions;