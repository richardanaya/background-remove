const sharp = require('sharp');
const path = require('path');

/**
 * Parse a color string into RGB values
 */
function parseColor(colorStr) {
  // Named colors
  const namedColors = {
    white: [255, 255, 255],
    black: [0, 0, 0],
    red: [255, 0, 0],
    green: [0, 255, 0],
    blue: [0, 0, 255],
    yellow: [255, 255, 0],
    cyan: [0, 255, 255],
    magenta: [255, 0, 255],
    gray: [128, 128, 128],
    grey: [128, 128, 128],
  };

  const lower = colorStr.toLowerCase();
  if (namedColors[lower]) {
    return namedColors[lower];
  }

  // RGB(r,g,b) format
  const rgbMatch = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/i);
  if (rgbMatch) {
    return [parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3])];
  }

  // Hex format
  let hex = colorStr.replace('#', '');
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  if (hex.length === 6) {
    return [
      parseInt(hex.substring(0, 2), 16),
      parseInt(hex.substring(2, 4), 16),
      parseInt(hex.substring(4, 6), 16),
    ];
  }

  throw new Error(`Unable to parse color: ${colorStr}`);
}

/**
 * Calculate color distance (Euclidean in RGB space)
 */
function colorDistance(r1, g1, b1, r2, g2, b2) {
  return Math.sqrt(
    Math.pow(r1 - r2, 2) + 
    Math.pow(g1 - g2, 2) + 
    Math.pow(b1 - b2, 2)
  );
}

/**
 * Method: Explicit Color - Remove a specific color
 */
async function explicitColorMethod(imageBuffer, width, height, channels, options) {
  const targetColor = parseColor(options.color);
  const tolerance = options.tolerance;
  const invert = options.invert;

  const data = Buffer.from(imageBuffer);

  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const distance = colorDistance(r, g, b, targetColor[0], targetColor[1], targetColor[2]);
    const isBackground = distance <= tolerance;
    const shouldRemove = invert ? !isBackground : isBackground;

    if (shouldRemove) {
      data[i + 3] = 0; // Set alpha to 0
    }
  }

  return { data, detectedColor: targetColor };
}

/**
 * Method: Inferred Color - Auto-detect background from corners/edges
 */
async function inferredColorMethod(imageBuffer, width, height, channels, options) {
  const data = Buffer.from(imageBuffer);
  const radius = options.radius || 10;
  const tolerance = options.tolerance;
  const invert = options.invert;

  // Sample corners to determine background color
  const samples = [];
  const positions = [
    { x: 0, y: 0 },
    { x: width - 1, y: 0 },
    { x: 0, y: height - 1 },
    { x: width - 1, y: height - 1 },
    { x: Math.floor(width / 2), y: 0 },
    { x: Math.floor(width / 2), y: height - 1 },
    { x: 0, y: Math.floor(height / 2) },
    { x: width - 1, y: Math.floor(height / 2) },
  ];

  for (const pos of positions) {
    for (let dy = 0; dy < radius && pos.y + dy < height; dy++) {
      for (let dx = 0; dx < radius && pos.x + dx < width; dx++) {
        const idx = ((pos.y + dy) * width + (pos.x + dx)) * channels;
        if (idx < data.length - 2) {
          samples.push([data[idx], data[idx + 1], data[idx + 2]]);
        }
      }
    }
  }

  // Find dominant color through k-means-like clustering (simplified)
  let bgColor = samples[0];
  let minVariance = Infinity;

  // Try first few samples as candidates
  for (let i = 0; i < Math.min(20, samples.length); i++) {
    const candidate = samples[i];
    let variance = 0;
    for (const sample of samples) {
      variance += Math.pow(colorDistance(...candidate, ...sample), 2);
    }
    if (variance < minVariance) {
      minVariance = variance;
      bgColor = candidate;
    }
  }

  // Apply removal
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const distance = colorDistance(r, g, b, bgColor[0], bgColor[1], bgColor[2]);
    const isBackground = distance <= tolerance;
    const shouldRemove = invert ? !isBackground : isBackground;

    if (shouldRemove) {
      data[i + 3] = 0;
    }
  }

  return { data, detectedColor: bgColor };
}

/**
 * Method: Chroma Key - Remove green/blue screen
 */
async function chromaKeyMethod(imageBuffer, width, height, channels, options) {
  const chromaColor = options.chromaColor || 'green';
  const tolerance = options.tolerance;
  const invert = options.invert;

  const data = Buffer.from(imageBuffer);

  // Define chroma colors
  const chromaColors = {
    green: { primary: [0, 255, 0], range: [[0, 100], [150, 255], [0, 100]] },
    blue: { primary: [0, 0, 255], range: [[0, 100], [0, 100], [150, 255]] },
    red: { primary: [255, 0, 0], range: [[150, 255], [0, 100], [0, 100]] },
  };

  let chroma = chromaColors[chromaColor.toLowerCase()];
  
  // Custom color
  if (!chroma) {
    const custom = parseColor(chromaColor);
    chroma = { 
      primary: custom, 
      range: [
        [Math.max(0, custom[0] - 80), Math.min(255, custom[0] + 80)],
        [Math.max(0, custom[1] - 80), Math.min(255, custom[1] + 80)],
        [Math.max(0, custom[2] - 80), Math.min(255, custom[2] + 80)],
      ]
    };
  }

  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // Check if in chroma range
    const inRange = 
      r >= chroma.range[0][0] && r <= chroma.range[0][1] &&
      g >= chroma.range[1][0] && g <= chroma.range[1][1] &&
      b >= chroma.range[2][0] && b <= chroma.range[2][1];

    // Additional check: color should be closer to chroma than to other colors
    const distanceToChroma = colorDistance(r, g, b, ...chroma.primary);
    const isChroma = inRange && distanceToChroma <= tolerance + 40;
    const shouldRemove = invert ? !isChroma : isChroma;

    if (shouldRemove) {
      data[i + 3] = 0;
    }
  }

  return { data, detectedColor: chroma.primary };
}

/**
 * Method: Flood Fill - Remove connected regions from seed points
 */
async function floodFillMethod(imageBuffer, width, height, channels, options) {
  const tolerance = options.tolerance;
  const seeds = options.floodSeed || ['0,0'];
  const invert = options.invert;

  const data = Buffer.from(imageBuffer);
  const visited = new Uint8Array(width * height);
  const toRemove = new Uint8Array(width * height);
  const queue = [];

  // Parse seed positions
  const seedPositions = seeds.map(s => {
    const [x, y] = s.split(',').map(Number);
    return { x: Math.max(0, Math.min(x, width - 1)), y: Math.max(0, Math.min(y, height - 1)) };
  });

  // Get pixel color at position
  const getColor = (x, y) => {
    const idx = (y * width + x) * channels;
    return [data[idx], data[idx + 1], data[idx + 2]];
  };

  // Perform flood fill from each seed
  for (const seed of seedPositions) {
    const seedColor = getColor(seed.x, seed.y);
    queue.push(seed);
    visited[seed.y * width + seed.x] = 1;

    while (queue.length > 0) {
      const { x, y } = queue.shift();
      const idx = y * width + x;
      const currentColor = getColor(x, y);

      const distance = colorDistance(...currentColor, ...seedColor);
      
      if (distance <= tolerance) {
        toRemove[idx] = 1;

        // Add neighbors
        const neighbors = [
          { x: x + 1, y },
          { x: x - 1, y },
          { x, y: y + 1 },
          { x, y: y - 1 },
        ];

        for (const n of neighbors) {
          if (n.x >= 0 && n.x < width && n.y >= 0 && n.y < height) {
            const nIdx = n.y * width + n.x;
            if (!visited[nIdx]) {
              visited[nIdx] = 1;
              queue.push(n);
            }
          }
        }
      }
    }
  }

  // Apply removal
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const pixelIdx = idx * channels;
      const shouldRemove = invert ? !toRemove[idx] : toRemove[idx];
      
      if (shouldRemove) {
        data[pixelIdx + 3] = 0;
      }
    }
  }

  return { data, detectedColor: seedPositions.map(s => getColor(s.x, s.y).join(',')) };
}

/**
 * Method: Edge Detection + Flood Fill - Detect edges and remove outside
 */
async function edgesMethod(imageBuffer, width, height, channels, options) {
  const tolerance = options.tolerance;
  const distance = options.distance || 10;
  const invert = options.invert;

  const data = Buffer.from(imageBuffer);
  
  // Simple edge detection using gradient
  const edges = new Uint8Array(width * height);
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * channels;
      
      // Calculate gradient magnitude
      const left = (y * width + (x - 1)) * channels;
      const right = (y * width + (x + 1)) * channels;
      const up = ((y - 1) * width + x) * channels;
      const down = ((y + 1) * width + x) * channels;
      
      const dx = (
        Math.abs(data[left] - data[right]) +
        Math.abs(data[left + 1] - data[right + 1]) +
        Math.abs(data[left + 2] - data[right + 2])
      ) / 3;
      
      const dy = (
        Math.abs(data[up] - data[down]) +
        Math.abs(data[up + 1] - data[down + 1]) +
        Math.abs(data[up + 2] - data[down + 2])
      ) / 3;
      
      const gradient = Math.sqrt(dx * dx + dy * dy);
      
      if (gradient > distance * 2) {
        edges[y * width + x] = 1;
      }
    }
  }

  // Find background by flooding from corners, respecting edges
  const visited = new Uint8Array(width * height);
  const toRemove = new Uint8Array(width * height);
  const queue = [];

  const corners = [
    { x: 0, y: 0 },
    { x: width - 1, y: 0 },
    { x: 0, y: height - 1 },
    { x: width - 1, y: height - 1 },
  ];

  const getColor = (x, y) => {
    const idx = (y * width + x) * channels;
    return [data[idx], data[idx + 1], data[idx + 2]];
  };

  for (const corner of corners) {
    const cornerColor = getColor(corner.x, corner.y);
    queue.push(corner);
    visited[corner.y * width + corner.x] = 1;

    while (queue.length > 0) {
      const { x, y } = queue.shift();
      const idx = y * width + x;
      const currentColor = getColor(x, y);

      const colorDist = colorDistance(...currentColor, ...cornerColor);
      
      if (colorDist <= tolerance && !edges[idx]) {
        toRemove[idx] = 1;

        const neighbors = [
          { x: x + 1, y },
          { x: x - 1, y },
          { x, y: y + 1 },
          { x, y: y - 1 },
        ];

        for (const n of neighbors) {
          if (n.x >= 0 && n.x < width && n.y >= 0 && n.y < height) {
            const nIdx = n.y * width + n.x;
            if (!visited[nIdx]) {
              visited[nIdx] = 1;
              queue.push(n);
            }
          }
        }
      }
    }
  }

  // Apply removal
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const pixelIdx = idx * channels;
      const shouldRemove = invert ? !toRemove[idx] : toRemove[idx];
      
      if (shouldRemove) {
        data[pixelIdx + 3] = 0;
      }
    }
  }

  return { data, detectedColor: null };
}

/**
 * Method: Auto - Try multiple methods and pick best result
 */
async function autoMethod(imageBuffer, width, height, channels, options) {
  // Try inferred first (works for most common cases)
  return inferredColorMethod(imageBuffer, width, height, channels, options);
}

/**
 * Apply post-processing effects
 */
async function postProcess(data, width, height, channels, options) {
  const feather = options.feather || 0;
  const smooth = options.smooth || false;
  const antialias = options.antialias || false;

  if (feather > 0) {
    data = await applyFeather(data, width, height, channels, feather);
  }

  if (smooth) {
    data = await applySmoothing(data, width, height, channels);
  }

  if (antialias) {
    data = await applyAntialias(data, width, height, channels);
  }

  return data;
}

/**
 * Apply feather effect to edges
 */
async function applyFeather(data, width, height, channels, amount) {
  const result = Buffer.from(data);
  const alpha = new Float32Array(width * height);
  
  // Copy alpha channel
  for (let i = 0; i < width * height; i++) {
    alpha[i] = data[i * channels + 3];
  }

  // Gaussian blur on alpha
  const kernelSize = Math.ceil(amount * 2) * 2 + 1;
  const sigma = amount;
  
  // Simple box blur approximation
  for (let pass = 0; pass < 3; pass++) {
    const newAlpha = new Float32Array(width * height);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let count = 0;
        
        for (let dy = -Math.ceil(amount); dy <= Math.ceil(amount); dy++) {
          for (let dx = -Math.ceil(amount); dx <= Math.ceil(amount); dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              sum += alpha[ny * width + nx];
              count++;
            }
          }
        }
        
        newAlpha[y * width + x] = sum / count;
      }
    }
    
    for (let i = 0; i < width * height; i++) {
      alpha[i] = newAlpha[i];
    }
  }

  // Apply blurred alpha
  for (let i = 0; i < width * height; i++) {
    result[i * channels + 3] = Math.round(alpha[i]);
  }

  return result;
}

/**
 * Apply smoothing to edges
 */
async function applySmoothing(data, width, height, channels) {
  const result = Buffer.from(data);
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * channels;
      
      // Check if this is an edge pixel (alpha transition)
      const currentAlpha = data[idx + 3];
      let edgeCount = 0;
      
      const neighbors = [
        ((y - 1) * width + x) * channels,
        ((y + 1) * width + x) * channels,
        (y * width + (x - 1)) * channels,
        (y * width + (x + 1)) * channels,
      ];
      
      for (const nIdx of neighbors) {
        if (Math.abs(data[nIdx + 3] - currentAlpha) > 128) {
          edgeCount++;
        }
      }
      
      // Smooth edge pixels
      if (edgeCount > 0 && edgeCount < 4) {
        let r = 0, g = 0, b = 0, a = 0, count = 0;
        
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const nIdx = (ny * width + nx) * channels;
              r += data[nIdx];
              g += data[nIdx + 1];
              b += data[nIdx + 2];
              a += data[nIdx + 3];
              count++;
            }
          }
        }
        
        result[idx] = r / count;
        result[idx + 1] = g / count;
        result[idx + 2] = b / count;
        result[idx + 3] = a / count;
      }
    }
  }
  
  return result;
}

/**
 * Apply antialiasing
 */
async function applyAntialias(data, width, height, channels) {
  return applySmoothing(data, width, height, channels);
}

/**
 * Main removal function
 */
async function removeBackground(inputPath, outputPath, options) {
  const method = options.method || 'auto';

  // Load image
  const image = sharp(inputPath);
  const metadata = await image.metadata();
  
  // Ensure we have alpha channel
  const raw = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data, info } = raw;
  const { width, height, channels } = info;

  // Apply selected method
  let result;
  let detectedColor = null;

  switch (method) {
    case 'color':
      result = await explicitColorMethod(data, width, height, channels, options);
      detectedColor = result.detectedColor;
      break;
    case 'inferred':
      result = await inferredColorMethod(data, width, height, channels, options);
      detectedColor = result.detectedColor;
      break;
    case 'chroma':
      result = await chromaKeyMethod(data, width, height, channels, options);
      detectedColor = result.detectedColor;
      break;
    case 'flood':
      result = await floodFillMethod(data, width, height, channels, options);
      detectedColor = result.detectedColor;
      break;
    case 'edges':
      result = await edgesMethod(data, width, height, channels, options);
      break;
    case 'auto':
    default:
      result = await autoMethod(data, width, height, channels, options);
      detectedColor = result.detectedColor;
      break;
  }

  // Post-process
  let processedData = await postProcess(result.data, width, height, channels, options);

  // Save output
  const format = options.format || 'png';
  let outputSharp = sharp(processedData, {
    raw: { width, height, channels },
  });

  // Apply format
  switch (format.toLowerCase()) {
    case 'jpeg':
    case 'jpg':
      outputSharp = outputSharp.jpeg({ quality: options.quality || 90 });
      break;
    case 'webp':
      outputSharp = outputSharp.webp({ quality: options.quality || 90 });
      break;
    case 'png':
    default:
      outputSharp = outputSharp.png({ compressionLevel: 9 });
      break;
  }

  await outputSharp.toFile(outputPath);

  return {
    outputPath,
    width,
    height,
    method,
    detectedColor,
  };
}

/**
 * Generate mask preview
 */
async function generateMask(inputPath, outputPath, options) {
  const method = options.method || 'auto';

  const image = sharp(inputPath);
  const metadata = await image.metadata();
  
  const raw = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data, info } = raw;
  const { width, height, channels } = info;

  // Create a copy for processing
  let processed;
  
  switch (method) {
    case 'color':
      processed = await explicitColorMethod(data, width, height, channels, options);
      break;
    case 'inferred':
      processed = await inferredColorMethod(data, width, height, channels, options);
      break;
    case 'chroma':
      processed = await chromaKeyMethod(data, width, height, channels, options);
      break;
    case 'flood':
      processed = await floodFillMethod(data, width, height, channels, options);
      break;
    case 'edges':
      processed = await edgesMethod(data, width, height, channels, options);
      break;
    case 'auto':
    default:
      processed = await autoMethod(data, width, height, channels, options);
      break;
  }

  // Create mask image (white = keep, black = remove)
  const maskData = Buffer.alloc(width * height * 3);
  
  for (let i = 0; i < width * height; i++) {
    const alpha = processed.data[i * channels + 3];
    const val = alpha > 128 ? 255 : 0;
    maskData[i * 3] = val;
    maskData[i * 3 + 1] = val;
    maskData[i * 3 + 2] = val;
  }

  await sharp(maskData, {
    raw: { width, height, channels: 3 },
  })
    .png()
    .toFile(outputPath);

  return { outputPath };
}

/**
 * List all available methods with AI-friendly descriptions
 */
function listMethods() {
  return [
    {
      name: 'auto',
      description: 'Automatically selects the best method based on image analysis. Uses inferred color detection as the default strategy.',
      options: ['tolerance', 'feather', 'smooth', 'antialias', 'quality', 'format'],
      bestFor: [
        'Unknown or untested images',
        'Quick batch processing',
        'Mixed content types',
        'When unsure which method to choose'
      ],
      example: 'background-remove remove photo.jpg --method auto',
    },
    {
      name: 'color',
      description: 'Remove a specific exact color value. Most reliable when you know the precise background color (e.g., pure white #FFFFFF or black #000000).',
      options: ['color (required)', 'tolerance', 'invert', 'feather', 'smooth'],
      bestFor: [
        'Solid color backgrounds with known color',
        'White or black backgrounds',
        'Brand-colored backgrounds (exact hex known)',
        'Screenshots with solid fills',
        'Logos with known background colors'
      ],
      example: 'background-remove remove logo.png --method color --color "#FFFFFF" --tolerance 30',
    },
    {
      name: 'inferred',
      description: 'Auto-detects the background color by sampling pixels from corners and edges of the image. Assumes background is uniform and at image boundaries.',
      options: ['tolerance', 'radius', 'invert', 'feather'],
      bestFor: [
        'Product photos with white/light backgrounds',
        'Portraits with plain walls',
        'Images where subject is centered',
        'When background color is unknown but solid',
        'Screenshots and digital images'
      ],
      example: 'background-remove remove product.jpg --method inferred --tolerance 40 --radius 15',
    },
    {
      name: 'chroma',
      description: 'Chroma key (green screen / blue screen) removal. Optimized for removing specific chroma colors while preserving foreground subject.',
      options: ['chroma-color', 'tolerance', 'invert', 'feather', 'smooth'],
      bestFor: [
        'Green screen photography',
        'Blue screen video frames',
        'Studio chroma key shots',
        'Video conferencing backgrounds',
        'Any color-keyed studio setup'
      ],
      example: 'background-remove remove greenscreen.jpg --method chroma --chroma-color green --tolerance 50',
    },
    {
      name: 'flood',
      description: 'Flood fill algorithm starts from seed point(s) and removes connected regions of similar color. Effective when background touches image edges.',
      options: ['flood-seed', 'tolerance', 'invert'],
      bestFor: [
        'Diagrams and charts',
        'Product photos with connected backgrounds',
        'Images with multiple background regions',
        'When you need precise control over start point',
        'Complex layouts with uniform fills'
      ],
      example: 'background-remove remove diagram.png --method flood --flood-seed 0,0 --tolerance 25',
    },
    {
      name: 'edges',
      description: 'Detects edges using gradient analysis and removes areas outside detected subject boundaries. Good for high-contrast subjects.',
      options: ['tolerance', 'distance', 'invert', 'feather'],
      bestFor: [
        'High-contrast subjects against background',
        'Objects with clear boundaries',
        'Dark subjects on light backgrounds (or vice versa)',
        'When other methods include too much background',
        'Silhouette-style images'
      ],
      example: 'background-remove remove object.jpg --method edges --distance 15 --tolerance 35',
    },
  ];
}

module.exports = {
  removeBackground,
  generateMask,
  listMethods,
  parseColor,
  colorDistance,
};
