# Habit Identity Tracker - Node.js Backend

Complete Node.js backend with Express, JWT authentication, email notifications, and cron jobs.

## Setup Instructions

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment Variables
```bash
cp .env.example .env
```

Edit `.env` with your actual values:
- `JWT_SECRET`: Generate a strong secret key
- `SMTP_USER`: Your email address (Gmail recommended)
- `SMTP_PASS`: Your email app password

#### Gmail Setup:
1. Enable 2-factor authentication in Google Account
2. Go to Security > App Passwords
3. Generate a new app password for "Mail"
4. Use that password in SMTP_PASS

### 3. Start the Server
```bash
# Production
npm start

# Development (with auto-reload)
npm run dev
```

Server will run on http://localhost:5000

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (requires auth)

### Identity
- `GET /api/identity` - Get all identities
- `POST /api/identity/select` - Select user identity
- `GET /api/identity/user` - Get user's identity

### Habits
- `POST /api/habits` - Create habit
- `GET /api/habits` - Get user habits
- `PATCH /api/habits/:id` - Update habit
- `DELETE /api/habits/:id` - Delete habit
- `POST /api/habits/:id/complete` - Mark habit as complete
- `POST /api/habits/:id/uncomplete` - Unmark habit
- `GET /api/habits/analytics` - Get habit analytics

### Boosts
- `POST /api/boost/send` - Send motivation boost
- `GET /api/boost/me` - Get received boosts

### Reflections
- `POST /api/reflection` - Create reflection
- `GET /api/reflection` - Get user reflections

### Reports
- `GET /api/report/weekly` - Get weekly summary
- `GET /api/report/overview` - Get overview stats

## Features

### Email Notifications
- Habit reminders sent based on schedule
- Boost notifications when received
- Cron job runs every minute to check reminders

### Authentication
- JWT-based authentication
- Bcrypt password hashing
- Token expires in 7 days

### Database
Currently uses in-memory storage (resets on restart).

For production, integrate Prisma with PostgreSQL:
1. Install PostgreSQL
2. Update DATABASE_URL in .env
3. Run `npx prisma migrate dev`
4. Use Prisma Client in server.js

## Frontend Integration

Update the API URL in frontend:
```javascript
// src/lib/api.ts
const BASE_URL = 'http://localhost:5000/api';
```

For production deployment:
- Deploy backend to Railway, Heroku, or Render
- Update BASE_URL to your deployed backend URL
- Set environment variables on hosting platform

## Troubleshooting

### Email not sending?
- Verify SMTP credentials
- Check Gmail app password
- Ensure 2FA is enabled
- Check firewall/antivirus settings

### CORS errors?
- Verify frontend URL in cors() middleware
- For production, update allowed origins

### Port already in use?
- Change PORT in .env
- Kill process using the port

## Production Checklist
- [ ] Use strong JWT_SECRET
- [ ] Set up PostgreSQL database
- [ ] Configure production SMTP service
- [ ] Enable HTTPS
- [ ] Set up proper error logging
- [ ] Add rate limiting
- [ ] Implement data validation
- [ ] Set up database backups
