# Free Deployment Guide

## Option 1: Railway (Recommended - Easiest)

Railway offers $5/month free credit which is enough for small-scale usage.

### Prerequisites
- GitHub account
- Railway account (sign up at railway.app)
- Your R2 credentials ready

### Steps

1. **Push to GitHub**
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/medicine-digitizer.git
git push -u origin main
```

2. **Deploy on Railway**
- Go to https://railway.app
- Click "New Project"
- Select "Deploy from GitHub repo"
- Choose your repository
- Railway will auto-detect it's a Next.js app

3. **Add PostgreSQL**
- In your project, click "New"
- Select "Database" → "PostgreSQL"
- Railway will automatically set DATABASE_URL

4. **Add Redis**
- Click "New" again
- Select "Database" → "Redis"
- Railway will automatically set REDIS_URL

5. **Set Environment Variables**
Go to your app service → Variables → Add these:

```env
# R2 Storage
R2_ENDPOINT=https://9bfabe3d9c09f6326959120796dd5c08.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=300cce9b4472aa01f214500028fcb2c6
R2_SECRET_ACCESS_KEY=2ffd400dc4749980402b680a4fd6043ac81bfe74933acbfebeac9f308688d87d
R2_BUCKET_NAME=meds
R2_PUBLIC_DOMAIN=https://pub-9aab1dcb153e4aec89543f714dfbd15f.r2.dev

# Redis (Railway sets this automatically, but verify)
REDIS_HOST=${{Redis.RAILWAY_PRIVATE_DOMAIN}}
REDIS_PORT=6379

# Admin
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password-here

# JWT
JWT_SECRET=your-random-secret-key-here
```

6. **Deploy**
- Railway will automatically deploy
- Wait for build to complete
- Click on the generated URL to access your app

### Railway Configuration File

Create `railway.json`:
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm run start",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

---

## Option 2: Render (Alternative Free Option)

Render offers free tier for web services and PostgreSQL.

### Prerequisites
- GitHub account
- Render account (sign up at render.com)
- Upstash account for Redis (free tier)

### Steps

1. **Setup Redis on Upstash**
- Go to https://upstash.com
- Create free account
- Create new Redis database
- Note down: REDIS_HOST, REDIS_PORT, REDIS_PASSWORD

2. **Push to GitHub** (same as Railway)

3. **Deploy PostgreSQL on Render**
- Go to https://render.com
- Click "New" → "PostgreSQL"
- Name: medicine-digitizer-db
- Select Free tier
- Click "Create Database"
- Copy the "Internal Database URL"

4. **Deploy Web Service**
- Click "New" → "Web Service"
- Connect your GitHub repository
- Settings:
  - Name: medicine-digitizer
  - Environment: Docker
  - Region: Choose closest to you
  - Branch: main
  - Plan: Free

5. **Set Environment Variables**
```env
DATABASE_URL=<your-render-postgres-url>
REDIS_HOST=<upstash-host>
REDIS_PORT=<upstash-port>
REDIS_PASSWORD=<upstash-password>
R2_ENDPOINT=https://9bfabe3d9c09f6326959120796dd5c08.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=300cce9b4472aa01f214500028fcb2c6
R2_SECRET_ACCESS_KEY=2ffd400dc4749980402b680a4fd6043ac81bfe74933acbfebeac9f308688d87d
R2_BUCKET_NAME=meds
R2_PUBLIC_DOMAIN=https://pub-9aab1dcb153e4aec89543f714dfbd15f.r2.dev
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
JWT_SECRET=your-random-secret-key
```

6. **Deploy**
- Click "Create Web Service"
- Wait for deployment (first build takes ~10 minutes)
- Access via generated URL

### Render Configuration

Update `Dockerfile` for Render:
```dockerfile
FROM node:20-alpine

RUN apk add --no-cache \
    openssl \
    libc6-compat \
    python3 \
    py3-pip \
    py3-pillow \
    jpeg-dev \
    zlib-dev

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

COPY . .

RUN npx prisma generate
RUN npm run build

EXPOSE 3000

# Render uses PORT env variable
ENV PORT=3000

CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
```

---

## Option 3: Vercel + External Services (Most Complex)

Vercel is free for Next.js but you need external services for PostgreSQL and Redis.

### Services Needed
- **Vercel**: Next.js hosting (free)
- **Neon**: PostgreSQL (free tier - 0.5GB)
- **Upstash**: Redis (free tier - 10k commands/day)

### Steps

1. **Setup Neon PostgreSQL**
- Go to https://neon.tech
- Create free account
- Create new project
- Copy connection string

2. **Setup Upstash Redis**
- Go to https://upstash.com
- Create Redis database
- Copy credentials

3. **Deploy to Vercel**
```bash
npm install -g vercel
vercel login
vercel
```

4. **Set Environment Variables in Vercel**
- Go to Vercel dashboard
- Project Settings → Environment Variables
- Add all variables from .env.example

5. **Important Vercel Limitations**
- Serverless functions have 10s timeout (free tier)
- Image processing might timeout
- Consider using Vercel Pro ($20/month) for 60s timeout

---

## Recommended: Railway

**Why Railway?**
✅ Easiest setup (one-click PostgreSQL + Redis)
✅ No timeout issues
✅ Docker support (Python/Pillow works)
✅ $5/month free credit
✅ Auto-scaling
✅ Built-in monitoring

**Cost Estimate:**
- Free tier: $5 credit/month
- Typical usage: $3-4/month (within free tier)
- Scales automatically if needed

---

## Post-Deployment Checklist

1. **Test Admin Login**
   - Go to your deployed URL
   - Login with admin credentials
   - Create a test user

2. **Test Image Upload**
   - Create a test project
   - Upload a small CSV
   - Try digitizing one entry

3. **Verify R2 Storage**
   - Check if images are uploaded to R2
   - Verify public URLs work

4. **Check Redis Locks**
   - Admin → View Locks
   - Should show empty initially

5. **Test Concurrent Access**
   - Login with 2 different users
   - Both start digitizing same project
   - Verify no duplicate assignments

6. **Monitor Logs**
   - Railway: View logs in dashboard
   - Render: Logs tab
   - Check for errors

---

## Custom Domain (Optional)

### Railway
- Project Settings → Domains
- Add custom domain
- Update DNS records

### Render
- Service Settings → Custom Domain
- Add domain
- Update DNS records

---

## Backup Strategy

### Database Backups
**Railway:**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Backup database
railway run pg_dump $DATABASE_URL > backup.sql
```

**Render:**
- Render automatically backs up free PostgreSQL daily
- Download from dashboard

### R2 Backups
- R2 data is already backed up by Cloudflare
- Consider versioning in R2 settings

---

## Monitoring

### Railway
- Built-in metrics dashboard
- CPU, Memory, Network usage
- Deployment logs

### Render
- Free tier includes basic metrics
- View logs in real-time
- Email alerts for downtime

### Uptime Monitoring (Free)
- Use UptimeRobot (free)
- Monitor your deployed URL
- Get email alerts if down

---

## Scaling Considerations

### When to Upgrade
- Free tier limits reached
- Need faster processing
- More concurrent users (>5)
- Larger datasets (>10k images)

### Upgrade Path
1. **Railway Pro**: $20/month
   - More resources
   - Priority support
   - Better performance

2. **Render Standard**: $7/month per service
   - Faster builds
   - More memory
   - Better uptime

---

## Troubleshooting

### Build Fails
- Check Node.js version (should be 20)
- Verify all dependencies in package.json
- Check Dockerfile syntax

### Database Connection Issues
- Verify DATABASE_URL is set
- Check if migrations ran
- Look for connection errors in logs

### Redis Connection Issues
- Verify REDIS_HOST and REDIS_PORT
- Check if Redis service is running
- Test connection in logs

### Image Processing Fails
- Check if Python/Pillow is installed
- Verify medsright.png exists
- Check R2 credentials

### Timeout Issues
- Reduce image processing batch size
- Use Railway/Render (not Vercel free tier)
- Optimize image processing code

---

## Security Recommendations

1. **Change Default Credentials**
   - Update ADMIN_PASSWORD
   - Use strong JWT_SECRET

2. **Enable HTTPS**
   - Railway/Render provide HTTPS automatically
   - Force HTTPS in production

3. **Rate Limiting**
   - Add rate limiting to API routes
   - Prevent abuse

4. **Environment Variables**
   - Never commit .env to git
   - Use platform's secret management

5. **Database Security**
   - Use connection pooling
   - Enable SSL for database connections

---

## Cost Breakdown

### Free Tier (Railway)
- PostgreSQL: Included in $5 credit
- Redis: Included in $5 credit
- Web Service: Included in $5 credit
- **Total: $0/month** (within free credit)

### Free Tier (Render + Upstash)
- PostgreSQL: Free (0.5GB)
- Redis (Upstash): Free (10k commands/day)
- Web Service: Free (512MB RAM)
- **Total: $0/month**

### Paid Tier (If Scaling Needed)
- Railway Pro: $20/month
- Render Standard: $7/month per service
- Upstash Pro: $10/month
- **Total: ~$20-30/month**

---

## Next Steps

1. Choose deployment platform (Railway recommended)
2. Follow setup steps above
3. Deploy and test
4. Share URL with team
5. Monitor usage and scale as needed

Need help? Check logs first, then platform documentation!
