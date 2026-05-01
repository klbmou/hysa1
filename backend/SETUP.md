# HYSA1 Backend Setup Guide (Render + Supabase/Neon + Cloudinary)

This guide explains how to deploy HYSA1 to Render with external free services for data and media storage.

## Prerequisites
- A Render account
- A Supabase (or Neon) account for PostgreSQL
- A Cloudinary account for media storage

---

## Step 1: Set Up PostgreSQL (Supabase Free)
1. Go to https://supabase.com and create a free project
2. Wait a few minutes for your database to initialize
3. Go to Project Settings → Database → Connection String
4. Copy the "URI" connection string (should start with `postgresql://`)
5. Save this as `DATABASE_URL` (you'll need it for Render)

---

## Step 2: Set Up Cloudinary (Free)
1. Go to https://cloudinary.com and create a free account
2. Go to Dashboard → Account Details
3. Copy:
   - `Cloud Name`
   - `API Key`
   - `API Secret`
4. Save these as:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`

---

## Step 3: Migrate Local Data to PostgreSQL (Optional)
If you have existing data in `data.json`, migrate it using the migration script:
1. Create a `.env` file in this directory with your `DATABASE_URL`
2. Run:
   ```bash
   cd backend
   npm install
   node migrate.js
   ```

---

## Step 4: Deploy to Render
1. Go to https://render.com
2. Create a new **Web Service**
3. Connect your GitHub repository
4. Configure:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Add Environment Variables (in Render Dashboard → Environment → Secrets):
   ```
   DATABASE_URL=postgresql://... (from Supabase)
   CLOUDINARY_CLOUD_NAME=...
   CLOUDINARY_API_KEY=...
   CLOUDINARY_API_SECRET=...
   ```
6. Click **Create Web Service**

---

## How It Works
- **Data Storage**:
  - If `DATABASE_URL` is set → uses PostgreSQL
  - If not → falls back to local `data.json` (for local dev)

- **Media Storage**:
  - If Cloudinary credentials are set → uploads to Cloudinary
  - If not → falls back to local `/uploads` directory (for local dev)

---

## Local Development
For local development:
1. You don't need any external services
2. The app will use `data.json` and local `/uploads`
3. Run:
   ```bash
   cd backend
   npm install
   npm run dev
   ```

---

## Notes
- **Render Free**: Has no persistent disk, so we must use external services for data/media
- **Supabase Free**: 500MB database, 2GB bandwidth/month
- **Cloudinary Free**: 25GB storage, 25GB bandwidth/month
