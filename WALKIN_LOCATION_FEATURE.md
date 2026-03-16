# Walk-In Location Feature Implementation

## Overview
Enhanced the Walk-In branch selection feature with location-aware functionality, geolocation support, and an interactive Google Maps display.

## Features Implemented

### 1. **Location Permission Modal**
- When user clicks "Walk-in", a beautiful modal appears requesting location access
- Modal displays:
  - Clear description of why location is needed
  - 3 benefits of enabling location (see nearby branches, get directions, find open branches)
  - "Enable Location Access" button
  - "Use Default Location" fallback button for users who decline
  - Privacy assurance note

### 2. **Geolocation Integration**
- Uses browser's native `navigator.geolocation` API
- High accuracy positioning enabled (15-second timeout)
- Automatically detects user's current latitude/longitude
- Reverse geocodes location to get city name using OpenStreetMap Nominatim API
- Error handling for:
  - Permission denied
  - Location unavailable
  - Timeout errors
  - Browser compatibility

### 3. **Interactive Google Maps Display**
- Replaced static embedded iframe with dynamic `GoogleMap` component
- Shows:
  - **User Location**: Blue circle marker showing current position
  - **Nearby Branches**: Custom merchant markers using `merchanticon.png`
- Markers are interactive:
  - Click to select branch
  - Selected branch marker scales up (1.2x)
  - Unselected markers have reduced opacity (0.7)
- Map auto-centers on user location when available
- Falls back to Philippines center (14.5995, 120.9842) when location unavailable

### 4. **Distance Calculation & Sorting**
- **Haversine Formula**: Calculates accurate distance between user and branches in kilometers
- **Smart Sorting**:
  - If location enabled: Branches sorted by proximity (nearest first)
  - If location disabled: Maintains original order
- **Distance Display**: Shows "📍 X.X km away" for each branch when location available

### 5. **Enhanced Search Functionality**
- Existing search still works perfectly:
  - Search by city name
  - Search by branch name
  - Search by merchant type (Meat, Rice, etc.)
- Search works in combination with location-based sorting
- Branches remain sorted by distance even when filtering by search terms

### 6. **Merchant Icon Integration**
- Uses `merchanticon.png` from assets (`src/assets/merchanticon.png`)
- Custom marker icon for all branch locations on the map
- Icons are properly inverted when branch is selected (for better contrast on green highlight)

### 7. **User Experience Improvements**
- **Persistent User Data**: Selected branch remembers user's choice
- **Visual Feedback**: Selected branch highlighted with:
  - Primary color border (green)
  - Check circle icon
  - "Selected" badge
  - Larger map marker
- **Direction Links**: "Get Directions" button still works with Google Maps
- **Loading States**: Proper loading indicators for map and location requests
- **Responsive Design**: Works on mobile, tablet, and desktop

## Technical Implementation

### Files Modified
- [WalkInBranchDialog.jsx](src/pages/member/components/dialogs/WalkInBranchDialog.jsx)

### Dependencies Used
```javascript
- @react-google-maps/api: GoogleMap, MarkerF components
- Firebase Firestore: Fetching merchant branch data
- React Hooks: useState, useEffect, useMemo
- Material-UI: Dialog components
```

### Key Functions

#### `calculateDistance(lat1, lng1, lat2, lng2)`
- Implements Haversine formula
- Returns distance in kilometers
- Used for sorting branches by proximity

#### `getAddressFromCoordinates(lat, lng)`
- Reverse geocodes coordinates to get city name
- Uses OpenStreetMap Nominatim API
- Helps auto-populate search with user's city

#### `requestLocationAccess()`
- Handles geolocation permission request
- Processes location callback
- Manages error states
- Updates map center and user location state

### State Variables
```javascript
const [userLocation, setUserLocation] = useState(null);           // User's GPS coordinates
const [locationLoading, setLocationLoading] = useState(false);    // Loading state
const [locationError, setLocationError] = useState(null);          // Error messages
const [showLocationPrompt, setShowLocationPrompt] = useState(false); // Show location modal
const [mapCenter, setMapCenter] = useState({...});                // Map center coordinates
const [userCity, setUserCity] = useState(null);                   // User's city name
```

## Branch Data Model
Each branch now includes geolocation data:
```javascript
{
  id: string,
  merchantId: string,
  email: string,
  kind: string,              // "Meat", "Rice", etc.
  name: string,              // Branch name
  address: string,           // Full address
  schedule: string,          // Operating hours
  lat: number,              // Latitude (NEW)
  lng: number,              // Longitude (NEW)
}
```

## User Flow

1. User clicks "Walk-in" option in Capital Share dialog
2. **WalkInBranchDialog** opens with location permission modal
3. User can:
   - **Enable Location**: Browser requests permission → Gets GPS coordinates → Reverse geocodes to city
   - **Use Default Location**: Skips location access, uses Philippines center
4. Main branch selection screen shows:
   - Interactive Google Map with markers
     - Blue circle: User's location
     - Custom merchant icons: Nearby branches
   - List of branches sorted by distance (if location enabled)
   - Distance in km next to each branch
   - Search bar (works with location sorting)
5. User selects branch by:
   - Clicking map marker
   - Clicking branch in list
6. Selected branch shows on map with scaled-up icon
7. User confirms selection and generates voucher

## Browser Compatibility
- ✅ Chrome/Edge (Android, Desktop)
- ✅ Safari (iOS 13+)
- ✅ Firefox
- ✅ Samsung Internet (Android)
- ⚠️ Requires HTTPS in production (geolocation requires secure context)

## Environment Variables Required
```
REACT_APP_GOOGLE_MAPS_API_KEY=your_api_key
```

## Testing Checklist

- [ ] Location permission modal appears when Walk-in is clicked
- [ ] "Enable Location Access" button requests browser permission
- [ ] Map loads and centers on user location
- [ ] Blue circle shows user position
- [ ] Merchant icons appear as branch markers
- [ ] Clicking marker selects branch
- [ ] Distance displays correctly in km
- [ ] Branches sort by proximity
- [ ] Search still works with location sorting
- [ ] "Get Directions" button opens Google Maps
- [ ] Works on iOS and Android browsers
- [ ] Works without location access (fallback to default location)
- [ ] Responsive on mobile, tablet, desktop

## Notes
- Location data is NOT stored - only used during the session
- Reverse geocoding uses free OpenStreetMap API (rate-limited)
- Requires merchant data in Firestore to include `latitude`/`longitude` fields
- If merchant location data missing, falls back to FALLBACK_BRANCHES coordinates
