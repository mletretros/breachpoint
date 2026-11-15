// The look plan, in one place. Every shade the game needs is defined here,
// and the lighting provides the variations. These names are also the CSS
// custom properties in index.html.
export const PALETTE = {
  // Deep night sky and the darkest shadows.
  canvas: '#101215',
  // The base material for the ground and large neutral walls.
  surface: '#1b1f24',
  // Used for crate edges, seams, and trim to add definition in the dark.
  hairline: '#2b3238',
  // The brightest moonlight casting cool illumination over the yard.
  ink: '#ece7dc',
  // Shadows and ambient light bouncing in darker corners.
  muted: '#93999f',
  // Sodium lamp glow, creating warm pools of light for contrast.
  accent: '#f2a13c',
  // Metal crates, railings, and industrial props.
  steel: '#3d464d',
  // VANTA team light and the emissive glow of the B7 site pad.
  jade: '#2f6b57',
};

export function shade(name) {
  return PALETTE[name];
}
