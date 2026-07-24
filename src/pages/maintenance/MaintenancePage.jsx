import "./MaintenancePage.css";
import maintenanceImage from "../../assets/maintenance.png";
import firebaseLogo from "../../assets/firebaselogo.png";

export default function MaintenancePage() {
  return (
    <div className="maintenance-page">
      <div className="maintenance-container">
        <img
          src={firebaseLogo}
          alt="Firebase Logo"
          className="firebase-logo"
        />
        <h1>This website is temporarily unavailable</h1>

        <p className="maintenance-message">
          This project is currently suspended because there's an issue with your
          billing account.
        </p>

        <p className="maintenance-submessage">
          To restore your services, please update your billing information.
        </p>

        <div className="maintenance-card">
        <img
            src={maintenanceImage}
            alt="Maintenance"
            className="maintenance-image"
            />
            </div>
      </div>
    </div>
  );
}