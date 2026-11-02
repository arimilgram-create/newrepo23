// Google Fonts that Quad can load into Canvas. [family, label, css2 axis spec]
export const FONTS = [
  ['', 'Canvas default', null],
  ['system', 'Your device’s font', null],
  ['Inter', 'Inter', 'wght@400;500;600;700'],
  ['Poppins', 'Poppins', 'wght@400;500;600;700'],
  ['Nunito', 'Nunito', 'wght@400;600;700'],
  ['Lexend', 'Lexend', 'wght@400;500;600;700'],
  ['Quicksand', 'Quicksand', 'wght@400;500;600;700'],
  ['Atkinson Hyperlegible', 'Atkinson Hyperlegible (easy to read)', 'wght@400;700'],
  ['Merriweather', 'Merriweather (serif)', 'wght@400;700'],
  ['Comic Neue', 'Comic Neue', 'wght@400;700'],
  ['JetBrains Mono', 'JetBrains Mono', 'wght@400;600'],
];

export const fontStack = (family) => {
  if (!family) return '';
  if (family === 'system') return 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  return `"${family}", system-ui, -apple-system, "Segoe UI", sans-serif`;
};

export const fontHref = (family) => {
  const f = FONTS.find((x) => x[0] === family);
  if (!f || !f[2]) return '';
  return `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:${f[2]}&display=swap`;
};

// Course card palettes. Applying one saves the colors to your Canvas account.
export const PALETTES = {
  pastel: { name: 'Pastel', colors: ['#f4a7b9', '#a7c7e7', '#b5e0c5', '#f7d794', '#c9b6e4', '#f5b895', '#9ed8db', '#e4c1f9'] },
  vivid: { name: 'Vivid', colors: ['#e63946', '#2a9d8f', '#f4a261', '#457b9d', '#8338ec', '#ff006e', '#06d6a0', '#3a86ff'] },
  ocean: { name: 'Ocean', colors: ['#03045e', '#0077b6', '#00b4d8', '#0096c7', '#023e8a', '#48cae4', '#0e7c86', '#264653'] },
  forest: { name: 'Forest', colors: ['#2d6a4f', '#40916c', '#52b788', '#1b4332', '#74c69d', '#606c38', '#283618', '#95d5b2'] },
  sunset: { name: 'Sunset', colors: ['#f72585', '#b5179e', '#ff7b00', '#ff9e00', '#e85d04', '#dc2f02', '#9d0208', '#ffb703'] },
  berry: { name: 'Berry', colors: ['#7b2cbf', '#c9184a', '#9d4edd', '#ff4d6d', '#5a189a', '#a4133c', '#e0aaff', '#800f2f'] },
  earth: { name: 'Earth', colors: ['#8d6e63', '#a1887f', '#6d4c41', '#bc6c25', '#dda15e', '#606c38', '#7f5539', '#b08968'] },
  mono: { name: 'Graphite', colors: ['#212529', '#495057', '#6c757d', '#343a40', '#868e96', '#2b2d42', '#5c677d', '#14213d'] },
  rainbow: { name: 'Rainbow', colors: ['#ef476f', '#f78c6b', '#ffd166', '#06d6a0', '#118ab2', '#073b4c', '#8338ec', '#ff006e'] },
};

export const THEMES = [
  { id: 'default', name: 'Canvas', nav: '', accent: '', font: '', palette: null },
  { id: 'midnight', name: 'Midnight', nav: '#0f172a', accent: '#3b82f6', font: 'Inter', palette: 'ocean', dark: true },
  { id: 'matcha', name: 'Matcha', nav: '#27463a', accent: '#3d8b5f', font: 'Nunito', palette: 'forest' },
  { id: 'sunset', name: 'Sunset', nav: '#3a1c32', accent: '#e2603f', font: 'Poppins', palette: 'sunset' },
  { id: 'ocean', name: 'Ocean', nav: '#0b3954', accent: '#0e7c86', font: 'Lexend', palette: 'ocean' },
  { id: 'lavender', name: 'Lavender', nav: '#3b2d5c', accent: '#7c5cd6', font: 'Quicksand', palette: 'pastel' },
  { id: 'cherry', name: 'Cherry', nav: '#5b0f22', accent: '#d1294a', font: 'Poppins', palette: 'berry' },
  { id: 'graphite', name: 'Graphite', nav: '#1c1c1e', accent: '#4b5563', font: 'Inter', palette: 'mono' },
  { id: 'earth', name: 'Clay', nav: '#4a3428', accent: '#a0522d', font: 'Merriweather', palette: 'earth' },
  { id: 'neon', name: 'Neon', nav: '#14002e', accent: '#c026d3', font: 'Lexend', palette: 'vivid', dark: true },
  { id: 'citrus', name: 'Citrus', nav: '#3f4a12', accent: '#c2410c', font: 'Nunito', palette: 'rainbow' },
  { id: 'readable', name: 'Readable', nav: '', accent: '#1d4ed8', font: 'Atkinson Hyperlegible', palette: null },
];
