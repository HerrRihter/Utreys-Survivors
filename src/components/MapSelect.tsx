import type { MapId } from '../app/types';

// The map a catalog page shows: every map in data/maps/maps.js, locked or not.
export function MapSelect({
  maps,
  value,
  onChange,
}: {
  maps: { id: string; name: string }[];
  value: MapId;
  onChange: (map: MapId) => void;
}) {
  return (
    <label className="catalog-map">
      <span>Карта:</span>
      <select value={value} onChange={(e) => onChange(e.target.value as MapId)}>
        {maps.map((map) => (
          <option key={map.id} value={map.id}>
            {map.name}
          </option>
        ))}
      </select>
    </label>
  );
}
