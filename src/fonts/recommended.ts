/**
 * The fonts the picker offers before anything is typed: a short list for cover art, by use. Every one is in the Fontsource
 * catalogue (a mirror of Google Fonts) under the id shown, and is OFL-1.1 or Apache-2.0. The names work offline; the
 * font files are fetched when a font is first used.
 */
export interface RecommendedGroup {
  label: string;
  /** The Fontsource category, which decides the generic family to fall back on. */
  category: string;
  /** [Fontsource id, family name] */
  fonts: [string, string][];
}

export const RECOMMENDED: RecommendedGroup[] = [
  { label: 'Bold titles', category: 'sans-serif', fonts: [['bebas-neue', 'Bebas Neue'], ['anton', 'Anton'], ['oswald', 'Oswald'], ['league-gothic', 'League Gothic'], ['staatliches', 'Staatliches'], ['teko', 'Teko'], ['archivo-black', 'Archivo Black']] },
  { label: 'Clean sans', category: 'sans-serif', fonts: [['inter', 'Inter'], ['montserrat', 'Montserrat'], ['poppins', 'Poppins'], ['roboto-condensed', 'Roboto Condensed']] },
  { label: 'Classic serif', category: 'serif', fonts: [['playfair-display', 'Playfair Display'], ['cinzel', 'Cinzel'], ['cormorant-garamond', 'Cormorant Garamond'], ['dm-serif-display', 'DM Serif Display'], ['abril-fatface', 'Abril Fatface'], ['lora', 'Lora']] },
  { label: 'Retro and pixel', category: 'display', fonts: [['press-start-2p', 'Press Start 2P'], ['pixelify-sans', 'Pixelify Sans'], ['silkscreen', 'Silkscreen'], ['vt323', 'VT323']] },
  { label: 'Sci-fi and tech', category: 'sans-serif', fonts: [['orbitron', 'Orbitron'], ['audiowide', 'Audiowide'], ['rajdhani', 'Rajdhani'], ['michroma', 'Michroma'], ['russo-one', 'Russo One']] },
  { label: 'Action and poster', category: 'display', fonts: [['bungee', 'Bungee'], ['black-ops-one', 'Black Ops One'], ['bangers', 'Bangers'], ['righteous', 'Righteous']] },
  { label: 'Script and handwritten', category: 'handwriting', fonts: [['pacifico', 'Pacifico'], ['lobster', 'Lobster'], ['permanent-marker', 'Permanent Marker']] },
  { label: 'Typewriter and mono', category: 'monospace', fonts: [['special-elite', 'Special Elite'], ['courier-prime', 'Courier Prime'], ['space-mono', 'Space Mono']] },
  { label: 'Horror and novelty', category: 'display', fonts: [['creepster', 'Creepster'], ['monoton', 'Monoton']] },
];

/** The fonts every device has: always available, and what text used before the picker. [css family stack, label] */
export const SYSTEM_FONTS: [string, string][] = [
  ['Helvetica, Arial, sans-serif', 'Sans'],
  ['Georgia, serif', 'Serif'],
  ['"Courier New", monospace', 'Mono'],
  ['Impact, "Arial Black", sans-serif', 'Impact'],
];
