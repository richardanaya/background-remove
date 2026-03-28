# background-remove

A powerful CLI tool for removing backgrounds from images with transparent output. Designed for both human and AI usage with extensive documentation, validation, and helpful error messages.

## Installation

```bash
npm install -g background-remove
```

Or use with npx:

```bash
npx background-remove <command>
```

## Quick Start

```bash
# Auto-remove background (works for most images)
background-remove remove photo.jpg

# Remove white background
background-remove remove logo.png --method color --color white

# Green screen removal
background-remove remove video.jpg --method chroma --chroma-color green
```

## Commands

### `remove <input> [output]`

Remove background from an image and save as PNG/WebP with transparency.

**Arguments:**
- `input` - Path to input image (JPG, PNG, WebP, GIF, TIFF, AVIF)
- `output` - (Optional) Output path. Defaults to `<input>-nobg.png`

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-m, --method <method>` | Removal algorithm: `auto`, `color`, `inferred`, `chroma`, `flood`, `edges` | `auto` |
| `-c, --color <color>` | Color to remove with color method. Hex (#FFF), rgb(), or named colors | `#FFFFFF` |
| `-t, --tolerance <number>` | Color matching tolerance 0-255. Higher = more aggressive | `32` |
| `--chroma-color <color>` | Chroma key color: `green`, `blue`, `red`, or hex | `green` |
| `--flood-seed <positions...>` | Flood fill seed points as "x,y" pairs | `0,0` |
| `-r, --radius <number>` | Corner sampling radius for inferred method 1-100 | `10` |
| `-d, --distance <number>` | Edge detection threshold for edges method 1-50 | `10` |
| `-f, --feather <number>` | Edge feathering 0-20. 0=hard edges, 10+=blur | `0` |
| `-s, --smooth` | Apply edge smoothing | `false` |
| `-a, --antialias` | Apply antialiasing to edges | `false` |
| `-i, --invert` | Keep background, remove foreground | `false` |
| `--format <format>` | Output format: `png`, `webp`, `jpeg` | `png` |
| `-q, --quality <number>` | Output quality for WebP/JPEG 1-100 | `90` |
| `-v, --verbose` | Display detailed processing information | `false` |

### `methods`

Display detailed information about all available background removal methods with use cases and examples.

```bash
background-remove methods
```

### `preview <input>`

Generate a mask preview showing what will be kept vs removed. White = kept, Black = removed. Useful for testing settings before processing.

```bash
background-remove preview photo.jpg --method color --color white
```

## Removal Methods

### auto (default)
Automatically selects the best method. Currently uses inferred detection. Best for unknown images or batch processing.

```bash
background-remove remove photo.jpg --method auto --tolerance 40
```

### color
Remove a specific exact color. Most reliable when you know the precise background color.

**Best for:**
- Solid color backgrounds with known color
- White or black backgrounds
- Brand-colored backgrounds (exact hex known)
- Screenshots with solid fills
- Logos with known background colors

```bash
# Remove white background
background-remove remove logo.png --method color --color white --tolerance 30

# Remove custom hex color
background-remove remove photo.png --method color --color "#FF5733" --tolerance 40

# RGB format
background-remove remove image.png --method color --color "rgb(255,87,51)"
```

### inferred
Auto-detects the background color by sampling corners and edges. Assumes background is uniform and at image boundaries.

**Best for:**
- Product photos with white/light backgrounds
- Portraits with plain walls
- Images where subject is centered
- When background color is unknown but solid

```bash
background-remove remove product.jpg --method inferred --tolerance 40 --radius 15
```

### chroma
Chroma key / green screen removal. Optimized for removing specific chroma colors.

**Best for:**
- Green screen photography
- Blue screen video frames
- Studio chroma key shots
- Video conferencing backgrounds

```bash
# Remove green screen
background-remove remove video.jpg --method chroma --chroma-color green --tolerance 50

# Remove blue screen
background-remove remove video.jpg --method chroma --chroma-color blue --smooth
```

### flood
Flood fill algorithm starts from seed points and removes connected regions of similar color.

**Best for:**
- Diagrams and charts
- Product photos with connected backgrounds
- Images with multiple background regions
- When you need precise control over start point

```bash
# Flood from top-left corner
background-remove remove diagram.png --method flood --flood-seed 0,0

# Flood from multiple points
background-remove remove diagram.png --method flood --flood-seed 0,0 100,50 200,100
```

### edges
Detects edges using gradient analysis and removes areas outside detected boundaries.

**Best for:**
- High-contrast subjects against background
- Objects with clear boundaries
- Dark subjects on light backgrounds (or vice versa)
- Silhouette-style images

```bash
background-remove remove object.jpg --method edges --distance 15 --tolerance 35
```

## Common Use Cases

### Product Photography
```bash
# White background product photo
background-remove remove product.jpg --method inferred --tolerance 40 --feather 2

# Clean edges for e-commerce
background-remove remove item.png --method color --color white --smooth --antialias
```

### Logo/Graphic Processing
```bash
# Remove white background from logo
background-remove remove logo.png --method color --color white --feather 3 --antialias

# Preview first, then process
background-remove preview logo.png --method color --color white
background-remove remove logo.png --method color --color white --tolerance 25
```

### Green Screen / Chroma Key
```bash
# Standard green screen
background-remove remove actor.jpg --method chroma --chroma-color green --tolerance 60 --smooth

# Custom chroma color
background-remove remove studio.jpg --method chroma --chroma-color "#00FF00" --tolerance 50
```

### Web-Optimized Output
```bash
# WebP with transparency
background-remove remove photo.jpg output.webp --method inferred --format webp --quality 85

# JPEG (no transparency, white background)
background-remove remove photo.jpg output.jpg --method inferred --format jpeg --quality 90
```

## Input Validation & Error Messages

The CLI provides detailed validation and helpful suggestions:

```bash
# Invalid method - shows valid options
$ background-remove remove photo.jpg --method invalid
✗ Validation errors found:
  • Invalid method "invalid"

💡 Suggestions:
  • Valid methods are: auto, color, inferred, chroma, flood, edges
  • Run 'background-remove methods' to see all methods with descriptions

# Out of range value - shows valid ranges
$ background-remove remove photo.jpg --tolerance 300
✗ Tolerance must be between 0-255, got: 300
💡 Low values (0-30): Remove only very similar colors
💡 Medium values (30-60): Good for solid backgrounds
💡 High values (60-255): Remove more varied colors

# Invalid color format - shows correct formats
$ background-remove remove photo.jpg --color notacolor --method color
✗ Invalid color format: "notacolor"
💡 Use hex format: #FFFFFF or #FFF
💡 Use RGB format: rgb(255,255,255)
💡 Use named colors: white, black, red, green, blue, yellow, cyan, magenta, gray
```

## Color Formats

The `--color` option accepts multiple formats:

| Format | Example | Description |
|--------|---------|-------------|
| Hex (long) | `#FFFFFF` | 6-character hex |
| Hex (short) | `#FFF` | 3-character shorthand |
| RGB | `rgb(255,255,255)` | RGB values 0-255 |
| Named | `white` | white, black, red, green, blue, yellow, cyan, magenta, gray |

## Tolerance Guide

The `--tolerance` option controls color matching strictness (0-255):

| Range | Use Case |
|-------|----------|
| 10-20 | Very strict, exact matches only. Good for precise color boundaries. |
| 30-40 | Balanced. Good for solid backgrounds with slight variations. (Default: 32) |
| 60-80 | Handles gradients, shadows, and lighting variations. |
| 100+ | Very aggressive. May remove parts of the subject. |

## Output Formats

| Format | Transparency | Best For |
|--------|--------------|----------|
| PNG | Yes | Maximum compatibility, editing |
| WebP | Yes | Web use, smaller file size |
| JPEG | No | Use when transparency not needed (fills white) |

## Method Selection Guide

| Image Type | Recommended Method | Reason |
|------------|-------------------|--------|
| Unknown/Mixed | `auto` | Safest default |
| White background | `color` or `inferred` | Both work well |
| Green/Blue screen | `chroma` | Optimized for chroma removal |
| Product photo | `inferred` | Corners usually show background |
| Diagram/Chart | `flood` | Connected regions removal |
| High contrast | `edges` | Clear boundaries |
| Known hex color | `color` | Most precise |

## AI-Friendly Features

This CLI is designed for AI usage with:

1. **Extensive `--help` text** - Every option has detailed descriptions
2. **Validation with suggestions** - Invalid inputs show helpful corrections
3. **Examples in help** - Real command examples for each option
4. **Consistent naming** - Clear, predictable parameter names
5. **Error categorization** - Different error types show relevant help
6. **`methods` command** - Detailed method documentation with use cases
7. **`preview` command** - Test settings before final processing
8. **Verbose mode** - Shows exactly what the tool is doing

## Examples for AI Assistants

```bash
# Basic auto-removal
background-remove remove input.jpg output.png

# White background with validation
background-remove remove photo.jpg --method color --color white --tolerance 30

# Green screen with high tolerance
background-remove remove video.jpg --method chroma --chroma-color green --tolerance 60

# Auto-detect with smoothing
background-remove remove product.jpg --method inferred --tolerance 40 --smooth --feather 2

# Multiple flood seeds for complex images
background-remove remove diagram.png --method flood --flood-seed 0,0 800,0 0,600 800,600

# Edge detection for silhouette
background-remove remove subject.jpg --method edges --distance 12 --tolerance 30

# Preview before processing
background-remove preview photo.jpg --method color --color "#FF5733"
background-remove remove photo.jpg --method color --color "#FF5733" --tolerance 35
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Too much background removed | Lower `--tolerance` value |
| Background not fully removed | Raise `--tolerance` value |
| Jagged edges | Use `--smooth` or `--antialias` |
| Subject edges too hard | Use `--feather 3` or higher |
| Green screen spills | Increase `--tolerance` to 60+ |
| Shadows remaining | Try `--method inferred` with higher tolerance |

## License

MIT
