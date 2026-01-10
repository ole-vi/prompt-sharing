# Docker Development Environment Setup

This setup allows you to run the Firebase Emulator Suite in Docker for safe local development.

## Authentication Strategy

This environment uses a **hybrid approach**:
- ✅ **Production Firebase Auth** - Real GitHub OAuth login
- ✅ **Emulated Firestore** - Local database (no production data impact)
- ✅ **Emulated Functions** - Local function execution
- ✅ **Emulated Storage** - Local file storage

This means you log in with your real GitHub account, but **all data operations happen locally** with zero impact on production.

## Prerequisites

- Docker Desktop installed
- Docker Compose installed (included with Docker Desktop)
- GitHub OAuth App configured (see setup below)

## GitHub OAuth Setup

Add this callback URL to your GitHub OAuth App:
- **Authorization callback URL**: `http://localhost:5000/oauth-callback.html`

[Find your GitHub OAuth App settings here](https://github.com/settings/developers)

## Getting Started

### 1. Build and start the development environment

```bash
docker-compose up --build
```

Or run in detached mode:
```bash
docker-compose up -d
```

### 2. Access the services

Once running, you can access:

- **Web App**: http://localhost:5000 - Your hosted application
- **Emulator UI**: http://localhost:4000 - Full Firebase Emulator dashboard
- **Functions**: http://localhost:5001 - Firebase Functions endpoint
- **Firestore**: localhost:8080 - Firestore emulator
- **Storage**: localhost:9199 - Storage emulator

### 3. Sign In

Click "Sign in with GitHub" and use your real GitHub account. The browser console will show:
```
🔧 Connected to Firebase Emulators (Firestore, Functions)
🔐 Using production Firebase Auth for GitHub OAuth
```

All subsequent data will be stored in the local Firestore emulator, not production.

## Common Commands

### View logs
```bash
docker-compose logs -f
```

### Stop the environment
```bash
docker-compose down
```

### Restart with fresh data
```bash
docker-compose down -v
rm -rf emulator-data
docker-compose up --build
```

### Access container shell
```bash
docker-compose exec firebase-emulator bash
```

### Rebuild after changes
```bash
docker-compose up --build
```

## Data Persistence

Emulator data is automatically saved to the `emulator-data/` directory and restored on restart. This includes:
- Firestore data
- Auth users
- Storage files
- Functions state

To start fresh, delete the `emulator-data/` directory.

## Updating Functions

Functions code changes are automatically detected. The emulator will reload functions when you save changes to files in the `functions/` directory.

## Troubleshooting

### Port conflicts
If ports are already in use, edit `docker-compose.yml` to change the host ports (left side of the colon):
```yaml
ports:
  - "4001:4000"  # Changes host port to 4001
```

### Functions not updating
Restart the container:
```bash
docker-compose restart
```

### Clear all data and start fresh
```bash
docker-compose down -v
rm -rf emulator-data node_modules functions/node_modules
docker-compose up --build
```

## Environment Isolation

This Docker setup uses a separate Firebase project ID (`demo-prompt-sharing`) to ensure complete isolation from your production environment. No changes made in the emulators will affect your live Firebase project.

## Next Steps

1. Add test data through the Emulator UI (http://localhost:4000)
2. Test Firebase Functions locally
3. Validate Firestore rules before deploying
4. Test authentication flows without affecting production users
