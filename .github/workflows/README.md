# GitHub Actions Workflows

## docker-build-push.yml

Automatically builds and pushes Docker images to Docker Hub on every push and tag.

### Triggers

- **Push to main branch**: Builds and pushes images tagged with `latest` and `main`
- **Tags (v*)**: Builds and pushes images with semantic version tags (e.g., `v1.0.0`, `v1.0`, `v1`)
- **Pull requests**: Builds images (without pushing) for validation

### Images Built

1. **API Service** (`ddoswep-api`)
   - Dockerfile: `ddoswep/backend/Dockerfile`
   - Platforms: linux/amd64, linux/arm64

2. **Web Service** (`ddoswep-web`)
   - Dockerfile: `ddoswep/Dockerfile`
   - Build args: `NEXT_PUBLIC_API_BASE_URL=https://ddos-api.godemo.art`
   - Platforms: linux/amd64, linux/arm64

### Setup

#### 1. Create Docker Hub PAT Token

1. Go to https://hub.docker.com/settings/security
2. Click "New Access Token"
3. Name: `GitHub Actions`
4. Select scopes: **Read & Write**
5. Copy the token

#### 2. Add to GitHub Secrets

1. Go to your GitHub repository
2. Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Name: `DOCKER_HUB_TOKEN`
5. Value: Paste the token from step 1

### Tags and Versions

The workflow automatically creates the following tags:

```
Push to main:
  - hoainnuit/ddoswep-api:main
  - hoainnuit/ddoswep-api:main-5e09865  (with branch prefix)
  - hoainnuit/ddoswep-api:5e09865       (short commit hash)
  - hoainnuit/ddoswep-api:latest
  - hoainnuit/ddoswep-web:main
  - hoainnuit/ddoswep-web:main-5e09865
  - hoainnuit/ddoswep-web:5e09865
  - hoainnuit/ddoswep-web:latest

Tag v1.2.3:
  - hoainnuit/ddoswep-api:v1.2.3
  - hoainnuit/ddoswep-api:1.2
  - hoainnuit/ddoswep-api:1
  - hoainnuit/ddoswep-api:main-abc1234  (branch with commit)
  - hoainnuit/ddoswep-api:abc1234       (short commit hash)
  - hoainnuit/ddoswep-web:v1.2.3
  - hoainnuit/ddoswep-web:1.2
  - hoainnuit/ddoswep-web:1
  - hoainnuit/ddoswep-web:main-abc1234
  - hoainnuit/ddoswep-web:abc1234
```

**Tag Meanings:**
- `latest` - Latest version on main branch
- `v1.2.3` - Semantic version (from git tag)
- `1.2`, `1` - Major/minor versions
- `5e09865` - Short commit hash (7 characters) for exact version tracking
- `main-5e09865` - Branch + commit (useful for debugging)

### Multi-Platform Builds

Images are built for both `linux/amd64` (x86) and `linux/arm64` (ARM) architectures using Docker buildx.

To use a specific architecture in Kubernetes:

```yaml
image:
  repository: hoainnuit/ddoswep-api
  tag: latest
  pullPolicy: IfNotPresent
```

Docker automatically selects the correct architecture for your node.

### Using Short Commit Hash Tags

For pinning to exact commits, use short commit hash tags:

```bash
# Deploy specific commit
helm upgrade ddoswep-api ddoswep-api -n ddoswep \
  --set image.tag=5e09865

# Or in values.yaml
image:
  repository: hoainnuit/ddoswep-api
  tag: 5e09865  # Specific commit
```

Benefits:
- ✅ Pin to exact code version
- ✅ Audit trail of deployments
- ✅ Easy rollback to previous commits
- ✅ Avoid "latest" tag issues

### Local Testing

To test the workflow locally before pushing:

```bash
# Build API
docker buildx build --platform linux/amd64,linux/arm64 \
  -t hoainnuit/ddoswep-api:test \
  -f ddoswep/backend/Dockerfile \
  ddoswep/backend/

# Build Web
docker buildx build --platform linux/amd64,linux/arm64 \
  --build-arg NEXT_PUBLIC_API_BASE_URL="https://ddos-api.godemo.art" \
  -t hoainnuit/ddoswep-web:test \
  -f ddoswep/Dockerfile \
  ddoswep/
```

### Troubleshooting

#### Images not pushed to Docker Hub

- Check that `DOCKER_HUB_TOKEN` secret is set correctly
- Verify the token has **Read & Write** scopes
- Ensure you're on the `main` branch or have created a tag

#### Build fails

- Check the workflow logs on GitHub Actions tab
- Common issues:
  - Missing dependencies in requirements.txt
  - Node modules not installed properly
  - Dockerfile context paths are incorrect

#### Slow builds

- First build is slow (caching)
- Subsequent builds reuse layers
- Multi-platform builds take longer than single-platform

### Monitoring

View workflow runs:
1. Go to GitHub repository
2. Actions tab
3. Click "Build and Push Docker Images"
4. View logs for each run

### Security Notes

- Docker Hub token is stored as a GitHub Secret (encrypted)
- Token is only used during workflow execution
- Never commit the token to the repository
- Rotate the token periodically (recommended every 90 days)
