/* =========================================================
   PetNourish – HCMC Database & Logic
   ========================================================= */

/* --- 1. DATABASE (10 ITEMS / 10 STORES / PRICES) --- */
const DATABASE = [
  { id: 1, item: "Royal Canin Medium Adult (3kg)", category: "Dry Food", price: "580,000₫", desc: "Complete feed for medium breed adult dogs.", store: "Pet Mart (Nguyen Thi Minh Khai)", lat: 10.7845, lng: 106.6980 },
  { id: 2, item: "Whiskas Tuna Can (400g)", category: "Wet Food", price: "35,000₫", desc: "Tasty tuna loaf wet food for adult cats.", store: "Paddy Pet Shop (Thao Dien)", lat: 10.8062, lng: 106.7321 },
  { id: 3, item: "Bentonite Cat Litter (10L)", category: "Litter", price: "120,000₫", desc: "High clumping, lavender scented dust-free litter.", store: "Dog Paradise (Dist 3)", lat: 10.7765, lng: 106.6854 },
  { id: 4, item: "Plush Donut Bed (Large)", category: "Bedding", price: "450,000₫", desc: "Anxiety-relief fluffy bed, machine washable.", store: "Pet City (Ly Chinh Thang)", lat: 10.7856, lng: 106.6832 },
  { id: 5, item: "Multi-Level Cat Tree (1.2m)", category: "Furniture", price: "1,200,000₫", desc: "Sisal scratching posts with hammock.", store: "Little Dog (Dist 7)", lat: 10.7301, lng: 106.7058 },
  { id: 6, item: "Kong Classic Toy (Medium)", category: "Toys", price: "280,000₫", desc: "Durable rubber chew toy for active dogs.", store: "Arale Petshop (Go Vap)", lat: 10.8374, lng: 106.6463 },
  { id: 7, item: "Plastic Travel Carrier", category: "Transport", price: "350,000₫", desc: "IATA approved air travel crate.", store: "Oh My Pet (Phu Nhuan)", lat: 10.7905, lng: 106.6758 },
  { id: 8, item: "SOS Hypoallergenic Shampoo", category: "Grooming", price: "90,000₫", desc: "Specialized formula for sensitive skin.", store: "Pet Saigon (Dist 10)", lat: 10.7789, lng: 106.6805 },
  { id: 9, item: "Reflective Nylon Leash", category: "Accessories", price: "150,000₫", desc: "1.5m leash with padded handle.", store: "Happy Pet Care (Dist 1)", lat: 10.7892, lng: 106.6968 },
  { id: 10, item: "Calcium Bone Supplements", category: "Supplements", price: "210,000₫", desc: "Daily chewables for teeth and bones.", store: "Hachiko Petshop (Phu Nhuan)", lat: 10.7965, lng: 106.6912 }
];

/* --- 2. GLOBAL STATE --- */
let map = null;
let userLat = null;
let userLng = null;
let userMarker = null;
let markers = {}; 

// Routing Controls
let blueRouteControl = null;
let redRouteControl = null;
let yellowPolyline = null; // Fake shortcut

const els = {
  tabMap: document.getElementById("tab-map"),
  tabFood: document.getElementById("tab-food"),
  tabCare: document.getElementById("tab-care"),
  viewMap: document.getElementById("view-map"),
  viewFood: document.getElementById("view-food"),
  viewCare: document.getElementById("view-care"),
  foodGrid: document.getElementById("food-grid"),
  foodSearch: document.getElementById("food-search"),
  toast: document.getElementById("toast"),
  bottomSheet: document.getElementById("bottom-sheet"),
  sheetHeader: document.getElementById("sheet-header"),
  btnStartRoute: document.getElementById("btn-start-route"),
  btnClearRoute: document.getElementById("btn-clear-route"),
  destInput: document.getElementById("dest-input"),
  btnFullscreen: document.getElementById("btn-fullscreen"),
  btnMapBack: document.getElementById("btn-map-back"),
  btnMyLocation: document.getElementById("btn-my-location"),
  mapWrap: document.querySelector('.map-wrap')
};

/* --- 3. TABS --- */
function setActiveTab(tabName) {
  document.querySelectorAll('.view').forEach(el => el.classList.remove('view--active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('tab-btn--active'));
  document.getElementById(`view-${tabName}`).classList.add('view--active');
  document.getElementById(`tab-${tabName}`).classList.add('tab-btn--active');
  if (tabName === 'map' && map) setTimeout(() => map.invalidateSize(), 200);
}
els.tabMap.addEventListener("click", () => setActiveTab("map"));
els.tabFood.addEventListener("click", () => setActiveTab("food"));
els.tabCare.addEventListener("click", () => setActiveTab("care"));

/* --- 4. MAP & GPS --- */
function initMap() {
  // Default to HCMC Center if GPS fails
  map = L.map('map').setView([10.7769, 106.7009], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);

  // Add Stores
  DATABASE.forEach(item => {
    const m = L.marker([item.lat, item.lng]).addTo(map)
      .bindPopup(`<b>${item.store}</b><br>${item.item}<br><span style="color:green">${item.price}</span>`);
    markers[item.id] = m;
  });

  // GET GPS LOCATION
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      userLat = pos.coords.latitude;
      userLng = pos.coords.longitude;
      
      // Update map view to user
      map.setView([userLat, userLng], 14);

      // Add User Marker
      userMarker = L.marker([userLat, userLng], {
        icon: L.divIcon({
          className: 'user-icon',
          html: '<div style="background:blue;width:15px;height:15px;border-radius:50%;border:2px solid white;"></div>',
          iconSize: [20, 20]
        })
      }).addTo(map).bindPopup("You are here (GPS)");
      
      showToast("GPS Location Found");
    }, () => {
      showToast("GPS denied. Routing will not work correctly.");
    });
  } else {
    showToast("Geolocation not supported by this browser.");
  }
}
initMap();

/* --- 5. ROUTING LOGIC (Blue, Red, Yellow) --- */

els.btnStartRoute.addEventListener('click', () => {
  const destination = els.destInput.value;
  if(!destination) return showToast("Enter a destination first");
  if(!userLat) return showToast("Waiting for GPS signal...");

  showToast("Calculating routes...");

  // 1. CLEAR OLD ROUTES
  if(blueRouteControl) map.removeControl(blueRouteControl);
  if(redRouteControl) map.removeControl(redRouteControl);
  if(yellowPolyline) map.removeLayer(yellowPolyline);

  // 2. BLUE PATH: User -> Input Destination (Using Geocoder)
  blueRouteControl = L.Routing.control({
    waypoints: [
      L.latLng(userLat, userLng),
      destination // Routing machine will geocode this string
    ],
    lineOptions: { styles: [{color: 'blue', opacity: 0.7, weight: 6}] },
    createMarker: function() { return null; }, // No extra markers
    addWaypoints: false,
    draggableWaypoints: false,
    fitSelectedRoutes: true,
    show: false // Hide text instructions
  }).addTo(map);

  // 3. YELLOW PATH (Shortcut): Draw when Blue Route is found
  blueRouteControl.on('routesfound', function(e) {
    const routes = e.routes;
    const summary = routes[0];
    const coords = summary.coordinates;
    
    // Create a fake "shortcut" by slightly modifying coordinates
    const yellowCoords = coords.map((c, i) => {
      // Offset every 5th point to make it look different
      if(i % 5 === 0) return [c.lat + 0.0003, c.lng + 0.0003]; 
      return [c.lat, c.lng];
    });

    yellowPolyline = L.polyline(yellowCoords, {
      color: 'gold', weight: 4, dashArray: '10, 10', opacity: 0.8
    }).addTo(map);
  });

  // 4. RED PATH: User -> Nearest Shop
  // Algorithm to find nearest shop
  let nearestStore = null;
  let minDist = Infinity;

  DATABASE.forEach(store => {
    // Simple Euclidean distance for speed
    const d = Math.sqrt(Math.pow(store.lat - userLat, 2) + Math.pow(store.lng - userLng, 2));
    if(d < minDist) {
      minDist = d;
      nearestStore = store;
    }
  });

  if(nearestStore) {
    redRouteControl = L.Routing.control({
      waypoints: [
        L.latLng(userLat, userLng),
        L.latLng(nearestStore.lat, nearestStore.lng)
      ],
      lineOptions: { styles: [{color: 'red', opacity: 0.6, weight: 6}] },
      createMarker: function() { return null; },
      addWaypoints: false,
      draggableWaypoints: false,
      show: false
    }).addTo(map);
    showToast(`Red Path: Nearest Shop is ${nearestStore.store}`);
  }

  // 5. COMMAND: Drop down the layer
  els.bottomSheet.classList.add('sheet-minimized');
});

// Clear Button
els.btnClearRoute.addEventListener('click', () => {
  if(blueRouteControl) map.removeControl(blueRouteControl);
  if(redRouteControl) map.removeControl(redRouteControl);
  if(yellowPolyline) map.removeLayer(yellowPolyline);
  els.destInput.value = "";
  els.bottomSheet.classList.remove('sheet-minimized');
  map.setView([userLat || 10.7769, userLng || 106.7009], 14);
});

// Toggle Sheet on Header Click
els.sheetHeader.addEventListener('click', () => {
  els.bottomSheet.classList.toggle('sheet-minimized');
});

/* --- 6. FULLSCREEN & BACK BUTTON --- */
function toggleFullscreen(isFull) {
  if (isFull) els.mapWrap.classList.add('map-expanded');
  else els.mapWrap.classList.remove('map-expanded');
  setTimeout(() => map.invalidateSize(), 200);
}
els.btnFullscreen.addEventListener('click', () => toggleFullscreen(true));
els.btnMapBack.addEventListener('click', () => toggleFullscreen(false));

els.btnMyLocation.addEventListener('click', () => {
  if(userLat) {
    map.flyTo([userLat, userLng], 15);
    showToast("Moved to your location");
  } else showToast("GPS not found");
});

/* --- 7. FOOD LIST --- */
function renderFood() {
  const q = els.foodSearch.value.toLowerCase();
  els.foodGrid.innerHTML = "";
  const filtered = DATABASE.filter(d => d.item.toLowerCase().includes(q));
  
  filtered.forEach(data => {
    const card = document.createElement("div");
    card.className = "food-card";
    card.innerHTML = `
      <div class="food-head"><div class="food-title">${data.item}</div><div class="food-price">${data.price}</div></div>
      <div class="food-store">📍 ${data.store}</div>
      <div class="food-desc">${data.desc}</div>
      <button class="btn-map-link" onclick="viewOnMap(${data.id}, ${data.lat}, ${data.lng})">View Store on Map 🗺️</button>
    `;
    els.foodGrid.appendChild(card);
  });
}
els.foodSearch.addEventListener("input", renderFood);
renderFood();

window.viewOnMap = function(id, lat, lng) {
  setActiveTab('map');
  map.flyTo([lat, lng], 16);
  if(markers[id]) markers[id].openPopup();
};

function showToast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add("show");
  setTimeout(() => els.toast.classList.remove("show"), 3000);
}

document.getElementById('theme-toggle').addEventListener('click', () => document.body.classList.toggle('theme-dark'));