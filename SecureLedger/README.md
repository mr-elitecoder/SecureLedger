# SecureLedger Backend API

A professional-grade Node.js/Express REST API with MySQL database, JWT authentication, and comprehensive logging.

## Project Structure

```
backend/
├── src/
│   ├── config/              # Configuration files
│   │   ├── database.js      # MySQL database connection
│   │   └── logger.js        # Winston logger configuration
│   ├── controllers/         # Route handlers
│   ├── models/              # Database models
│   ├── routes/              # API routes
│   ├── middleware/          # Express middleware
│   │   ├── auth.js          # JWT authentication
│   │   └── errorHandler.js  # Error handling
│   ├── services/            # Business logic
│   ├── validators/          # Input validation
│   ├── utils/               # Utility functions
│   ├── constants/           # Application constants
│   ├── migrations/          # Database migrations
│   ├── public/uploads/      # File uploads directory
│   ├── logs/                # Application logs
│   ├── app.js               # Express app setup
│   └── server.js            # Server entry point
├── tests/
│   ├── unit/                # Unit tests
│   └── integration/         # Integration tests
├── .env.example             # Environment variables template
├── .gitignore               # Git ignore rules
├── package.json             # Project dependencies
└── README.md                # This file
```

## Installation

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Setup environment variables**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your configuration

3. **Setup database**
   - Create MySQL database
   - Run migrations from `src/migrations/`
   - Update database credentials in `.env`

## Available Scripts

- `npm start` - Start the server
- `npm run dev` - Start with nodemon (development)
- `npm test` - Run tests
- `npm run test:unit` - Run unit tests
- `npm run test:integration` - Run integration tests

## API Documentation

### Base URL

```
http://localhost:5000/api/v1
```

### Authentication

Use JWT token in Authorization header:

```
Authorization: Bearer <your_token>
```

### Endpoints

#### Auth Routes (`/auth`)

- `POST /register` - Register new user
- `POST /login` - Login user
- `POST /refresh-token` - Refresh access token
- `POST /logout` - Logout user
- `POST /forgot-password` - Request password reset
- `POST /reset-password` - Reset password

#### User Routes (`/users`)

- `GET /profile` - Get current user profile
- `PUT /profile` - Update current user profile
- `GET /` - Get all users (admin)
- `GET /:id` - Get user by ID
- `PUT /:id` - Update user (admin)
- `DELETE /:id` - Delete user (admin)

## Environment Variables

See `.env.example` for all available options

## Error Handling

All errors follow a consistent format:

```json
{
  "success": false,
  "status": 400,
  "message": "Error message"
}
```

## Logging

Logs are stored in `src/logs/`:

- `app.log` - General application logs
- `error.log` - Error logs only

## Security

- JWT authentication for protected routes
- Password hashing with bcrypt
- CORS enabled with configurable origins
- Helmet for HTTP security headers
- Input validation on all endpoints

## Development

- Use `npm run dev` for development with auto-reload
- Check logs in `src/logs/` for debugging
- Follow the existing code structure for new features

## Production Deployment

1. Set `NODE_ENV=production` in `.env`
2. Update `CORS_ORIGIN` to your frontend domain
3. Use strong `JWT_SECRET` and `JWT_REFRESH_SECRET`
4. Configure email service for password reset
5. Set up proper database backups

## Support

For issues and questions, please contact the development team.
