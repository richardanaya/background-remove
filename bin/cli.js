#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');
const { removeBackground, listMethods, parseColor } = require('../src/index.js');

const program = new Command();

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Validates and provides helpful error messages for common mistakes
 */
function validateInput(inputPath, options) {
  const errors = [];
  const suggestions = [];

  // Check input file exists
  if (!fs.existsSync(inputPath)) {
    errors.push(`Input file not found: ${inputPath}`);
    
    // Suggest alternatives
    const dir = path.dirname(inputPath);
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir).filter(f => 
        /\.(jpg|jpeg|png|webp|gif|tiff|avif)$/i.test(f)
      ).slice(0, 5);
      if (files.length > 0) {
        suggestions.push(`Found these image files in directory: ${files.join(', ')}`);
      }
    } else {
      suggestions.push(`Directory does not exist: ${dir}`);
    }
  }

  // Validate method
  const validMethods = ['auto', 'color', 'inferred', 'chroma', 'flood', 'edges'];
  if (!validMethods.includes(options.method)) {
    errors.push(`Invalid method "${options.method}"`);
    suggestions.push(`Valid methods are: ${validMethods.join(', ')}`);
    suggestions.push(`Run 'background-remove methods' to see all methods with descriptions`);
  }

  // Validate color format if provided
  if (options.color && options.method === 'color') {
    try {
      parseColor(options.color);
    } catch (e) {
      errors.push(`Invalid color format: "${options.color}"`);
      suggestions.push('Use hex format: #FFFFFF or #FFF');
      suggestions.push('Use RGB format: rgb(255,255,255)');
      suggestions.push('Use named colors: white, black, red, green, blue, yellow, cyan, magenta, gray');
    }
  }

  // Validate tolerance range
  if (options.tolerance !== undefined) {
    if (options.tolerance < 0 || options.tolerance > 255) {
      errors.push(`Tolerance must be between 0-255, got: ${options.tolerance}`);
      suggestions.push('Low values (0-30): Remove only very similar colors');
      suggestions.push('Medium values (30-60): Good for solid backgrounds');
      suggestions.push('High values (60-255): Remove more varied colors');
    }
  }

  // Validate quality range
  if (options.quality !== undefined) {
    if (options.quality < 1 || options.quality > 100) {
      errors.push(`Quality must be between 1-100, got: ${options.quality}`);
      suggestions.push('Use 90-100 for high quality output');
      suggestions.push('Use 70-85 for balanced quality/size');
      suggestions.push('Use 1-70 for smaller file sizes');
    }
  }

  // Validate format
  if (options.format) {
    const validFormats = ['png', 'webp', 'jpeg', 'jpg'];
    if (!validFormats.includes(options.format.toLowerCase())) {
      errors.push(`Invalid format: "${options.format}"`);
      suggestions.push(`Valid formats: ${validFormats.join(', ')}`);
      suggestions.push('Note: Only PNG and WebP support transparency. JPEG will use white background.');
    }
  }

  // Validate feather range
  if (options.feather !== undefined) {
    if (options.feather < 0 || options.feather > 20) {
      errors.push(`Feather must be between 0-20, got: ${options.feather}`);
      suggestions.push('Use 0 for no feathering');
      suggestions.push('Use 2-5 for subtle edge softening');
      suggestions.push('Use 10-20 for strong blur/soft focus effect');
    }
  }

  // Check if using JPEG output with transparency-dependent options
  if (options.format === 'jpeg' || options.format === 'jpg') {
    if (options.invert) {
      suggestions.push('Warning: JPEG output does not support transparency. Inverted selection will have white background.');
    }
  }

  return { errors, suggestions };
}

/**
 * Print validation errors with suggestions
 */
function printValidationErrors(validation) {
  console.error(chalk.red('\n✗ Validation errors found:\n'));
  validation.errors.forEach(err => {
    console.error(chalk.red(`  • ${err}`));
  });
  
  if (validation.suggestions.length > 0) {
    console.error(chalk.yellow('\n💡 Suggestions:\n'));
    validation.suggestions.forEach(sugg => {
      console.error(chalk.yellow(`  • ${sugg}`));
    });
  }
  
  console.error(chalk.gray('\nRun with --help for usage examples\n'));
}

// ============================================================================
// MAIN CLI SETUP
// ============================================================================

program
  .name('background-remove')
  .description(
    'A CLI tool for removing backgrounds from images and creating transparent PNGs.\n' +
    'Supports multiple algorithms: color-based, automatic detection, chroma key (green screen),\n' +
    'flood fill, and edge detection. Use "methods" command to see all removal techniques.'
  )
  .version('1.0.0', '-v, --version', 'Display version number')
  .helpOption('-h, --help', 'Display help for command')
  .configureHelp({
    sortSubcommands: true,
    subcommandTerm: (cmd) => cmd.name()
  });

// ============================================================================
// REMOVE COMMAND
// ============================================================================

program
  .command('remove')
  .alias('rm')
  .description(
    'Remove background from an image and save as PNG/WebP with transparency.\n' +
    'If no output path is provided, creates "input-nobg.png" in the same directory.'
  )
  .argument('<input>', 
    'Path to input image file.\n' +
    'Supported formats: JPG, PNG, WebP, GIF, TIFF, AVIF\n' +
    'Example: photo.jpg or ./images/photo.png'
  )
  .argument('[output]', 
    '(Optional) Path for output image.\n' +
    'Defaults to "<input-name>-nobg.<format>" in same directory.\n' +
    'Example: output.png or ./cleaned/photo.png'
  )
  .option('-m, --method <method>', 
    'Background removal algorithm to use:\n' +
    '  • auto     - Automatically detect best method (default)\n' +
    '  • color    - Remove specific color (use with --color)\n' +
    '  • inferred - Auto-detect background from image corners\n' +
    '  • chroma   - Chroma key / green screen removal\n' +
    '  • flood    - Flood fill from seed points\n' +
    '  • edges    - Edge detection based removal', 
    'auto'
  )
  .option('-c, --color <color>', 
    'Color to remove (only used with --method color).\n' +
    'Formats: #FFFFFF (hex), rgb(255,255,255), or named colors.\n' +
    'Named colors: white, black, red, green, blue, yellow, cyan, magenta, gray\n' +
    'Default: #FFFFFF (white)', 
    '#FFFFFF'
  )
  .option('-t, --tolerance <number>', 
    'Color matching tolerance 0-255. Higher = more aggressive removal.\n' +
    '  • 10-20  - Very strict, exact color matches only\n' +
    '  • 30-40  - Good for solid color backgrounds (default: 32)\n' +
    '  • 60-80  - Handles gradients and variations\n' +
    '  • 100+   - Very aggressive, may remove subject parts',
    parseFloat, 
    32
  )
  .option('--chroma-color <color>', 
    'Chroma key color for green/blue screen removal.\n' +
    '  • green  - Standard green screen (default)\n' +
    '  • blue   - Blue screen\n' +
    '  • red    - Red screen\n' +
    '  • #RRGGBB - Any custom color',
    'green'
  )
  .option('--flood-seed <positions...>', 
    'Seed positions for flood fill method (x,y pairs).\n' +
    'Format: "x,y" (e.g., "0,0" or "100,50")\n' +
    'Multiple: --flood-seed 0,0 100,50 200,100\n' +
    'Default: 0,0 (top-left corner)',
    ['0,0']
  )
  .option('-r, --radius <number>', 
    'Corner sampling radius for inferred method.\n' +
    'Larger radius = more aggressive background detection from edges.\n' +
    'Range: 1-100, default: 10',
    parseInt, 
    10
  )
  .option('-d, --distance <number>', 
    'Edge detection threshold for edges method.\n' +
    'Lower values = more edges detected, more aggressive removal.\n' +
    'Range: 1-50, default: 10',
    parseInt, 
    10
  )
  .option('-f, --feather <number>', 
    'Edge feathering amount 0-20. Creates soft/transparent edges.\n' +
    '  • 0   - Hard edges (default)\n' +
    '  • 2-5 - Subtle softening\n' +
    '  • 10+ - Strong blur effect',
    parseFloat, 
    0
  )
  .option('-s, --smooth', 
    'Apply edge smoothing to reduce jagged edges.\n' +
    'Recommended for text or logos with hard edges.',
    false
  )
  .option('-a, --antialias', 
    'Apply antialiasing to edges for smoother appearance.\n' +
    'Similar to --smooth but uses different algorithm.',
    false
  )
  .option('-i, --invert', 
    'Invert the selection - keep background, remove foreground.\n' +
    'Useful for extracting just the background area.',
    false
  )
  .option('--format <format>', 
    'Output image format.\n' +
    '  • png  - PNG with transparency (default)\n' +
    '  • webp - WebP with transparency\n' +
    '  • jpeg - JPEG (no transparency, white background)',
    'png'
  )
  .option('-q, --quality <number>', 
    'Output quality for WebP/JPEG 1-100.\n' +
    'Higher = better quality, larger file. No effect on PNG.\n' +
    'Default: 90',
    parseInt, 
    90
  )
  .option('-v, --verbose', 
    'Display detailed processing information including\n' +
    'detected colors, timing, and method selection.',
    false
  )
  .addHelpText('after', `
Examples:
  # Auto-remove background (works for most images)
  $ background-remove remove photo.jpg

  # Remove white background with color method
  $ background-remove remove logo.png --method color --color white

  # Remove specific hex color with tolerance
  $ background-remove remove image.png --method color --color "#FF5733" --tolerance 40

  # Green screen removal with smoothing
  $ background-remove remove video.jpg --method chroma --chroma-color green --smooth

  # Auto-detect with high tolerance for gradients
  $ background-remove remove photo.jpg --method inferred --tolerance 60

  # Flood fill from multiple corners
  $ background-remove remove diagram.png --method flood --flood-seed 0,0 800,600

  # Remove with feathered edges and WebP output
  $ background-remove remove portrait.jpg output.webp --method inferred --feather 5 --format webp

  # Edge detection with custom threshold
  $ background-remove remove product.jpg --method edges --distance 15
`)
  .action(async (input, output, options) => {
    try {
      const inputPath = path.resolve(input);
      
      // Generate default output path if not provided
      if (!output) {
        const parsed = path.parse(inputPath);
        output = path.join(parsed.dir, `${parsed.name}-nobg.${options.format || 'png'}`);
      }
      const outputPath = path.resolve(output);

      // Validate inputs with AI-friendly error messages
      const validation = validateInput(inputPath, options);
      if (validation.errors.length > 0) {
        printValidationErrors(validation);
        process.exit(1);
      }

      // Warn about JPEG transparency
      if ((options.format === 'jpeg' || options.format === 'jpg') && !options.invert) {
        console.log(chalk.yellow('⚠ Warning: JPEG format does not support transparency.'));
        console.log(chalk.yellow('  Transparent areas will be filled with white.\n'));
      }

      const startTime = Date.now();
      
      if (options.verbose) {
        console.log(chalk.blue('═'.repeat(60)));
        console.log(chalk.blue('Processing Configuration:'));
        console.log(chalk.blue('═'.repeat(60)));
        console.log(`  Input file:  ${inputPath}`);
        console.log(`  Output file: ${outputPath}`);
        console.log(`  Method:      ${options.method}`);
        console.log(`  Format:      ${options.format}`);
        if (options.method === 'color') {
          console.log(`  Target color: ${options.color}`);
        }
        console.log(`  Tolerance:   ${options.tolerance}`);
        if (options.feather > 0) console.log(`  Feather:     ${options.feather}`);
        if (options.smooth) console.log(`  Smoothing:   enabled`);
        if (options.antialias) console.log(`  Antialias:   enabled`);
        if (options.invert) console.log(`  Invert:      enabled`);
        console.log(chalk.blue('═'.repeat(60)));
        console.log();
      }

      const result = await removeBackground(inputPath, outputPath, options);
      
      const duration = Date.now() - startTime;
      
      console.log(chalk.green('✓ Background removed successfully!'));
      console.log(chalk.gray(`  Output:      ${result.outputPath}`));
      console.log(chalk.gray(`  Dimensions:  ${result.width}x${result.height}`));
      console.log(chalk.gray(`  Duration:    ${duration}ms`));
      
      if (result.method) {
        console.log(chalk.gray(`  Method:      ${result.method}`));
      }
      if (result.detectedColor) {
        if (Array.isArray(result.detectedColor)) {
          console.log(chalk.gray(`  Detected:    RGB(${result.detectedColor.join(', ')})`));
        } else {
          console.log(chalk.gray(`  Detected:    ${result.detectedColor}`));
        }
      }
      
      console.log();
      
    } catch (error) {
      console.error(chalk.red('\n✗ Error during processing:\n'));
      console.error(chalk.red(`  ${error.message}`));
      
      // AI-friendly suggestions based on error type
      if (error.message.includes('parseColor')) {
        console.error(chalk.yellow('\n💡 Color format help:\n'));
        console.error(chalk.yellow('  • Hex: #FFFFFF or #FFF'));
        console.error(chalk.yellow('  • RGB: rgb(255, 255, 255)'));
        console.error(chalk.yellow('  • Named: white, black, red, green, blue, etc.'));
      } else if (error.message.includes('tolerance')) {
        console.error(chalk.yellow('\n💡 Tolerance must be a number between 0-255\n'));
      } else if (error.message.includes('EACCES') || error.message.includes('permission')) {
        console.error(chalk.yellow('\n💡 Check file permissions. You may need to:\n'));
        console.error(chalk.yellow('  • Use a different output directory'));
        console.error(chalk.yellow('  • Run with appropriate permissions'));
      } else if (error.message.includes('ENOSPC')) {
        console.error(chalk.yellow('\n💡 Insufficient disk space. Free up space and try again.\n'));
      }
      
      if (options.verbose) {
        console.error(chalk.gray('\nStack trace:'));
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

// ============================================================================
// METHODS COMMAND
// ============================================================================

program
  .command('methods')
  .description(
    'Display detailed information about all available background removal methods.\n' +
    'Each method is suited for different image types and backgrounds.'
  )
  .addHelpText('after', `
Method Selection Guide:
  • Use "auto" for unknown/untested images (default, works well for most)
  • Use "color" when you know the exact background color (e.g., white #FFFFFF)
  • Use "inferred" when background is solid color but unknown (auto-detects)
  • Use "chroma" for green screen / blue screen photos
  • Use "flood" when background connects to image edges (e.g., product photos)
  • Use "edges" when subject has strong contrast against background

Examples:
  $ background-remove methods              # Show all methods
  $ background-remove remove img.jpg -m color --color white
`)
  .action(() => {
    const methods = listMethods();
    
    console.log(chalk.bold('╔════════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold('║     Background Removal Methods Reference Guide                 ║'));
    console.log(chalk.bold('╚════════════════════════════════════════════════════════════════╝'));
    console.log();
    
    methods.forEach(m => {
      console.log(chalk.cyan(`▶ ${m.name.toUpperCase()}`));
      console.log(`  ${m.description}`);
      console.log();
      console.log(chalk.gray('  Best for:'));
      m.bestFor.forEach(use => {
        console.log(chalk.gray(`    • ${use}`));
      });
      console.log();
      console.log(chalk.gray('  Key Options:'));
      m.options.forEach(opt => {
        console.log(chalk.gray(`    • ${opt}`));
      });
      console.log();
      console.log(chalk.gray('  Example:'));
      console.log(chalk.gray(`    $ ${m.example}`));
      console.log();
      console.log('─'.repeat(64));
      console.log();
    });
    
    console.log(chalk.yellow('Tip: Use --verbose with remove command to see which method was auto-selected'));
    console.log(chalk.yellow('Tip: Run "background-remove remove --help" for all available options'));
  });

// ============================================================================
// PREVIEW COMMAND
// ============================================================================

program
  .command('preview')
  .alias('mask')
  .description(
    'Generate a mask preview showing what will be kept vs removed.\n' +
    'Creates a black and white image: white = kept, black = removed.\n' +
    'Useful for testing settings before final processing.'
  )
  .argument('<input>', 
    'Input image path to generate preview mask for.\n' +
    'Example: photo.jpg'
  )
  .option('-m, --method <method>', 
    'Removal method to preview (same as remove command).\n' +
    'See "methods" command for available options.',
    'auto'
  )
  .option('-c, --color <color>', 
    'Color to preview removal for (with color method).\n' +
    'Default: #FFFFFF (white)',
    '#FFFFFF'
  )
  .option('-t, --tolerance <number>', 
    'Tolerance for preview.\n' +
    'Default: 32',
    parseFloat, 
    32
  )
  .option('-o, --output <path>', 
    'Custom output path for mask.\n' +
    'Default: <input-name>-mask.png'
  )
  .option('-v, --verbose', 
    'Show processing details.',
    false
  )
  .addHelpText('after', `
Examples:
  # Preview with auto method
  $ background-remove preview photo.jpg

  # Preview white background removal
  $ background-remove preview logo.png --method color --color white

  # Preview with custom output
  $ background-remove preview photo.jpg -o test-mask.png --tolerance 50

Interpretation:
  • White areas = will be KEPT in final output
  • Black areas = will be REMOVED (become transparent)
  • Use this to tune --tolerance before running remove
`)
  .action(async (input, options) => {
    try {
      const inputPath = path.resolve(input);
      
      if (!options.output) {
        const parsed = path.parse(inputPath);
        options.output = path.join(parsed.dir, `${parsed.name}-mask.png`);
      }
      
      const outputPath = path.resolve(options.output);

      // Validate
      if (!fs.existsSync(inputPath)) {
        console.error(chalk.red(`\n✗ Input file not found: ${inputPath}\n`));
        console.error(chalk.yellow('💡 Make sure the file path is correct and the file exists.\n'));
        process.exit(1);
      }

      if (options.verbose) {
        console.log(chalk.blue('Generating mask preview...'));
        console.log(chalk.gray(`  Input:  ${inputPath}`));
        console.log(chalk.gray(`  Output: ${outputPath}`));
        console.log(chalk.gray(`  Method: ${options.method}`));
      }

      const { generateMask } = require('../src/index.js');
      const result = await generateMask(inputPath, outputPath, options);
      
      console.log(chalk.green('✓ Mask preview generated!'));
      console.log(chalk.gray(`  Location: ${result.outputPath}`));
      console.log();
      console.log(chalk.white('  Legend:'));
      console.log(chalk.white('    ████ = White (KEPT in final)'));
      console.log(chalk.gray('    ████ = Black (REMOVED, becomes transparent)'));
      console.log();
      console.log(chalk.yellow('  If the mask looks wrong, adjust --tolerance or try a different method.'));
      console.log(chalk.gray(`  Run: background-remove remove "${input}" --method ${options.method} --tolerance <value>`));
      
    } catch (error) {
      console.error(chalk.red(`\n✗ Error: ${error.message}\n`));
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

// ============================================================================
// GLOBAL ERROR HANDLING
// ============================================================================

process.on('unhandledRejection', (error) => {
  console.error(chalk.red('\n✗ Unexpected error:\n'));
  console.error(chalk.red(`  ${error.message}`));
  console.error(chalk.yellow('\n💡 This might be a bug. Please report with --verbose output.\n'));
  process.exit(1);
});

// ============================================================================
// PARSE AND RUN
// ============================================================================

program.parse();
