import fs from 'fs';
import { createCanvas } from 'canvas';

// ELF BAR - Blue gradient
const canvas1 = createCanvas(300, 400);
const ctx1 = canvas1.getContext('2d');
const gradient1 = ctx1.createLinearGradient(0, 0, 300, 400);
gradient1.addColorStop(0, '#4a90e2');
gradient1.addColorStop(1, '#357abd');
ctx1.fillStyle = gradient1;
ctx1.fillRect(0, 0, 300, 400);
ctx1.font = '60px Arial';
ctx1.textAlign = 'center';
ctx1.fillStyle = 'white';
ctx1.fillText('⚡', 150, 150);
ctx1.font = 'bold 24px Arial';
ctx1.fillText('ELF BAR', 150, 220);
ctx1.font = '16px Arial';
ctx1.fillText('Premium Quality', 150, 250);
fs.writeFileSync('public/images/brands/elfbar/elfbar_liquid.png', canvas1.toBuffer('image/png'));

// GeekVape - Orange gradient
const canvas2 = createCanvas(300, 400);
const ctx2 = canvas2.getContext('2d');
const gradient2 = ctx2.createLinearGradient(0, 0, 300, 400);
gradient2.addColorStop(0, '#ff6b35');
gradient2.addColorStop(1, '#f7931e');
ctx2.fillStyle = gradient2;
ctx2.fillRect(0, 0, 300, 400);
ctx2.font = '60px Arial';
ctx2.textAlign = 'center';
ctx2.fillStyle = 'white';
ctx2.fillText('🔧', 150, 150);
ctx2.font = 'bold 24px Arial';
ctx2.fillText('GEEKVAPE', 150, 220);
ctx2.font = '16px Arial';
ctx2.fillText('Tech Innovation', 150, 250);
fs.writeFileSync('public/images/brands/geekvape/geekvape_liquid.png', canvas2.toBuffer('image/png'));

// Vaporesso - Purple gradient
const canvas3 = createCanvas(300, 400);
const ctx3 = canvas3.getContext('2d');
const gradient3 = ctx3.createLinearGradient(0, 0, 300, 400);
gradient3.addColorStop(0, '#9b59b6');
gradient3.addColorStop(1, '#8e44ad');
ctx3.fillStyle = gradient3;
ctx3.fillRect(0, 0, 300, 400);
ctx3.font = '60px Arial';
ctx3.textAlign = 'center';
ctx3.fillStyle = 'white';
ctx3.fillText('💎', 150, 150);
ctx3.font = 'bold 24px Arial';
ctx3.fillText('VAPORESSO', 150, 220);
ctx3.font = '16px Arial';
ctx3.fillText('Elegance & Style', 150, 250);
fs.writeFileSync('public/images/brands/vaporesso/vaporesso_liquid.png', canvas3.toBuffer('image/png'));

console.log('All brand PNG images created successfully!');