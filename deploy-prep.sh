#!/bin/bash

# Deployment Preparation Script for cPanel
# This script prepares your app for cPanel deployment

echo "🚀 Preparing Gitfolio for cPanel deployment..."

# 1. Clean previous builds
echo "📦 Cleaning previous builds..."
rm -rf .next
rm -rf out

# 2. Install dependencies
echo "📥 Installing dependencies..."
npm ci

# 3. Run build
echo "🔨 Building production version..."
npm run build

# 4. Check if build was successful
if [ -d ".next" ]; then
    echo "✅ Build successful!"
else
    echo "❌ Build failed!"
    exit 1
fi

# 5. Create deployment package
echo "📦 Creating deployment package..."
mkdir -p deployment-package
cp -r .next deployment-package/
cp -r public deployment-package/
cp -r node_modules deployment-package/ 2>/dev/null || echo "⚠️  Skipping node_modules (too large - install on server)"
cp package.json deployment-package/
cp package-lock.json deployment-package/
cp server.js deployment-package/
cp next.config.ts deployment-package/
cp .env.example deployment-package/

# 6. Create .env.local template
cat > deployment-package/.env.local.template << 'EOF'
# Copy this to .env.local and fill in your values

# GitHub API (optional - increases rate limit)
GITHUB_TOKEN=your_github_personal_access_token

# cPanel Configuration
CPANEL_BASE_URL=https://yourdomain.com:2083
CPANEL_USERNAME=your_cpanel_username
CPANEL_API_TOKEN=your_cpanel_api_token
CPANEL_ROOT_DOMAIN=yourdomain.com
CPANEL_DEPLOY_ROOT=/home/username/public_html/portfolios

# AI Configuration
DO_INFERENCE_API_KEY=your_digitalocean_api_key
DO_INFERENCE_MODEL=meta-llama/llama-3.1-70b-instruct
DO_INFERENCE_VISION_MODEL=meta-llama/llama-3.2-11b-vision-instruct

NODE_ENV=production
EOF

echo "✅ Deployment package created in 'deployment-package' directory"
echo ""
echo "📋 Next steps:"
echo "1. Upload 'deployment-package' contents to your cPanel application directory"
echo "2. SSH into your cPanel server"
echo "3. Run: npm ci --production"
echo "4. Create .env.local from .env.local.template"
echo "5. Start the application using cPanel Node.js App manager"
echo ""
echo "💡 For detailed instructions, see CPANEL_DEPLOYMENT.md"
