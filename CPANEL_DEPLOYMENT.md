# cPanel Deployment Guide for Gitfolio

## Prerequisites

1. **cPanel with Node.js Support** (version 18.x or higher)
2. **SSH Access** to your cPanel account
3. **Git** installed on cPanel (usually available by default)

## Method 1: Deploy Using cPanel Node.js App (Recommended)

### Step 1: Access cPanel
1. Log into your cPanel account
2. Find "Setup Node.js App" in the Software section

### Step 2: Create Node.js Application
1. Click "Create Application"
2. Configure:
   - **Node.js version**: 18.x or higher
   - **Application mode**: Production
   - **Application root**: `gitfolio` (or your preferred folder name)
   - **Application URL**: Choose your domain/subdomain
   - **Application startup file**: `server.js`
   - **Passenger log file**: Leave default

### Step 3: Upload Files via SSH

```bash
# SSH into your cPanel
ssh username@yourdomain.com

# Navigate to your application directory
cd ~/gitfolio

# Clone or upload your repository
# Option A: Using Git
git clone https://github.com/yourusername/gitfolio.git .

# Option B: Upload via File Manager
# Use cPanel File Manager to upload the entire project as a ZIP file
# Then extract it in the application directory
```

### Step 4: Install Dependencies

```bash
# In your application directory
cd ~/gitfolio

# Install production dependencies
npm ci --production

# Or if you need dev dependencies for build
npm install
npm run build
npm prune --production
```

### Step 5: Configure Environment Variables

Create a `.env.local` file in your application root:

```bash
nano .env.local
```

Add your environment variables:

```env
# GitHub API (optional - increases rate limit)
GITHUB_TOKEN=your_github_personal_access_token

# cPanel Configuration for portfolio deployment
CPANEL_BASE_URL=https://yourdomain.com:2083
CPANEL_USERNAME=your_cpanel_username
CPANEL_API_TOKEN=your_cpanel_api_token
CPANEL_ROOT_DOMAIN=yourdomain.com
CPANEL_DEPLOY_ROOT=/home/username/public_html/portfolios

# AI Configuration (DigitalOcean)
DO_INFERENCE_API_KEY=your_digitalocean_api_key
DO_INFERENCE_MODEL=meta-llama/llama-3.1-70b-instruct
DO_INFERENCE_VISION_MODEL=meta-llama/llama-3.2-11b-vision-instruct

NODE_ENV=production
```

### Step 6: Create Custom Server (server.js)

Create a `server.js` file in your application root:

```javascript
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = process.env.PORT || 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  })
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(\`> Ready on http://\${hostname}:\${port}\`);
    });
});
```

### Step 7: Restart Application

In cPanel Node.js App interface:
1. Click "Stop App"
2. Click "Run NPM Install" (if needed)
3. Click "Start App"

Your application should now be running!

---

## Method 2: Deploy as Static Export (If No Server Features Needed)

If you don't need server-side features, you can export as static HTML:

### Step 1: Modify next.config.ts

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
```

### Step 2: Build Static Export

```bash
npm run build
```

This creates an `out` directory with static files.

### Step 3: Upload to cPanel

1. Go to cPanel File Manager
2. Navigate to `public_html` (or your subdomain directory)
3. Upload all files from the `out` directory
4. Your site will be accessible at your domain

**Note**: This method won't work for this app because it uses API routes!

---

## Method 3: Using Git Deployment (Advanced)

### Step 1: Enable Git Version Control in cPanel

1. Go to "Git Version Control" in cPanel
2. Click "Create"
3. Enter repository URL
4. Set deployment path

### Step 2: Configure Post-Receive Hook

```bash
#!/bin/bash
cd /home/username/gitfolio
npm ci --production
npm run build
source /home/username/nodevenv/gitfolio/18/bin/activate
pm2 restart gitfolio || pm2 start npm --name "gitfolio" -- start
```

---

## Troubleshooting

### Issue: App Won't Start

**Solution**: Check the Passenger log file in cPanel Node.js App interface

### Issue: Environment Variables Not Loading

**Solution**: Make sure `.env.local` is in the application root, not inside a subdirectory

### Issue: Port Already in Use

**Solution**: cPanel automatically assigns ports. Use the one provided in Node.js App settings

### Issue: API Routes Return 404

**Solution**: Ensure you're using the custom server.js, not static export

### Issue: Build Fails on cPanel

**Solution**: 
```bash
# Increase Node.js memory
NODE_OPTIONS=--max_old_space_size=4096 npm run build
```

---

## Quick Commands Reference

```bash
# SSH into cPanel
ssh username@yourdomain.com

# Navigate to app
cd ~/gitfolio

# Pull latest changes (if using Git)
git pull origin main

# Install dependencies
npm install

# Build production
npm run build

# Check application status (if using PM2)
pm2 status

# Restart app (if using PM2)
pm2 restart gitfolio

# View logs
pm2 logs gitfolio
```

---

## Security Checklist

- [ ] `.env.local` is in `.gitignore`
- [ ] Strong cPanel API token generated
- [ ] GitHub token has minimal required permissions
- [ ] Database credentials secured (if applicable)
- [ ] HTTPS enabled for domain
- [ ] File permissions properly set (644 for files, 755 for directories)

---

## Performance Tips

1. **Enable caching** in cPanel (if available)
2. **Use Cloudflare** for CDN and DDoS protection
3. **Enable Gzip compression** in .htaccess
4. **Optimize images** before uploading
5. **Use PM2** for process management and auto-restart

---

## Support Resources

- **cPanel Documentation**: https://docs.cpanel.net/
- **Next.js Deployment**: https://nextjs.org/docs/deployment
- **Node.js on cPanel**: Search your hosting provider's knowledge base

---

## Alternative: Deploy to Vercel (Easiest)

If cPanel deployment is too complex, consider Vercel:

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Follow the prompts
```

Vercel provides:
- Free hosting for Next.js apps
- Automatic HTTPS
- Global CDN
- Automatic deployments from Git
- Environment variable management

---

**Need Help?** Contact your hosting provider's support team for:
- Node.js version availability
- SSH access setup
- Custom server configuration
- Port assignments
