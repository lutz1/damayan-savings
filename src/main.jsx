import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import reportWebVitals from './reportWebVitals';

// Register service worker for PWA support
// Disabled for local development to avoid errors
// if ('serviceWorker' in navigator) {
//   window.addEventListener('load', async () => {
//     try {
//       const base = process.env.PUBLIC_URL || '';
//       // Ensure scope ends with trailing slash to match manifest
//       const scope = base.endsWith('/') ? base : base + '/';
//       const reg = await navigator.serviceWorker.register(`${base}/service-worker.js`, {
//         scope: scope,
//       });
//       console.log('✅ Service Worker registered:', reg.scope);
//
//       // Check for updates periodically
//       setInterval(() => {
//         reg.update();
//       }, 60000); // Check every minute
//     } catch (err) {
//       console.warn('⚠️ Service Worker registration failed:', err);
//     }
//   });
//
//   // Handle service worker updates
//   if (navigator.serviceWorker.controller) {
//     navigator.serviceWorker.addEventListener('controllerchange', () => {
//       console.log('📱 Service Worker updated');
//       // Optional: Notify user of update
//       window.location.reload();
//     });
//   }
// }

// PWA Install Prompt Handling
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  console.log('📲 PWA install prompt available');
  // Store for later use in your app
  window.pwaInstallPrompt = deferredPrompt;
});

window.addEventListener('appinstalled', () => {
  console.log('✅ PWA installed successfully');
  deferredPrompt = null;
  window.pwaInstallPrompt = null;
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
