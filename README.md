# background-remove

**An AI-first CLI tool for removing backgrounds from images.**

Built specifically for AI assistants, agents, and automated workflows. Every feature is designed for programmatic use: extensive help text, detailed validation with corrective suggestions, and predictable error handling. Also works great for humans!

```bash
# Works out of the box
npx background-remove remove photo.jpg

# Or install globally
npm install -g background-remove
background-remove remove photo.jpg output.png --method inferred --tolerance 40
```

## Why AI-First?

| Feature | Purpose |
|---------|---------|
| **Extensive `--help`** | Every command has detailed descriptions with ranges, formats, and examples |
| **Smart validation** | Invalid inputs return specific suggestions for correction |
| **`methods` command** | Self-documenting guide for choosing the right algorithm |
| **`preview` command** | Test parameters before committing to final output |
| **Consistent errors** | All errors include actionable next steps |
| **Verbose mode** | See exactly what the tool is doing and why |

## Quick Reference for AI Assistants

**Most common commands:**

```bash
# 1. Auto-remove (works for 80% of images)
background-remove remove input.jpg output.png

# 2. White background removal
background-remove remove input.png --method color --color white --tolerance 30

# 3. Green screen
background-remove remove input.jpg --method chroma --chroma-color green --tolerance 50 --smooth

# 4. Preview before processing
background-remove preview input.jpg --method color --color white
background-remove remove input.jpg --method color --color white --tolerance 35

# 5. Get help on any command
background-remove remove --help
background-remove methods
```

**When things go wrong:**

```bash
# See all error suggestions
background-remove remove bad-input.jpg --method invalid --tolerance 999

# Check what methods are available
background-remove methods
```

## Installation

```bash
npm install -g background-remove
```

Or use without installing:

```bash
npx background-remove remove photo.jpg
```

## Commands

### `remove <input> [output]`

Remove background from an image and save as PNG/WebP with transparency.

```bash
background-remove remove photo.jpg                    # Creates photo-nobg.png
background-remove remove photo.jpg output.png           # Specify output
background-remove remove photo.jpg output.webp --format webp --quality 85
```

**Arguments:**
- `input` - Path to input image (JPG, PNG, WebP, GIF, TIFF, AVIF)
- `output` - (Optional) Output path. Defaults to `<input>-nobg.<format>`

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-m, --method <method>` | Removal algorithm: `auto`, `color`, `inferred`, `chroma`, `flood`, `edges` | `auto` |
| `-c, --color <color>` | Color to remove (hex #FFF, rgb(), or named) | `#FFFFFF` |
| `-t, --tolerance <number>` | Color matching tolerance 0-255 | `32` |
| `--chroma-color <color>` | Chroma key: `green`, `blue`, `red`, or hex | `green` |
| `--flood-seed <positions...>` | Seed points as "x,y" pairs | `0,0` |
| `-r, --radius <number>` | Corner sampling radius 1-100 | `10` |
| `-d, --distance <number>` | Edge detection threshold 1-50 | `10` |
| `-f, --feather <number>` | Edge feathering 0-20 | `0` |
| `-s, --smooth` | Apply edge smoothing | `false` |
| `-a, --antialias` | Apply antialiasing | `false` |
| `-i, --invert` | Keep background, remove foreground | `false` |
| `--format <format>` | Output: `png`, `webp`, `jpeg` | `png` |
| `-q, --quality <number>` | WebP/JPEG quality 1-100 | `90` |
| `-v, --verbose` | Detailed processing information | `false` |

Run `background-remove remove --help` for full documentation with examples.

### `methods`

Display detailed information about all removal algorithms with use cases and examples.

```bash
background-remove methods
```

Output includes:
- What each method does
- When to use it ("Best for:")
- All available options
- Working command examples

### `preview <input>`

Generate a mask preview before processing. White = kept, Black = removed.

```bash
background-remove preview photo.jpg --method color --color white
```

Use this to tune `--tolerance` before running `remove`.

## Removal Methods

### auto (default)
Automatically selects the best method. Uses inferred detection internally. Best starting point for any image.

```bash
background-remove remove photo.jpg --method auto --tolerance 40
```

### color
Remove a specific exact color. Most reliable when you know the precise background color.

**Best for:** Solid color backgrounds with known color, white/black backgrounds, brand-colored backgrounds, screenshots, logos.

```bash
# Remove white
background-remove remove logo.png --method color --color white --tolerance 30

# Remove hex color
background-remove remove photo.png --method color --color "#FF5733" --tolerance 40

# RGB format
background-remove remove image.png --method color --color "rgb(255,87,51)"
```

### inferred
Auto-detects background by sampling corners/edges. Assumes uniform background at image boundaries.

**Best for:** Product photos with white backgrounds, portraits with plain walls, centered subjects.

```bash
background-remove remove product.jpg --method inferred --tolerance 40 --radius 15
```

### chroma
Chroma key / green screen removal.

**Best for:** Green screen photography, blue screen video frames, studio chroma key shots.

```bash
background-remove remove video.jpg --method chroma --chroma-color green --tolerance 50
background-remove remove video.jpg --method chroma --chroma-color blue --smooth
```

### flood
Flood fill from seed points, removes connected similar-color regions.

**Best for:** Diagrams, charts, product photos with connected backgrounds.

```bash
background-remove remove diagram.png --method flood --flood-seed 0,0
background-remove remove diagram.png --method flood --flood-seed 0,0 100,50 200,100
```

### edges
Gradient-based edge detection. Removes areas outside detected boundaries.

**Best for:** High-contrast subjects, objects with clear boundaries, silhouettes.

```bash
background-remove remove object.jpg --method edges --distance 15 --tolerance 35
```

## Smart Validation & Error Recovery

The CLI validates all inputs and provides specific suggestions for fixes:

```bash
$ background-remove remove photo.jpg --method invalid --tolerance 300 --color badcolor

✗ Validation errors found:
  • Invalid method "invalid"
  • Tolerance must be between 0-255, got: 300
  • Invalid color format: "badcolor"

💡 Suggestions:
  • Valid methods are: auto, color, inferred, chroma, flood, edges
  • Run 'background-remove methods' to see all methods with descriptions
  • Low values (0-30): Remove only very similar colors
  • Medium values (30-60): Good for solid backgrounds
  • High values (60-255): Remove more varied colors
  • Use hex format: #FFFFFF or #FFF
  • Use RGB format: rgb(255,255,255)
  • Use named colors: white, black, red, green, blue, yellow, cyan, magenta, gray
```

## Color Formats

| Format | Example |
|--------|---------|
| Hex (long) | `#FFFFFF` |
| Hex (short) | `#FFF` |
| RGB | `rgb(255,255,255)` |
| Named | `white`, `black`, `red`, `green`, `blue`, `yellow`, `cyan`, `magenta`, `gray` |

## Tolerance Guide

| Range | Use Case |
|-------|----------|
| 10-20 | Exact matches only |
| 30-40 | Solid backgrounds (default: 32) |
| 60-80 | Gradients, shadows, variations |
| 100+ | Very aggressive |

## Output Formats

| Format | Transparency | Best For |
|--------|--------------|----------|
| PNG | Yes | Maximum compatibility |
| WebP | Yes | Web use, smaller files |
| JPEG | No | Fills transparent areas with white |

## Method Selection Guide

| Image Type | Method |
|------------|--------|
| Unknown/Mixed | `auto` |
| White background | `color` or `inferred` |
| Green/Blue screen | `chroma` |
| Product photo | `inferred` |
| Diagram/Chart | `flood` |
| High contrast | `edges` |
| Known hex color | `color` |

## Programmatic Usage

Use from Node.js code:

```javascript
const { removeBackground } = require('background-remove');

const result = await removeBackground('input.jpg', 'output.png', {
  method: 'inferred',
  tolerance: 40,
  feather: 2,
  smooth: true
});

console.log(result.outputPath);  // /path/to/output.png
console.log(result.detectedColor);  // [255, 255, 255]
```

## Examples for AI Assistants

```bash
# Basic removal
background-remove remove input.jpg output.png

# White background with validation
background-remove remove photo.jpg --method color --color white --tolerance 30

# Green screen with smoothing
background-remove remove video.jpg --method chroma --chroma-color green --tolerance 60 --smooth

# Auto-detect with feathered edges
background-remove remove product.jpg --method inferred --tolerance 40 --feather 2

# Multiple flood seeds
background-remove remove diagram.png --method flood --flood-seed 0,0 800,0 0,600 800,600

# Edge detection
background-remove remove subject.jpg --method edges --distance 12 --tolerance 30

# Preview then process
background-remove preview photo.jpg --method color --color "#FF5733"
background-remove remove photo.jpg --method color --color "#FF5733" --tolerance 35

# WebP output
background-remove remove photo.jpg output.webp --method auto --format webp --quality 85
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Too much removed | Lower `--tolerance` |
| Not enough removed | Raise `--tolerance` |
| Jagged edges | Use `--smooth` or `--antialias` |
| Hard edges | Use `--feather 3` or higher |
| Green screen issues | Increase `--tolerance` to 60+ |
| Shadows remain | Try `--method inferred` with higher tolerance |

## License

MIT - Copyright (c) 2024 Richard Anaya
