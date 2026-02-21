# Medicine Image Digitizer - Production System

A production-ready, multi-user medicine image digitization platform with PostgreSQL, Redis, and R2 storage.

## 🚀 Quick Deploy

### Railway (Recommended - Free)
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template)

1. Click the button above
2. Add your R2 credentials
3. Deploy in 2 minutes!

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment guide.

---

## Features

- **User Management**: Admin and regular user roles with authentication
- **Project Management**: Create projects by uploading CSV files
- **Concurrent Processing**: Multiple users with Redis-based distributed locking
- **Watermark Integration**: Automatic watermark application using Python/Pillow
- **Efficient UX**: Large original image view, 3x3 grid with load more, fast navigation
- **Background Processing**: Non-blocking image processing with failure tracking
- **Admin Dashboard**: View progress, filter entries, track user activity, manage locks
- **Dockerized**: Easy deployment with Docker Compose

## Quick Start

1. **Ensure you have the watermark logo**:
```bash
# Place your logo file as medsright.png in the project root
```

2. **Start the system**:
```bash
docker-compose up --build
```

3. **Access the application**:
- URL: http://localhost:3000
- Default admin credentials: `admin` / `admin123`

## Image Processing Pipeline

1. **Download**: Fetch image from Google search results
2. **Resize**: Resize to 600x600 with white background
3. **Watermark**: Add grayscale watermark (centered, 80% scale, 30% opacity)
4. **Upload**: Upload to R2 Cloudflare storage as WebP

## Development Setup

1. **Install dependencies**:
```bash
npm install
```

2. **Setup database**:
```bash
# Start PostgreSQL and Redis
docker-compose up postgres redis -d

# Run migrations
npx prisma migrate dev
npx prisma generate
```

3. **Install Python dependencies** (for watermark):
```bash
pip3 install Pillow
```

4. **Configure environment**:
```bash
cp .env.example .env
# Edit .env with your credentials
```

5. **Run development server**:
```bash
npm run dev
```

## User Roles

### Admin
- Create and manage projects
- Upload CSV files to create digitization tasks
- View admin dashboard with all entries
- Create and manage users
- View and clear Redis locks
- Reset stuck entries
- Export processed data

### Regular User
- Select a project to work on
- Digitize images (view original, select from Google results)
- Fast navigation with Next/Skip buttons
- Track personal progress

## CSV Format

```csv
name,image_link
Medicine Name 1,https://example.com/image1.jpg
Medicine Name 2,https://example.com/image2.jpg
```

## Architecture

- **Frontend**: Next.js 14 with React
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM
- **Cache/Locks**: Redis for distributed locking
- **Storage**: Cloudflare R2
- **Image Processing**: Sharp (Node.js) + Pillow (Python)
- **Authentication**: JWT with httpOnly cookies
- **Concurrency**: Redis locks with 10-minute TTL

## Watermark Configuration

Edit `lib/watermark.ts` to adjust watermark settings:

```typescript
await addWatermark(
  imageBuffer,
  'medsright.png',  // Logo path
  0.3,              // Opacity (0.1-0.5)
  0.8               // Scale (0.2-0.8)
);
```

## Redis Lock Management

### View Active Locks
- Admin → View Locks
- Shows all locked entries with TTL

### Clear Stuck Entries
- Admin → Reset Stuck Entries
- Clears all Redis locks
- Resets IN_PROGRESS to PENDING

### Lock Behavior
- **TTL**: 10 minutes auto-expiration
- **Release**: Automatic on Skip/Next/Complete
- **Recovery**: Auto-release after TTL

## Database Schema

- **Users**: Authentication and role management
- **Projects**: Container for digitization tasks
- **MedicineEntry**: Individual digitization tasks with status tracking

## API Endpoints

- `POST /api/auth/login` - User login
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create new project (admin only)
- `POST /api/projects/[id]/next-entry` - Get next task (with Redis locking)
- `POST /api/entries/[id]/complete` - Complete task (background processing)
- `POST /api/entries/[id]/skip` - Skip task
- `GET /api/projects/[id]/entries` - Admin view with pagination
- `GET /api/admin/locks` - View Redis locks
- `POST /api/admin/clear-locks` - Clear all locks
- `POST /api/admin/reset-entries` - Reset stuck entries

## Deployment

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

## Environment Variables

See `.env.example` for all required variables.

## Monitoring

### Check Redis Locks
```bash
docker-compose exec redis redis-cli KEYS "lock:entry:*"
```

### Check Database
```bash
docker-compose exec postgres psql -U postgres -d medicine_digitizer
```

### View Logs
```bash
docker-compose logs -f app
```

## Troubleshooting

### No entries available but pending count > 0
- Go to Admin → View Locks to see active locks
- Click "Reset Stuck Entries" to clear locks and reset IN_PROGRESS entries

### Watermark not applying
- Ensure `medsright.png` exists in project root
- Check Python/Pillow is installed in Docker container
- Check logs for watermark errors

### Images not uploading to R2
- Verify R2 credentials in `.env`
- Check R2 bucket permissions
- View logs for upload errors

## License

MIT
