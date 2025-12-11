# Deployment Guide

## Git Setup & Push

If you haven't set up your git remote yet:

```bash
# Add your GitHub remote (replace with your actual repo URL)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

# Push to GitHub
git push -u origin master
```

## Render Backend Deployment Fix

### Problem
The backend cannot be deployed via command line because the `render.yaml` was in the subdirectory, and Render needs it at the repository root for monorepo setups.

### Solution
A root-level `render.yaml` has been created that specifies:
- `rootDir: bni-anchor-checkin-backend` - tells Render where the backend code is
- All other settings from the original render.yaml

### Deploy via Render CLI

1. **Install Render CLI** (if not already installed):
```bash
npm install -g render-cli
# OR
brew install render
```

2. **Login to Render**:
```bash
render login
```

3. **Deploy using render.yaml**:
```bash
# From the repository root
render deploy
```

This will read the `render.yaml` at the root and deploy the backend service.

### Alternative: Manual Deployment via Dashboard

If CLI doesn't work, you can still use the dashboard:
1. Go to https://dashboard.render.com
2. Your service should auto-deploy on git push (if connected to GitHub)
3. Or manually trigger deployment from the dashboard

### Verify Deployment

After deployment, check:
```bash
curl https://your-backend.onrender.com/api/members
```

## Vercel Frontend Deployment

### Deploy via Vercel CLI

```bash
cd bni-anchor-checkin
npx vercel --prod
```

### Set Environment Variables

Make sure to set the backend API URL:
```bash
npx vercel env add VITE_API_BASE production
# Enter: https://your-backend.onrender.com
```

### Auto-deploy on Git Push

If your Vercel project is connected to GitHub, it will auto-deploy on push to master/main branch.

## Troubleshooting Render Deployment

### Issue: "Cannot find Dockerfile"
- **Solution**: The `rootDir` in render.yaml should point to `bni-anchor-checkin-backend`

### Issue: "Build failed"
- Check the build logs in Render dashboard
- Verify the Dockerfile path is correct
- Ensure PORT environment variable is set (Render sets this automatically)

### Issue: "Service not starting"
- Check health check path: `/api/members`
- Verify the port is correctly configured (should use `$PORT` env var, not hardcoded)

## Current Configuration

- **Backend**: Render (Docker)
- **Frontend**: Vercel (Vite/React)
- **Monorepo**: Root contains both frontend and backend
