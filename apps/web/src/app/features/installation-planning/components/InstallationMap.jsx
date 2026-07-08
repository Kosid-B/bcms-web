import { useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

const THAILAND_CENTER = [15.87, 100.9925];

function MapViewport({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) {
      map.setView(THAILAND_CENTER, 6);
      return;
    }

    if (points.length === 1) {
      map.setView([points[0].latitude, points[0].longitude], 12);
      return;
    }

    map.fitBounds(
      points.map((point) => [point.latitude, point.longitude]),
      { padding: [36, 36], maxZoom: 13 },
    );
  }, [map, points]);

  return null;
}

function PointPicker({ onPick }) {
  useMapEvents({
    click(event) {
      onPick?.({
        latitude: Number(event.latlng.lat.toFixed(6)),
        longitude: Number(event.latlng.lng.toFixed(6)),
      });
    },
  });

  return null;
}

function markerColor(status, selected) {
  if (selected) return "#06b6d4";
  if (status === "blocked") return "#ef4444";
  if (status === "done") return "#22c55e";
  if (status === "in_progress") return "#f59e0b";
  return "#64748b";
}

export default function InstallationMap({
  points = [],
  selectedPointId,
  onSelectPoint,
  pickerValue,
  onPick,
  compact = false,
}) {
  const geoPoints = points
    .filter((point) => Number.isFinite(Number(point.latitude)) && Number.isFinite(Number(point.longitude)))
    .map((point) => ({
      ...point,
      latitude: Number(point.latitude),
      longitude: Number(point.longitude),
    }));

  const pickerPoint =
    Number.isFinite(Number(pickerValue?.latitude)) &&
    Number.isFinite(Number(pickerValue?.longitude))
      ? {
          id: "picker-point",
          name: "พิกัดที่เลือก",
          status: "selected",
          latitude: Number(pickerValue.latitude),
          longitude: Number(pickerValue.longitude),
        }
      : null;

  const viewportPoints = pickerPoint ? [pickerPoint] : geoPoints;

  return (
    <div className={`installation-map ${compact ? "installation-map--compact" : ""}`}>
      <MapContainer
        center={THAILAND_CENTER}
        zoom={6}
        scrollWheelZoom
        className="installation-map__canvas"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapViewport points={viewportPoints} />
        {onPick ? <PointPicker onPick={onPick} /> : null}

        {viewportPoints.map((point) => {
          const selected = point.id === selectedPointId || point.id === "picker-point";
          const color = markerColor(point.status, selected);

          return (
            <CircleMarker
              key={point.id}
              center={[point.latitude, point.longitude]}
              radius={selected ? 10 : 7}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.75, weight: 2 }}
              eventHandlers={{ click: () => onSelectPoint?.(point.id) }}
            >
              <Popup>
                <strong>{point.name}</strong>
                {point.point_code ? <div>{point.point_code}</div> : null}
                <div>{point.location_text ?? `${point.latitude}, ${point.longitude}`}</div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}

