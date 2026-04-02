# DDoS Detection Lab - Deployment Guide

Complete guide for deploying the DDoS Detection ML Lab with Helm charts on Kubernetes.

---

## 🚀 Quick Start

### Fastest Deployment (30 seconds)

```bash
# 1. Add the charts directory
cd helm-chart

# 2. Deploy both services
helm upgrade --install ddoswep-api ddoswep-api -n ddoswep
helm install ddoswep-web ddoswep-web -n ddoswep

# 3. Verify
kubectl get pods -n ddoswep
```

### Access Services

```bash
# Port-forward for local testing
kubectl port-forward -n ddoswep svc/ddoswep-api 8000:8000 &
kubectl port-forward -n ddoswep svc/ddoswep-web 3000:3000 &

# Access
curl http://localhost:8000/health
open http://localhost:3000
```

---

## 📋 Prerequisites

- **Kubernetes cluster** (v1.19+)
- **Helm 3.0+**
- **kubectl** configured to access your cluster
- **Ingress controller** (nginx recommended) for external access
- **Cert-manager** (optional, for HTTPS with Let's Encrypt)

### Optional: Label nodes for dedicated workloads

```bash
kubectl label nodes <node-name> ddos=true
kubectl taint nodes <node-name> ddos=true:NoSchedule
```

---

## 🐳 Build & Push Docker Images

### Prerequisites for Building Images

- **Docker Desktop** or **Docker Engine**
- **Docker buildx** (for multi-architecture builds)
- **Docker Hub account** (or other container registry)

### Build Images Locally

From the project root directory:

```bash
# Build API image (linux/amd64 architecture)
docker buildx build --platform linux/amd64 \
  -t hoainnuit/ddoswep-api:v2 \
  -t hoainnuit/ddoswep-api:latest \
  --load \
  -f ddoswep/backend/Dockerfile \
  ddoswep/backend/

# Build Web image (linux/amd64 architecture)
# Set NEXT_PUBLIC_API_BASE_URL at build time (required for Next.js)
docker buildx build --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_API_BASE_URL="https://ddos-api.godemo.art" \
  -t hoainnuit/ddoswep-web:v2 \
  -t hoainnuit/ddoswep-web:latest \
  --load \
  -f ddoswep/Dockerfile \
  ddoswep/
```

### Push Images to Docker Hub

```bash
# Login to Docker Hub (one-time setup)
docker login -u <your-docker-hub-username>

# Push API images
docker push hoainnuit/ddoswep-api:v2
docker push hoainnuit/ddoswep-api:latest

# Push Web images
docker push hoainnuit/ddoswep-web:v2
docker push hoainnuit/ddoswep-web:latest
```

### Web Build Arguments

The Web image **requires** `NEXT_PUBLIC_API_BASE_URL` at build time because Next.js bakes environment variables into the bundle:

```bash
# Good: API URL set at build
docker buildx build --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_API_BASE_URL="https://ddos-api.godemo.art" \
  -t hoainnuit/ddoswep-web:v2 \
  --load \
  ddoswep/

# Bad: Setting NEXT_PUBLIC_API_BASE_URL at runtime won't work
# (it won't update the bundle)
```

### Using Custom Registry

Update the image registry in `helm-chart/ddoswep-api/values.yaml`:

```yaml
image:
  registry: your-registry.com  # Change registry
  repository: your-namespace/ddoswep-api
  tag: v2  # or latest
```

Same for Web service in `helm-chart/ddoswep-web/values.yaml`.

### Verify Images

```bash
# Check local images
docker images | grep ddoswep

# Check Docker Hub
curl https://hub.docker.com/v2/repositories/hoainnuit/ddoswep-api/tags
```

---

## 🔧 Deployment Scenarios

### Scenario 1: Claude API (Production)

```bash
helm install ddoswep-api ddoswep-api -n ddoswep --create-namespace \
  --set env.ANTHROPIC_API_KEY="sk-ant-YOUR_KEY" \
  --set replicaCount=3 \
  --set autoscaling.enabled=true

helm install ddoswep-web ddoswep-web -n ddoswep \
  --set env.NEXT_PUBLIC_API_BASE_URL="https://ddos-api.godemo.art" \
  --set replicaCount=3 \
  --set autoscaling.enabled=true
```

### Scenario 2: Ollama (Local AI, No API Key)

```bash
helm install ddoswep-api ddoswep-api -n ddoswep --create-namespace \
  --set env.AI_PRIMARY="ollama" \
  --set env.OLLAMA_BASE_URL="http://ollama:11434" \
  --set env.OLLAMA_MODEL="qwen2.5:7b"

helm install ddoswep-web ddoswep-web -n ddoswep
```

### Scenario 3: With Pre-created Kubernetes Secret

```bash
# Create secret first
kubectl create secret generic ddoswep-api-secrets \
  --from-literal=ANTHROPIC_API_KEY="sk-ant-YOUR_KEY" \
  -n ddoswep

# Then deploy referencing the secret
helm install ddoswep-api ddoswep-api -n ddoswep --create-namespace \
  --set secretName="ddoswep-api-secrets"

helm install ddoswep-web ddoswep-web -n ddoswep
```

### Scenario 4: Compare Mode (Test Claude vs Ollama)

```bash
helm install ddoswep-api ddoswep-api -n ddoswep --create-namespace \
  --set env.AI_COMPARE_MODE="true" \
  --set env.ANTHROPIC_API_KEY="sk-ant-YOUR_KEY" \
  --set env.OLLAMA_BASE_URL="http://ollama:11434"

# View comparison logs
kubectl exec -n ddoswep <api-pod-name> -- cat /tmp/ai_compare.jsonl
```

---

## 📊 Environment Variables Reference

### API Service (ddoswep-api)

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_UPLOAD_MB` | 200 | Max upload file size in MB |
| `MAX_CAT_CATEGORIES` | 2000 | Max categories per column |
| `DATA_DIR` | /app/data | Data directory path |
| `ANTHROPIC_API_KEY` | (empty) | Claude API key for AI explanations |
| `OLLAMA_BASE_URL` | (empty) | Ollama server URL (e.g., http://ollama:11434) |
| `OLLAMA_MODEL` | (empty) | Ollama model name (e.g., qwen2.5:7b) |
| `AI_PRIMARY` | claude | Primary AI service: "claude" or "ollama" |
| `AI_COMPARE_MODE` | false | Enable Claude vs Ollama comparison |
| `AI_COMPARE_LOG` | /tmp/ai_compare.jsonl | Log path for comparison results |

**Persistence:**
- Storage: 10GB PersistentVolume (configurable)
- Mount path: /app/data
- Auto-creates data directory

**Compute:**
- Requests: 500m CPU, 512Mi RAM
- Limits: 2000m CPU, 2Gi RAM

### Web Service (ddoswep-web)

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | https://ddos-api.godemo.art | API endpoint (must match deployed API) |
| `NODE_ENV` | production | Next.js environment |

**Compute:**
- Requests: 250m CPU, 256Mi RAM
- Limits: 1000m CPU, 1Gi RAM

---

## 📐 Network Configuration

### Ingress Hosts

- **API**: `ddos-api.godemo.art` (port 8000)
- **Web**: `ddos.godemo.art` (port 3000)
- **TLS**: Enabled via Let's Encrypt (cert-manager required)
- **Class**: nginx (configurable in values.yaml)

### Update API Endpoint for Web

When deploying to different domains:

```bash
helm upgrade ddoswep-web ddoswep-web -n ddoswep \
  --set env.NEXT_PUBLIC_API_BASE_URL="https://your-api-domain.com"
```

---

## 🔐 Security & Secrets

### Option 1: Pass via Helm CLI (Simplest)

```bash
helm install ddoswep-api ddoswep-api -n ddoswep --create-namespace \
  --set env.ANTHROPIC_API_KEY="sk-ant-YOUR_KEY"
```

### Option 2: Pre-create Kubernetes Secret

```bash
kubectl create secret generic ddoswep-api-secrets \
  --from-literal=ANTHROPIC_API_KEY="sk-ant-YOUR_KEY" \
  -n ddoswep

helm install ddoswep-api ddoswep-api -n ddoswep --create-namespace \
  --set secretName="ddoswep-api-secrets"
```

### Option 3: Sealed Secrets (Advanced, GitOps-ready)

```bash
# Install sealed-secrets controller
helm repo add sealed-secrets https://bitnami-labs.github.io/sealed-secrets
helm install sealed-secrets sealed-secrets/sealed-secrets -n kube-system

# Create and seal your secret
echo -n "sk-ant-YOUR_KEY" | kubectl create secret generic ddoswep-api-secrets \
  --dry-run=client \
  --from-file=ANTHROPIC_API_KEY=/dev/stdin \
  -o yaml | kubeseal -o yaml > sealed-secret.yaml

# Apply sealed secret
kubectl apply -f sealed-secret.yaml

# Deploy
helm install ddoswep-api ddoswep-api -n ddoswep --create-namespace \
  --set secretName="ddoswep-api-secrets"
```

---

## 🎯 Common Operations

### Check Deployment Status

```bash
# List all pods
kubectl get pods -n ddoswep

# Detailed status
kubectl describe pod -n ddoswep <pod-name>

# View logs
kubectl logs -n ddoswep -l app.kubernetes.io/name=ddoswep-api -f
kubectl logs -n ddoswep -l app.kubernetes.io/name=ddoswep-web -f
```

### Verify Environment Variables

```bash
kubectl exec -n ddoswep <api-pod-name> -- env | grep -E "MAX_|ANTHROPIC|OLLAMA|AI_"
```

### Check API Health

```bash
# From inside cluster
kubectl exec -n ddoswep <api-pod-name> -- curl http://localhost:8000/health

# Via port-forward
curl http://localhost:8000/health
```

### Update Configuration

```bash
# Change AI service
helm upgrade ddoswep-api ddoswep-api -n ddoswep \
  --set env.AI_PRIMARY="ollama" \
  --set env.OLLAMA_BASE_URL="http://ollama:11434"

# Increase upload limit
helm upgrade ddoswep-api ddoswep-api -n ddoswep \
  --set env.MAX_UPLOAD_MB="1000"

# Scale replicas
helm upgrade ddoswep-api ddoswep-api -n ddoswep \
  --set replicaCount=3
```

### View Current Configuration

```bash
helm get values ddoswep-api -n ddoswep
helm get values ddoswep-web -n ddoswep
```

### Rollback Deployment

```bash
helm rollback ddoswep-api 1 -n ddoswep
helm rollback ddoswep-web 1 -n ddoswep
```

### Delete Deployment

```bash
helm uninstall ddoswep-api -n ddoswep
helm uninstall ddoswep-web -n ddoswep
kubectl delete ns ddoswep
```

---

## 🐛 Troubleshooting

### Pod Stuck in Pending

**Likely cause:** Node selector `ddos: "true"` not found

```bash
# Check nodes
kubectl get nodes --show-labels | grep ddos

# Add label if missing
kubectl label nodes <node-name> ddos=true
kubectl taint nodes <node-name> ddos=true:NoSchedule
```

### API Returns "Unauthorized" on AI Calls

**Check 1:** Verify API key is set

```bash
kubectl exec -n ddoswep <api-pod-name> -- env | grep ANTHROPIC_API_KEY
```

**Check 2:** Verify key is valid (test with curl)

```bash
curl -H "Authorization: Bearer sk-ant-YOUR_KEY" https://api.anthropic.com/v1/models
```

**Check 3:** Switch to Ollama if key missing

```bash
helm upgrade ddoswep-api ddoswep-api -n ddoswep \
  --set env.AI_PRIMARY="ollama" \
  --set env.OLLAMA_BASE_URL="http://ollama:11434"
```

### Web Cannot Connect to API

**Check 1:** Verify API_BASE_URL is correct

```bash
helm get values ddoswep-web -n ddoswep | grep NEXT_PUBLIC_API_BASE_URL
```

**Check 2:** Test API connectivity from web pod

```bash
kubectl exec -n ddoswep <web-pod-name> -- curl https://ddos-api.godemo.art/health
```

**Check 3:** Update if domain is different

```bash
helm upgrade ddoswep-web ddoswep-web -n ddoswep \
  --set env.NEXT_PUBLIC_API_BASE_URL="https://your-api-domain.com"
```

### Persistence Not Working

```bash
# Check PVC
kubectl get pvc -n ddoswep

# Check PV
kubectl get pv

# Create PV if needed or specify storageClass
helm upgrade ddoswep-api ddoswep-api -n ddoswep \
  --set persistence.storageClass="standard"
```

### OOM (Out of Memory) Errors

```bash
# Increase memory limits
helm upgrade ddoswep-api ddoswep-api -n ddoswep \
  --set resources.limits.memory="4Gi"
```

---

## 📦 Docker Images

- **API**: `hoainnuit/ddoswep-api:v2` or `:latest` (linux/amd64)
- **Web**: `hoainnuit/ddoswep-web:v2` or `:latest` (linux/amd64)

Change in `values.yaml`:

```yaml
image:
  registry: docker.io
  repository: hoainnuit/ddoswep-api
  tag: v2  # or latest
```

---

## 📐 Chart Structure

```
helm-chart/
├── ddoswep-api/
│   ├── values.yaml              # Configuration
│   ├── Chart.yaml               # Metadata
│   └── templates/
│       ├── deployment.yaml      # Pod definition
│       ├── service.yaml         # ClusterIP service
│       ├── ingress.yaml         # Ingress configuration
│       ├── pvc.yaml             # Persistent volume
│       ├── hpa.yaml             # Autoscaling
│       ├── namespace.yaml       # Namespace creation
│       └── _helpers.tpl         # Template helpers
│
└── ddoswep-web/
    ├── values.yaml
    ├── Chart.yaml
    └── templates/
        ├── deployment.yaml
        ├── service.yaml
        ├── ingress.yaml
        ├── hpa.yaml
        └── _helpers.tpl
```

---

## ✅ Post-Deployment Checklist

- [ ] Pods are running: `kubectl get pods -n ddoswep`
- [ ] Services are created: `kubectl get svc -n ddoswep`
- [ ] API health check passes: `curl https://ddos-api.godemo.art/health`
- [ ] Web loads: `curl -I https://ddos.godemo.art`
- [ ] Environment variables are set: `kubectl exec ... -- env | grep <VAR>`
- [ ] Ingress is active: `kubectl get ingress -n ddoswep`
- [ ] DNS resolves: `nslookup ddos-api.godemo.art`
- [ ] TLS certificate is valid: `kubectl get certificate -n ddoswep`

---

## 🔗 Useful Commands Reference

```bash
# Deployment
helm install ddoswep-api ddoswep-api -n ddoswep --create-namespace
helm upgrade ddoswep-api ddoswep-api -n ddoswep
helm uninstall ddoswep-api -n ddoswep

# Debugging
kubectl get pods -n ddoswep
kubectl logs -n ddoswep -f <pod-name>
kubectl exec -n ddoswep <pod-name> -- bash
kubectl describe pod -n ddoswep <pod-name>

# Port forwarding
kubectl port-forward -n ddoswep svc/ddoswep-api 8000:8000
kubectl port-forward -n ddoswep svc/ddoswep-web 3000:3000

# Health checks
kubectl get endpoints -n ddoswep
kubectl get ingress -n ddoswep
```

---

## 📚 More Information

- **Claude API Setup**: Get API key from https://console.anthropic.com
- **Ollama Setup**: Run `ollama pull qwen2.5:7b` on Ollama server
- **Kubernetes Docs**: https://kubernetes.io/docs
- **Helm Docs**: https://helm.sh/docs

---

**Last Updated**: 2026-03-31
