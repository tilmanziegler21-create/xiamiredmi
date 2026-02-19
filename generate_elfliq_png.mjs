import fs from 'fs';
import { createCanvas } from 'canvas';

// Create canvas
const canvas = createCanvas(300, 400);
const ctx = canvas.getContext('2d');

// Create gradient
const gradient = ctx.createLinearGradient(0, 0, 300, 400);
gradient.addColorStop(0, '#ff2d55');
gradient.addColorStop(1, '#ff6b6b');

// Fill background
ctx.fillStyle = gradient;
ctx.fillRect(0, 0, 300, 400);

// Add cherry emoji
ctx.font = '60px Arial';
ctx.textAlign = 'center';
ctx.fillStyle = 'white';
ctx.fillText('🍒', 150, 150);

// Add brand text
ctx.font = 'bold 24px Arial';
ctx.fillText('ELFliq', 150, 220);

ctx.font = '16px Arial';
ctx.fillText('Premium Liquid', 150, 250);

// Save to file
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('public/images/brands/elfliq/elfliq_liquid.png', buffer);

console.log('ELFliq PNG created successfully at public/images/brands/elfliq/elfliq_liquid.png');