import { mapDefinitions } from '../../data/maps/maps.js';

export type MapId = keyof typeof mapDefinitions;

// The map a catalog page shows: every map in data/maps/maps.js, locked or not.
export function MapSelect({ value, onChange }: { value: MapId; onChange: (map: MapId) => void }) {
  return (
    <label className="catalog-map">
      <span>Карта:</span>
      <select value={value} onChange={(e) => onChange(e.target.value as MapId)}>
        {Object.entries(mapDefinitions).map(([id, map]) => (
          <option key={id} value={id}>
            {map.name}
          </option>
        ))}
      </select>
    </label>
  );
}
