import fs from 'fs';
import { createCanvas } from 'canvas';

// ELFliq - Red gradient
const canvas = createCanvas(300, 400);
const ctx = canvas.getContext('2d');

// Create gradient
const gradient = ctx.createLinearGradient(0, 0, 300, 400);
gradient.addColorStop(0, '#ff2d55');
gradient.addColorStop(1, '#ff6b6b');

// Fill background
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, 300, 400);

// Add text instead of emoji
ctx.font = 'bold 48px Arial';
ctx.textAlign = 'center';
ctx.fillStyle = 'white';
ctx.fillText('ELF', 150, 140);
ctx.fillText('LIQ', 150, 190);

ctx.font = 'bold 20px Arial';
ctx.fillText('Premium Liquid', 150, 250);

// Ensure directory exists
const dir = 'public/images/brands/elfliq';
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

// Save to file
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync(`${dir}/elfliq_liquid.png`, buffer);

console.log('✅ ELFliq PNG created successfully at public/images/brands/elfliq/elfliq_liquid.png');