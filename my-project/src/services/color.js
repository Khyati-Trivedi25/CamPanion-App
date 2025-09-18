// Color detection utilities: compute average color from central region and map to nearest named color.

const NAMED_COLORS = [
  { name: 'black', rgb: [0,0,0] },
  { name: 'white', rgb: [255,255,255] },
  { name: 'red', rgb: [220, 20, 60] },
  { name: 'orange', rgb: [255, 140, 0] },
  { name: 'yellow', rgb: [255, 215, 0] },
  { name: 'green', rgb: [34, 139, 34] },
  { name: 'blue', rgb: [30, 144, 255] },
  { name: 'purple', rgb: [138, 43, 226] },
  { name: 'pink', rgb: [255, 105, 180] },
  { name: 'brown', rgb: [139, 69, 19] },
  { name: 'gray', rgb: [128, 128, 128] },
  { name: 'teal', rgb: [0, 128, 128] },
  { name: 'navy', rgb: [0, 0, 128] },
  { name: 'olive', rgb: [128, 128, 0] },
];

function dist2(a, b) { return (a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2; }

export function averageCentralColor(imageData) {
  const { data, width, height } = imageData;
  const cx0 = Math.floor(width * 0.35);
  const cy0 = Math.floor(height * 0.35);
  const cx1 = Math.floor(width * 0.65);
  const cy1 = Math.floor(height * 0.65);

  let r=0,g=0,b=0,c=0;
  for (let y = cy0; y < cy1; y++) {
    for (let x = cx0; x < cx1; x++) {
      const i = (y*width + x) * 4;
      r += data[i]; g += data[i+1]; b += data[i+2]; c++;
    }
  }
  return [Math.round(r/c), Math.round(g/c), Math.round(b/c)];
}

export function nearestNamedColor(rgb) {
  let best = NAMED_COLORS[0];
  let bestD = Infinity;
  for (const nc of NAMED_COLORS) {
    const d = dist2(rgb, nc.rgb);
    if (d < bestD) { bestD = d; best = nc; }
  }
  return best.name;
}

export function estimateBrightness(rgb) {
  // perceived luminance
  const [r,g,b] = rgb;
  return 0.2126*r + 0.7152*g + 0.0722*b;
}
