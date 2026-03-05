# Docker Setup Guide - DDoS Detection ML Lab

## Prerequisites
- Docker Desktop installed (or Docker Engine on Linux)
- Docker Compose installed
- 2GB RAM minimum

## Quick Start

### 1. Build and Run with Docker Compose (Recommended)
```bash
cd /path/to/ddos-detection-lab
docker-compose up --build
```

The application will be available at `http://localhost:3000`

### 2. Manual Docker Build and Run
```bash
# Build image
docker build -t ddos-detection-lab:latest .

# Run container
docker run -p 3000:3000 \
  -v $(pwd)/data/datasets:/app/data/datasets \
  -v $(pwd)/data/models:/app/data/models \
  -v $(pwd)/data/experiments:/app/data/experiments \
  ddos-detection-lab:latest
```

## Volume Management

The Docker setup creates three persistent volumes:
- `./data/datasets/` - Uploaded CSV datasets
- `./data/models/` - Trained ML models
- `./data/experiments/` - Experiment logs and results

## Available Commands

```bash
# Start in detached mode
docker-compose up -d

# View logs
docker-compose logs -f

# Stop containers
docker-compose down

# Remove volumes (WARNING: Deletes all data)
docker-compose down -v

# Rebuild after code changes
docker-compose up --build

# Run specific service
docker-compose up ddos-detection-lab
```

## Environment Variables

Create `.env.docker` file for custom configuration:
```
NODE_ENV=production
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Troubleshooting

**Port 3000 already in use:**
```bash
docker-compose run -p 3001:3000 ddos-detection-lab
```

**Permission denied on volumes:**
```bash
sudo chmod -R 777 ./data
```

**Container exits immediately:**
```bash
docker-compose logs -f
```

## System Requirements

- **CPU**: 2+ cores recommended
- **RAM**: 2GB minimum, 4GB+ recommended
- **Disk**: 1GB+ for models and datasets
- **Network**: Internet for package installations
