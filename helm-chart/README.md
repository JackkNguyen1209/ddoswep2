# DDoS Detection ML Lab - Helm Charts (Separate)

Two production-ready Helm charts for deploying the DDoS Detection ML Lab to Kubernetes:
- **ddoswep-api**: FastAPI backend with ML pipeline
- **ddoswep-web**: Next.js frontend

## Quick Start

### Prerequisites
- Kubernetes 1.20+
- Helm 3.0+
- Nginx Ingress Controller
- Cert-Manager (for TLS certificates)

### 1. Install Nginx Ingress Controller (if not already installed)

```bash
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
helm install nginx-ingress ingress-nginx/ingress-nginx \
  --namespace ingress-nginx --create-namespace
```

### 2. Install Cert-Manager (for TLS)

```bash
helm repo add jetstack https://charts.jetstack.io
helm repo update
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager --create-namespace \
  --set installCRDs=true
```

### 3. Create ClusterIssuer for Let's Encrypt

```bash
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
```

### 4. Deploy API Service

```bash
helm install ddoswep-api ddoswep-api \
  --namespace ddoswep \
  --create-namespace \
  -f ddoswep-api/values.yaml
```

**Output:**
```
NAME: ddoswep-api
STATUS: deployed
REVISION: 1

✅ API available at: https://ddos-api.aandd.io
✅ API Docs at: https://ddos-api.aandd.io/docs
✅ Health check: https://ddos-api.aandd.io/health
```

### 5. Deploy Web Service

```bash
helm install ddoswep-web ddoswep-web \
  --namespace ddoswep \
  -f ddoswep-web/values.yaml
```

**Output:**
```
NAME: ddoswep-web
STATUS: deployed
REVISION: 1

✅ Frontend available at: https://ddos.aandd.io
✅ Configured API endpoint: https://ddos-api.aandd.io
```

### 6. Verify Deployment

```bash
# Check ingress
kubectl get ingress -n ddoswep
kubectl describe ingress ddoswep-api -n ddoswep
kubectl describe ingress ddoswep-web -n ddoswep

# Check pods
kubectl get pods -n ddoswep

# View logs
kubectl logs -n ddoswep -l app.kubernetes.io/name=ddoswep-api -f
kubectl logs -n ddoswep -l app.kubernetes.io/name=ddoswep-web -f

# Check TLS certificates
kubectl get certificates -n ddoswep
kubectl describe certificate ddoswep-api-tls -n ddoswep
```

---

## Chart Details

### API Chart (ddoswep-api)

**Host**: `ddos-api.aandd.io`
**Port**: 8000 (internal), 443 (HTTPS)
**Data**: `/app/data` (PersistentVolume)

**Key Features**:
- ✅ FastAPI backend with ML pipeline
- ✅ Persistent data storage (10GB by default)
- ✅ Health checks (liveness + readiness)
- ✅ Resource limits (500m-2000m CPU, 512Mi-2Gi RAM)
- ✅ Ingress with TLS/HTTPS
- ✅ Optional: Claude API integration for AI explanations
- ✅ Optional: Ollama integration

### Web Chart (ddoswep-web)

**Host**: `ddos.aandd.io`
**Port**: 3000 (internal), 443 (HTTPS)
**API Backend**: `https://ddos-api.aandd.io`

**Key Features**:
- ✅ Next.js 16 frontend
- ✅ Configured to call API at `https://ddos-api.aandd.io`
- ✅ Health checks (liveness + readiness)
- ✅ Resource limits (250m-1000m CPU, 256Mi-1Gi RAM)
- ✅ Ingress with TLS/HTTPS
- ✅ Vietnamese localization (300+ translations)

---

## Configuration

### API Chart (ddoswep-api/values.yaml)

```yaml
# Key configurable values
replicaCount: 1
image.tag: latest

# Ingress
ingress.host: ddos-api.aandd.io
ingress.enabled: true
ingress.tls.enabled: true

# Resources
resources.requests.cpu: 500m
resources.requests.memory: 512Mi

# Data persistence
persistence.enabled: true
persistence.size: 10Gi

# Optional: Claude API
secrets.ANTHROPIC_API_KEY: ""
secrets.OLLAMA_BASE_URL: ""
```

### Web Chart (ddoswep-web/values.yaml)

```yaml
# Key configurable values
replicaCount: 1
image.tag: latest

# Ingress
ingress.host: ddos.aandd.io
ingress.enabled: true
ingress.tls.enabled: true

# API Configuration
env.NEXT_PUBLIC_API_BASE_URL: "https://ddos-api.aandd.io"

# Resources
resources.requests.cpu: 250m
resources.requests.memory: 256Mi
```

---

## Deployment Scenarios

### Development (Local Kubernetes / Minikube)

**API:**
```bash
helm install ddoswep-api ddoswep-api \
  --namespace ddoswep --create-namespace \
  --set image.tag=latest \
  --set ingress.enabled=false \
  --set replicaCount=1
```

**Web:**
```bash
helm install ddoswep-web ddoswep-web \
  --namespace ddoswep \
  --set image.tag=latest \
  --set ingress.enabled=false \
  --set env.NEXT_PUBLIC_API_BASE_URL="http://ddoswep-api:8000"
```

**Access via port-forward:**
```bash
kubectl port-forward -n ddoswep svc/ddoswep-api 8000:8000 &
kubectl port-forward -n ddoswep svc/ddoswep-web 3000:3000 &
```

### Staging (Real Domain, TLS)

```bash
# API
helm install ddoswep-api ddoswep-api \
  --namespace ddoswep --create-namespace \
  --set image.tag=v1.0.0 \
  --set replicaCount=2 \
  --set autoscaling.enabled=true

# Web
helm install ddoswep-web ddoswep-web \
  --namespace ddoswep \
  --set image.tag=v1.0.0 \
  --set replicaCount=2 \
  --set autoscaling.enabled=true
```

### Production (High Availability)

```bash
# API with Claude API integration
helm install ddoswep-api ddoswep-api \
  --namespace ddoswep --create-namespace \
  --set image.tag=v1.0.0 \
  --set replicaCount=3 \
  --set autoscaling.enabled=true \
  --set autoscaling.minReplicas=3 \
  --set autoscaling.maxReplicas=10 \
  --set resources.requests.cpu=1000m \
  --set resources.requests.memory=1Gi \
  --set persistence.size=50Gi \
  --set secrets.ANTHROPIC_API_KEY="sk-ant-..."

# Web
helm install ddoswep-web ddoswep-web \
  --namespace ddoswep \
  --set image.tag=v1.0.0 \
  --set replicaCount=3 \
  --set autoscaling.enabled=true \
  --set autoscaling.minReplicas=3 \
  --set autoscaling.maxReplicas=10 \
  --set resources.requests.cpu=500m \
  --set resources.requests.memory=512Mi
```

---

## Upgrading

### Upgrade API to new version

```bash
helm upgrade ddoswep-api ddoswep-api \
  --namespace ddoswep \
  --set image.tag=v1.1.0
```

### Upgrade Web to new version

```bash
helm upgrade ddoswep-web ddoswep-web \
  --namespace ddoswep \
  --set image.tag=v1.1.0
```

### Rollback to previous version

```bash
helm rollback ddoswep-api -n ddoswep
helm rollback ddoswep-web -n ddoswep
```

---

## Monitoring & Logs

### View API logs

```bash
kubectl logs -n ddoswep -l app.kubernetes.io/name=ddoswep-api -f
```

### View Web logs

```bash
kubectl logs -n ddoswep -l app.kubernetes.io/name=ddoswep-web -f
```

### Check pod status

```bash
kubectl get pods -n ddoswep -o wide
kubectl describe pod -n ddoswep <pod-name>
```

### Monitor resources

```bash
kubectl top nodes
kubectl top pods -n ddoswep
```

### Check ingress status

```bash
kubectl get ingress -n ddoswep
kubectl describe ingress ddoswep-api -n ddoswep
kubectl describe ingress ddoswep-web -n ddoswep
```

### Verify TLS certificates

```bash
kubectl get certificates -n ddoswep
kubectl describe certificate ddoswep-api-tls -n ddoswep
kubectl get secret ddoswep-api-tls -n ddoswep -o jsonpath='{.data.tls\.crt}' | base64 -d | openssl x509 -text -noout
```

---

## Troubleshooting

### Ingress not getting IP/Hostname

```bash
# Check ingress controller
kubectl get pods -n ingress-nginx
kubectl describe ingress ddoswep-api -n ddoswep

# Check ingress class
kubectl get ingressclass
```

### Certificate not issuing

```bash
# Check cert-manager logs
kubectl logs -n cert-manager -l app=cert-manager -f

# Check certificate status
kubectl describe certificate ddoswep-api-tls -n ddoswep
kubectl get certificaterequests -n ddoswep

# Manual certificate renewal
kubectl delete certificate ddoswep-api-tls -n ddoswep
# Ingress will auto-create a new one
```

### Pods not starting

```bash
kubectl describe pod -n ddoswep <pod-name>
kubectl logs -n ddoswep <pod-name>

# Check resource availability
kubectl describe nodes
```

### API connection issues

```bash
# Test from web pod
kubectl exec -it -n ddoswep <web-pod> -- \
  curl https://ddos-api.aandd.io/health

# Check DNS resolution
kubectl exec -it -n ddoswep <web-pod> -- \
  nslookup ddoswep-api.ddoswep.svc.cluster.local
```

---

## Uninstall

```bash
# Uninstall web
helm uninstall ddoswep-web -n ddoswep

# Uninstall API
helm uninstall ddoswep-api -n ddoswep

# Delete namespace
kubectl delete namespace ddoswep

# Clean up TLS certificates (if needed)
kubectl delete secret ddoswep-api-tls ddoswep-web-tls -n ddoswep 2>/dev/null || true
```

---

## Chart Structure

### API Chart

```
ddoswep-api/
├── Chart.yaml
├── values.yaml
├── .helmignore
└── templates/
    ├── _helpers.tpl
    ├── namespace.yaml
    ├── configmap.yaml
    ├── deployment.yaml
    ├── service.yaml
    ├── ingress.yaml
    ├── pvc.yaml
    ├── secrets.yaml
    ├── hpa.yaml
    ├── NOTES.txt
```

### Web Chart

```
ddoswep-web/
├── Chart.yaml
├── values.yaml
├── .helmignore
└── templates/
    ├── _helpers.tpl
    ├── namespace.yaml
    ├── configmap.yaml
    ├── deployment.yaml
    ├── service.yaml
    ├── ingress.yaml
    ├── hpa.yaml
    ├── NOTES.txt
```

---

## Useful Commands

```bash
# Validate charts
helm lint ddoswep-api
helm lint ddoswep-web

# Template rendering
helm template ddoswep-api ddoswep-api
helm template ddoswep-web ddoswep-web

# Dry-run install
helm install ddoswep-api ddoswep-api --dry-run --debug -n ddoswep --create-namespace

# Get release values
helm get values ddoswep-api -n ddoswep
helm get values ddoswep-web -n ddoswep

# Get manifest
helm get manifest ddoswep-api -n ddoswep
helm get manifest ddoswep-web -n ddoswep
```

---

## Support

For issues, refer to:
- [Helm Documentation](https://helm.sh/docs/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Nginx Ingress Controller](https://kubernetes.github.io/ingress-nginx/)
- [Cert-Manager Documentation](https://cert-manager.io/docs/)

---

## Summary

Two independent Helm charts ready for production deployment:
- **ddoswep-api**: FastAPI backend at `https://ddos-api.aandd.io`
- **ddoswep-web**: Next.js frontend at `https://ddos.aandd.io`

Both charts include Ingress with automatic TLS/HTTPS certificates, health checks, autoscaling, and persistent data storage.
