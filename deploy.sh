#!/bin/bash

# Build frontend
echo "Building frontend..."
npm run build

# Deploy to Netlify
echo "Deploying to Netlify..."
netlify deploy --prod --dir=dist

echo "Deployment complete!"