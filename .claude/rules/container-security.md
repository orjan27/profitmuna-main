---
paths:
  - '**/Dockerfile*'
  - '**/docker-compose*.{yml,yaml}'
  - '**/helm/**/*.{yaml,yml}'
  - '**/k8s/**/*.{yaml,yml}'
---

# Container Security

- Use multi-stage builds. Build stage installs dev dependencies; runtime stage copies only the built artifact.
- Pin base image tags to a specific version (e.g., `eclipse-temurin:21-jre-alpine`). Never use `latest`.
- Use distroless, `-alpine`, or `-slim` base images for the runtime stage. Never use full OS images in production.
- Create a non-root user and switch with `USER`. UID should be > 10000 to avoid collision with host UIDs.
- Use `COPY` instead of `ADD` unless extracting a tar archive.
- Never use `RUN chmod 777`. Use the minimum permissions needed.
- Include a `HEALTHCHECK` instruction with a lightweight probe (wget/curl to a health endpoint or a file check).
- Do not store secrets in build args or environment variables in the Dockerfile. Use runtime secret injection.
- Set `read_only: true` on Docker Compose service containers and mount tmpfs for writable paths.
- Drop all capabilities (`cap_drop: [ALL]`) and add only the specific ones needed.
- Use `security_opt: [no-new-privileges:true]` on every service.
- Set memory and CPU limits on every Docker Compose service.
- Never expose database ports to the host in production. Use internal Docker networks.
- Set `securityContext` on every Kubernetes container: `runAsNonRoot: true`, `allowPrivilegeEscalation: false`, `readOnlyRootFilesystem: true`, `seccompProfile: { type: RuntimeDefault }`.
- Never use `privileged: true` in Kubernetes pod specs.
- Set resource `requests` and `limits` on every Kubernetes container.
- Use `NetworkPolicy` to restrict pod-to-pod traffic to only what is needed.
- Disable the service account token unless the pod needs Kubernetes API access (`automountServiceAccountToken: false`).
