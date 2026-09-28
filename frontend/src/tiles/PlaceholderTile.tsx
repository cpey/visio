import { TileFrame } from "./TileFrame";
import type { TileProps } from "./types";

/** For cameras with no integration (e.g. Aosu): a label and an optional link. */
export function PlaceholderTile({ hass, tile }: TileProps) {
  const { placeholder_text, placeholder_url } = tile.profile;
  return (
    <TileFrame hass={hass} tile={tile}>
      <div className="tile__placeholder">
        <span>{placeholder_text || "No image available"}</span>
        {placeholder_url && (
          <a href={placeholder_url} target="_blank" rel="noopener noreferrer">
            Open
          </a>
        )}
      </div>
    </TileFrame>
  );
}
