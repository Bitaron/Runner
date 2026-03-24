# APIForge - Postman Clone

A powerful API development and testing platform similar to Postman, built with Next.js, Express.js, and CouchDB.

## Features

### User Management
- User registration and login with JWT authentication
- Team creation and management
- Anonymous/guest user mode with local storage

### API Management
- Support for all HTTP methods (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS)
- Request body types: form-data, URL-encoded, raw (JSON/XML/HTML/Text), GraphQL, binary
- Multiple authentication methods (Bearer, Basic, API Key, OAuth 1.0, OAuth 2.0, Hawk, AWS Signature)
- Pre-request and test scripts (browser-based execution)
- WebSocket support

### Collections & Organization
- Collections with folder hierarchy
- Collection-level variables and scripts
- Environment variables with interpolation

### Import/Export
- Import from Postman Collection v2.1 format
- Export to Postman Collection v2.1 format

### Additional Features
- Code generation in 10+ languages (cURL, JavaScript, Python, Go, etc.)
- Request history
- Soft delete with 30-day trash retention
- Real-time collaboration via WebSocket

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS, Zustand
- **Backend**: Express.js, TypeScript
- **Database**: CouchDB
- **Real-time**: WebSocket
- **Deployment**: Docker, Docker Compose, Nginx

## Getting Started

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
- npm or yarn

### Local Development

1. Clone the repository:
```bash
git clone <repository-url>
cd postman-clone
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Start CouchDB (required):
```bash
docker run -d -p 5984:5984 \
  -e COUCHDB_USER=admin \
  -e COUCHDB_PASSWORD=password \
  couchdb:3
```

5. Start the development servers:
```bash
# Terminal 1: Frontend
npm run dev

# Terminal 2: Backend
npm run dev:api
```

6. Open http://localhost:3000

### Docker Deployment

1. Build and start all services:
```bash
cd docker
docker-compose up -d
```

2. Access the application at http://localhost

## Project Structure

```
postman-clone/
├── apps/
│   ├── web/              # Next.js frontend
│   │   ├── src/
│   │   │   ├── app/           # App pages
│   │   │   ├── components/    # React components
│   │   │   ├── stores/        # Zustand stores
│   │   │   └── lib/           # Utilities
│   │   └── package.json
│   │
│   └── api/              # Express.js backend
│       └── src/
│           ├── controllers/    # Route handlers
│           ├── routes/         # API routes
│           ├── middleware/     # Express middleware
│           ├── config/         # Database config
│           ├── websocket/       # WebSocket handlers
│           └── utils/          # Utilities
│
├── packages/
│   └── shared/           # Shared types and utilities
│
├── docker/               # Docker configuration
│   ├── Dockerfile.web
│   ├── Dockerfile.api
│   ├── docker-compose.yml
│   └── nginx.conf
│
├── .env.example
├── package.json
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/anonymous` - Anonymous access
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Resources
- `GET|POST /api/workspaces` - Workspaces
- `GET|POST /api/collections` - Collections
- `GET|POST /api/requests` - Requests
- `GET|POST /api/environments` - Environments
- `GET|POST /api/teams` - Teams
- `GET|POST /api/history` - History

### Execute
- `POST /api/execute` - Execute HTTP request

### Import/Export
- `POST /api/import/postman` - Import Postman collection
- `GET /api/export/postman/:id` - Export as Postman collection

## Scripts

```bash
# Install dependencies
npm install

# Development
npm run dev              # Start frontend
npm run dev:api          # Start backend

# Build
npm run build            # Build all packages

# Docker
cd docker
docker-compose up -d     # Start all services
docker-compose logs -f   # View logs
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_SECRET` | JWT signing secret | - |
| `JWT_REFRESH_SECRET` | Refresh token secret | - |
| `COUCHDB_URL` | CouchDB connection URL | http://localhost:5984 |
| `COUCHDB_DATABASE` | Database name | apiforge |
| `PORT` | API server port | 4000 |
| `CORS_ORIGIN` | Allowed CORS origin | http://localhost:3000 |

## License

MIT
