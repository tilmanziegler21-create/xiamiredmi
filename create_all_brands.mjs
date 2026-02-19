import fs from 'fs';
import { createCanvas } from 'canvas';

// Function to create a brand image
function createBrandImage(brandName, filePath, colors, text) {
    const canvas = createCanvas(300, 400);
    const ctx = canvas.getContext('2d');
    
    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 300, 400);
    gradient.addColorStop(0, colors.primary);
    gradient.addColorStop(1, colors.secondary);
    
    // Fill background
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 300, 400);
    
    // Add brand text
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'white';
    
    // Split brand name for multi-line display
    const lines = brandName.split(' ');
    lines.forEach((line, index) => {
        ctx.fillText(line, 150, 140 + (index * 50));
    });
    
    // Add description
    ctx.font = 'bold 18px Arial';
    ctx.fillText(text, 150, 250);
    
    // Ensure directory exists
    const dir = filePath.substring(0, filePath.lastIndexOf('/'));
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    
    // Save to file
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(filePath, buffer);
    
    console.log(`✅ ${brandName} PNG created successfully at ${filePath}`);
}

// Create all brand images
createBrandImage(
    'ELF BAR',
    'public/images/brands/elfbar/elfbar_liquid.png',
    { primary: '#4a90e2', secondary: '#357abd' },
    'Premium Quality'
);

createBrandImage(
    'GEEKVAPE',
    'public/images/brands/geekvape/geekvape_liquid.png',
    { primary: '#ff6b35', secondary: '#f7931e' },
    'Tech Innovation'
);

createBrandImage(
    'VAPORESSO',
    'public/images/brands/vaporesso/vaporesso_liquid.png',
    { primary: '#9b59b6', secondary: '#8e44ad' },
    'Elegance & Style'
);

console.log('🎉 All brand PNG images created successfully!');