// The play field is designed at 1024x576. On wider screens the view grows
// sideways (up to MAX_W) and shows more scenery; the field itself stays put.
export const W = 1024;
export const H = 576;
export const MAX_W = 1500;
export const GROUND_Y = 528;

export const FONT_UI = '"Nunito Variable", system-ui, sans-serif';
// Baloo 2 has every Romanian letter (ă â î ș ț); check coverage before swapping it.
export const FONT_DISPLAY = '"Baloo 2 Variable", "Nunito Variable", system-ui, sans-serif';
export const FONT_POEM = 'Georgia, "Times New Roman", serif';
export const FONT_EMOJI = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

export const COLOR = {
  gold: '#ffd166',
  cream: '#fff3c4',
  pale: '#d6d4ff',
  ink: '#3d2314',
  plum: '#4a2148',
  good: '#b6f5a8',
  bad: '#ffb3a8',
};

// Bird body: a circle of this radius; the sprite is drawn 4.4 radii wide so
// the nightcap and wings overhang the body.
export const BIRD_R = 25;
export const BIRD_SIZE = BIRD_R * 4.4;

// Slingshot: how far the bird can be drawn back, and pull distance -> launch
// speed (px per physics step). Full power at 45 degrees carries about one
// field width.
export const MAX_PULL = 120;
export const LAUNCH_POWER = 0.18;
