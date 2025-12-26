'use client';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect } from 'react';

// --- PHẦN NÀY ĐỂ FIX LỖI MẤT ICON CỦA LEAFLET ---
const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});
// ------------------------------------------------

// Fit map bounds to donor markers
function FitBounds({ donors }) {
  const map = useMap();
  useEffect(() => {
    if (!donors || donors.length === 0) return;
    const latlngs = donors
      .map(d => {
        const coords = d.coordinates || d.current_location?.coordinates;
        if (!coords || !Array.isArray(coords) || coords.length !== 2) return null;
        const [lng, lat] = coords;
        return [lat, lng];
      })
      .filter(Boolean);

    if (latlngs.length === 0) return;
    const bounds = L.latLngBounds(latlngs);
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [donors, map]);

  return null;
}

const Map = ({ donors }) => {
  // Tọa độ mặc định (ví dụ: TP.HCM) để làm tâm bản đồ
  const defaultCenter = [10.762622, 106.660172]; 

  // Force a small client-side-only effect so leaflet assets load nicely
  useEffect(() => {
    // noop - ensures this component is only used in browser
  }, []);

  return (
    <div className="w-full h-[400px] rounded-lg overflow-hidden shadow-lg border border-gray-200">
      <MapContainer 
        center={defaultCenter} 
        zoom={13} 
        style={{ height: '100%', width: '100%' }}
      >
        {/* Lớp nền bản đồ miễn phí từ OpenStreetMap */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Fit bounds to visible donors */}
        <FitBounds donors={donors} />

        {/* Vẽ các điểm (Marker) từ danh sách donors */}
        {donors && donors.map((donor, index) => {
          // Hỗ trợ cả trường hợp API trả property là `coordinates` hoặc `current_location.coordinates`
          const coords = donor.coordinates || donor.current_location?.coordinates;

          // Kiểm tra xem donor có tọa độ không
          // MongoDB GeoJSON lưu: [Longitude, Latitude] (Kinh độ, Vĩ độ)
          // Leaflet cần: [Latitude, Longitude] (Vĩ độ, Kinh độ)
          // -> Cần đảo ngược lại
          if (coords && Array.isArray(coords) && coords.length === 2) {
            const [lng, lat] = coords;

            return (
              <Marker key={donor._id || index} position={[lat, lng]} icon={icon}>
                <Popup>
                  <div className="text-sm">
                    <h3 className="font-bold">{donor.name || "Người hiến máu"}</h3>
                    <p>Nhóm máu: {donor.blood_type || "?"}</p>
                    <p>SĐT: {donor.mobile_number || donor.phone || "N/A"}</p>
                  </div>
                </Popup>
              </Marker>
            );
          }
          return null;
        })}
      </MapContainer>
    </div>
  );
};

export default Map;
