# Quick Reference - OperationHoursEditor Component

## Component Location
`src/pages/merchant/components/OperationHoursEditor.jsx`

## Import
```javascript
import OperationHoursEditor from "./components/OperationHoursEditor";
```

## Usage
```javascript
<OperationHoursEditor
  operationHours={storeData.operationHours}
  onUpdate={handleOperationHourChange}
/>
```

## Props
| Prop | Type | Description |
|------|------|-------------|
| `operationHours` | Object | Hours object with day keys (monday-sunday) |
| `onUpdate` | Function | Callback function `(day, field, value) => void` |

## Data Format
```javascript
operationHours: {
  monday: { open: "09:00", close: "18:00", closed: false },
  tuesday: { open: "09:00", close: "18:00", closed: false },
  wednesday: { open: "09:00", close: "18:00", closed: false },
  thursday: { open: "09:00", close: "18:00", closed: false },
  friday: { open: "09:00", close: "18:00", closed: false },
  saturday: { open: "10:00", close: "17:00", closed: false },
  sunday: { open: "10:00", close: "17:00", closed: true },
}
```

## Handler Function
```javascript
const handleOperationHourChange = (day, field, value) => {
  setStoreData((prev) => ({
    ...prev,
    operationHours: {
      ...prev.operationHours,
      [day]: {
        ...prev.operationHours[day],
        [field]: value,
      },
    },
  }));
};
```

## Features at a Glance
- ✅ **Time Validation** - Ensures opening time < closing time
- ✅ **Error Display** - Shows inline error messages on invalid times
- ✅ **Apply to All** - Bulk set hours for all 7 days
- ✅ **Copy from Day** - Copy hours from one day to all others
- ✅ **Open/Closed Toggle** - Toggle day between open and closed status
- ✅ **Material-UI** - Professional styling with Material-UI components

## Error States
### Invalid Time
When opening time is ≥ closing time:
- Day row shows red border
- Error message displays: "Opening time must be before closing time"
- Hours display hides, only "Closed" label shown
- User cannot save until corrected

### How to Clear Errors
1. Correct the opening/closing times
2. Click the day's toggle button
3. Use "Copy from Day" feature

## Bulk Operations

### Apply to All Days
1. Click "Apply to All Days" button
2. Enter opening time
3. Enter closing time
4. Click "Apply"
5. All days updated with new times and marked "Open"

### Copy from Day
1. Select a day from "Copy from" dropdown
2. Click "Copy" button
3. All other days get selected day's hours
4. Validation errors cleared

## Integration with MerchantStoreSettings
- Located in: `src/pages/merchant/MerchantStoreSettings.jsx`
- Imports: `import OperationHoursEditor from "./components/OperationHoursEditor";`
- State: Uses `storeData.operationHours`
- Handler: Passes `handleOperationHourChange` function
- Save: Included in `handleSave()` Firestore update

## Location Management
### ShopLocationDialog Integration
```javascript
const [locationDialogOpen, setLocationDialogOpen] = useState(false);

const handleLocationSelect = (selectedLocation) => {
  if (selectedLocation) {
    setStoreData((prev) => ({
      ...prev,
      address: selectedLocation.address || prev.address,
      latitude: selectedLocation.latitude || prev.latitude,
      longitude: selectedLocation.longitude || prev.longitude,
    }));
    setMapCenter({ 
      lat: selectedLocation.latitude || storeData.latitude, 
      lng: selectedLocation.longitude || storeData.longitude 
    });
    setLocationDialogOpen(false);
  }
};

// In JSX:
<ShopLocationDialog
  open={locationDialogOpen}
  onClose={() => setLocationDialogOpen(false)}
  savedAddresses={savedAddresses}
  onSelectAddress={handleLocationSelect}
/>
```

## Testing
```javascript
// Manual testing flow:
1. Open MerchantStoreSettings page
2. Click "Adjust Pin" to open location picker
3. Select a location from map
4. Verify address and coordinates update
5. Modify operation hours (e.g., enter invalid time)
6. Verify error shows
7. Click "Apply to All Days"
8. Verify all days updated
9. Click "Copy from Monday"
10. Verify all other days get Monday's hours
11. Click "Save"
12. Verify data saved to Firestore
```

## Performance Notes
- Validation: O(1) - Simple string parsing
- Re-renders: Minimal - Only affected day re-renders
- State updates: Immutable - Prevents unnecessary renders
- Bulk operations: O(n) where n=7 - Negligible impact

## Browser Support
- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Mobile browsers: ✅ Full support (HTML5 time input)

## Future Improvements
- [ ] Break times support
- [ ] Seasonal hours
- [ ] Holiday calendar
- [ ] Time zone support
- [ ] Schedule templates
- [ ] Location favorites
- [ ] Address autocomplete

---

For more details, see [MERCHANT_STORE_SETTINGS_IMPROVEMENTS.md](MERCHANT_STORE_SETTINGS_IMPROVEMENTS.md)
