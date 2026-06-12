# VPS Deployment Guide for Gitfolio
## Deploy on VPS with subdomain: portfolio.voiceresume.xyz

---

## Prerequisites

- VPS server (Ubuntu 20.04/22.04 or similar)
- Root or sudo access
- Domain: `voiceresume.xyz` with DNS access
- Subdomain pointed to VPS IP: `portfolio.voiceresume.xyz → YOUR_VPS_IP`

---

## Step 1: Point Subdomain to VPS

### 1.1 Get Your VPS IP Address

```bash
# On your VPS, run:
curl ifconfig.me
```

Copy this IP address (e.g., `123.45.67.89`)

### 1.2 Add DNS A Record

Go to your domain registrar (Namecheap, GoDaddy, Cloudflare, etc.):

1. Go to DNS Management
2. Add new **A Record**:
   - **Type**: A
   - **Name/Host**: `portfolio`
   - **Value/Points to**: `YOUR_VPS_IP` (e.g., 123.45.67.89)
   - **TTL**: 300 (or automatic)

3. Save changes

**Wait 5-15 minutes** for DNS propagation.

### 1.3 Verify DNS

```bash
# Check if DNS is working
nslookup portfolio.voiceresume.xyz

# Or
ping portfolio.voiceresume.xyz
```

You should see your VPS IP address.

---

## Step 2: Connect to VPS & Install Dependencies

### 2.1 SSH into Your VPS

```bash
ssh root@YOUR_VPS_IP
# Or if using a user account:
ssh username@YOUR_VPS_IP
```

### 2.2 Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### 2.3 Install Node.js 18.x or higher

```bash
# Install Node.js 20.x LTS (recommended)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should show v20.x.x
npm --version   # Should show 10.x.x
```

### 2.4 Install PM2 (Process Manager)

```bash
sudo npm install -g pm2
```

### 2.5 Install Nginx (Web Server)

```bash
sudo apt install -y nginx
```

### 2.6 Install Certbot (for SSL/HTTPS)

```bash
sudo apt install -y certbot python3-certbot-nginx
```

---

## Step 3: Deploy Your Application

### 3.1 Create Application Directory

```bash
# Create app directory
sudo mkdir -p /var/www/gitfolio
cd /var/www/gitfolio

# Set ownership (replace 'youruser' with your username)
sudo chown -R $USER:$USER /var/www/gitfolio
```

### 3.2 Upload Application Files

**Option A: Using Git (Recommended)**

```bash
cd /var/www/gitfolio

# Clone your repository
git clone https://github.com/HamzaaAkmal/Github-Portfolio-Generator.git .

# Or if you prefer SSH
# git clone git@github.com:HamzaaAkmal/Github-Portfolio-Generator.git .
```

**Option B: Using SCP from your local machine**

```bash
# On your LOCAL machine (not VPS), run:
cd /Users/apple/Downloads/portfolio-master/github-portfolio-generator

# Upload files to VPS
scp -r * root@YOUR_VPS_IP:/var/www/gitfolio/
```

### 3.3 Install Dependencies & Build

```bash
cd /var/www/gitfolio

# Install dependencies
npm ci

# Build the production app
npm run build

# Remove dev dependencies to save space (optional)
npm prune --production
```

### 3.4 Create Environment Variables

```bash
cd /var/www/gitfolio

# Create .env.local file
nano .env.local
```

Add your configuration:

```env
# GitHub API (optional - increases rate limit)
GITHUB_TOKEN=your_github_personal_access_token

# cPanel Configuration for portfolio deployment
CPANEL_BASE_URL=https://voiceresume.xyz:2083
CPANEL_USERNAME=your_cpanel_username
CPANEL_API_TOKEN=your_cpanel_api_token
CPANEL_ROOT_DOMAIN=voiceresume.xyz
CPANEL_DEPLOY_ROOT=/home/username/public_html/portfolios

# AI Configuration (DigitalOcean)
DO_INFERENCE_API_KEY=your_digitalocean_api_key
DO_INFERENCE_MODEL=meta-llama/llama-3.1-70b-instruct
DO_INFERENCE_VISION_MODEL=meta-llama/llama-3.2-11b-vision-instruct

# Production settings
NODE_ENV=production
PORT=3000
HOSTNAME=0.0.0.0
```

Save with `Ctrl+X`, then `Y`, then `Enter`

### 3.5 Start Application with PM2

```bash
cd /var/www/gitfolio

# Start the app
pm2 start npm --name "gitfolio" -- start

# Or use the custom server
pm2 start server.js --name "gitfolio"

# Save PM2 configuration
pm2 save

# Enable PM2 to start on boot
pm2 startup
# Follow the command it gives you (usually involves copying and running a command)
```

### 3.6 Verify App is Running

```bash
# Check PM2 status
pm2 status

# Check if app responds
curl http://localhost:3000

# View logs
pm2 logs gitfolio
```

---

## Step 4: Configure Nginx Reverse Proxy

### 4.1 Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/gitfolio
```

Paste this configuration:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name portfolio.voiceresume.xyz;

    # Increase upload size for resume PDFs and images
    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts for AI generation
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
        send_timeout 300;
    }
}
```

Save with `Ctrl+X`, then `Y`, then `Enter`

### 4.2 Enable Site & Test Configuration

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/gitfolio /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# If test passes, restart Nginx
sudo systemctl restart nginx
```

### 4.3 Enable Nginx on Boot

```bash
sudo systemctl enable nginx
```

---

## Step 5: Enable SSL/HTTPS with Let's Encrypt

### 5.1 Obtain SSL Certificate

```bash
sudo certbot --nginx -d portfolio.voiceresume.xyz
```

Follow the prompts:
1. Enter your email address
2. Agree to Terms of Service (Y)
3. Choose whether to share email (optional)
4. Select redirect HTTP to HTTPS (recommended: option 2)

### 5.2 Verify SSL is Working

Visit in your browser:
```
https://portfolio.voiceresume.xyz
```

You should see your Gitfolio app with a secure padlock icon! 🔒

### 5.3 Auto-Renewal Setup

Certbot automatically installs a cron job. Verify it:

```bash
# Test renewal
sudo certbot renew --dry-run

# Check certbot timer
sudo systemctl status certbot.timer
```

---

## Step 6: Configure Firewall (UFW)

### 6.1 Enable UFW Firewall

```bash
# Allow SSH (IMPORTANT: do this first!)
sudo ufw allow OpenSSH

# Allow HTTP
sudo ufw allow 'Nginx HTTP'

# Allow HTTPS
sudo ufw allow 'Nginx HTTPS'

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

Output should show:
```
To                         Action      From
--                         ------      ----
OpenSSH                    ALLOW       Anywhere
Nginx HTTP                 ALLOW       Anywhere
Nginx HTTPS                ALLOW       Anywhere
```

---

## Post-Deployment: Useful Commands

### Application Management

```bash
# View app status
pm2 status

# View logs (live)
pm2 logs gitfolio

# View last 100 lines
pm2 logs gitfolio --lines 100

# Restart app
pm2 restart gitfolio

# Stop app
pm2 stop gitfolio

# Start app
pm2 start gitfolio

# View app info
pm2 info gitfolio
```

### Update Application

```bash
# Pull latest changes (if using Git)
cd /var/www/gitfolio
git pull origin main

# Install dependencies
npm ci

# Rebuild
npm run build

# Restart app
pm2 restart gitfolio
```

### Nginx Management

```bash
# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx

# View Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### System Monitoring

```bash
# Check disk space
df -h

# Check memory usage
free -h

# Check CPU/RAM usage
top
# (press 'q' to quit)

# Check Node.js processes
ps aux | grep node
```

---

## Troubleshooting

### Issue: App won't start

**Solution:**
```bash
# Check logs
pm2 logs gitfolio --lines 50

# Check if port 3000 is in use
sudo lsof -i :3000

# Kill process on port 3000 if needed
sudo kill -9 $(sudo lsof -t -i:3000)

# Restart app
pm2 restart gitfolio
```

### Issue: 502 Bad Gateway

**Solution:**
```bash
# Make sure app is running
pm2 status

# Check app logs
pm2 logs gitfolio

# Restart both app and Nginx
pm2 restart gitfolio
sudo systemctl restart nginx
```

### Issue: SSL certificate expired

**Solution:**
```bash
# Manually renew
sudo certbot renew

# Force renewal
sudo certbot renew --force-renewal

# Restart Nginx
sudo systemctl restart nginx
```

### Issue: Can't access via domain

**Solution:**
```bash
# Check DNS
nslookup portfolio.voiceresume.xyz

# Check if Nginx is running
sudo systemctl status nginx

# Check firewall
sudo ufw status

# View Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

### Issue: Out of memory

**Solution:**
```bash
# Add swap space (2GB)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Verify
free -h
```

---

## Security Best Practices

### 1. Keep System Updated

```bash
# Run weekly
sudo apt update && sudo apt upgrade -y
```

### 2. Change Default SSH Port (Optional)

```bash
sudo nano /etc/ssh/sshd_config
# Change: Port 22 → Port 2222
sudo systemctl restart ssh

# Update firewall
sudo ufw allow 2222/tcp
```

### 3. Disable Root Login (After creating sudo user)

```bash
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
sudo systemctl restart ssh
```

### 4. Install Fail2Ban (Prevents brute force attacks)

```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 5. Regular Backups

```bash
# Backup script
nano /home/$USER/backup.sh
```

```bash
#!/bin/bash
DATE=$(date +%Y%m%d)
tar -czf /home/$USER/gitfolio-backup-$DATE.tar.gz /var/www/gitfolio
# Keep only last 7 days
find /home/$USER/gitfolio-backup-* -mtime +7 -delete
```

```bash
chmod +x /home/$USER/backup.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add line:
0 2 * * * /home/$USER/backup.sh
```

---

## Performance Optimization

### Enable Nginx Caching

```bash
sudo nano /etc/nginx/sites-available/gitfolio
```

Add before `location /` block:

```nginx
# Cache settings
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=my_cache:10m max_size=1g inactive=60m use_temp_path=off;

location / {
    proxy_cache my_cache;
    proxy_cache_valid 200 60m;
    proxy_cache_valid 404 1m;
    proxy_cache_bypass $http_cache_control;
    add_header X-Cache-Status $upstream_cache_status;
    
    # ... rest of proxy settings
}
```

### Enable Gzip Compression

```bash
sudo nano /etc/nginx/nginx.conf
```

Uncomment/add in `http` block:

```nginx
gzip on;
gzip_vary on;
gzip_proxied any;
gzip_comp_level 6;
gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/rss+xml font/truetype font/opentype application/vnd.ms-fontobject image/svg+xml;
```

Restart Nginx:
```bash
sudo systemctl restart nginx
```

---

## Quick Reference Card

| Task | Command |
|------|---------|
| SSH into VPS | `ssh root@YOUR_VPS_IP` |
| View app logs | `pm2 logs gitfolio` |
| Restart app | `pm2 restart gitfolio` |
| Restart Nginx | `sudo systemctl restart nginx` |
| Check SSL expiry | `sudo certbot certificates` |
| Renew SSL | `sudo certbot renew` |
| Pull updates | `cd /var/www/gitfolio && git pull` |
| Rebuild app | `npm run build && pm2 restart gitfolio` |
| Check disk space | `df -h` |
| Check memory | `free -h` |
| View system resources | `htop` (install: `sudo apt install htop`) |

---

## Success Checklist

- [x] Subdomain pointed to VPS IP
- [x] Node.js 18+ installed
- [x] Application uploaded and built
- [x] PM2 running the app
- [x] Nginx reverse proxy configured
- [x] SSL certificate installed
- [x] Firewall configured
- [x] App accessible at https://portfolio.voiceresume.xyz
- [x] PM2 auto-starts on reboot
- [x] Nginx auto-starts on reboot

---

## Need Help?

Common issues and solutions:
- **DNS not resolving**: Wait 15-30 minutes for DNS propagation
- **502 Bad Gateway**: Check `pm2 logs gitfolio` for errors
- **SSL issues**: Run `sudo certbot certificates` to check status
- **Permission denied**: Check file ownership with `ls -la /var/www/gitfolio`

For more help, check:
- Next.js deployment docs
- PM2 documentation
- Nginx documentation
- Your VPS provider's support

---

**🎉 Congratulations!** Your Gitfolio app is now deployed on VPS with SSL!

Access it at: **https://portfolio.voiceresume.xyz**
