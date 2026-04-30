import skyImage from '../assets/sky-backdrop.jpg';

/**
 * SkyBackdrop — Ghibli-style watercolor sky used as the workspace backdrop.
 * Renders the imported image as a full-bleed background. Vite handles bundling
 * and content-hashing the asset.
 */
export default function SkyBackdrop() {
  return (
    <div
      className="sky-backdrop"
      role="presentation"
      aria-hidden="true"
      style={{ backgroundImage: `url(${skyImage})` }}
    />
  );
}
