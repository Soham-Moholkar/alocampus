# AlgoCampus AWS WAF Blueprint (Production Profile)

## Scope
This blueprint is for production deployment only. Local development and LocalNet runtime remain unchanged.

## Reference Architecture
1. `Client -> CloudFront -> WAFv2 Web ACL -> API origin (ALB / API Gateway / ingress)`
2. Static frontend can also be served behind CloudFront with the same or separate Web ACL.
3. Backend in-app rate limiting remains enabled as defense-in-depth.

## Recommended Web ACL Rules
1. AWS Managed Core Rule Set.
2. AWS Managed Known Bad Inputs rule set.
3. AWS Managed Anonymous IP list (optional based on traffic profile).
4. Rate-based rule (example: 2,000 requests per 5 minutes per IP) with block or challenge action.
5. URI-specific tighter rate rules for auth and write routes:
   - `/auth/*`
   - `/demo-auth/*`
   - `/admin/*`
   - `/faculty/*`
   - `/ai/*`
6. Geo allow-list/deny-list only if product requirements demand region restriction.

## Logging and Visibility
1. Enable WAF full logs to Kinesis Firehose -> S3.
2. Enable sampled requests in Web ACL for rapid triage.
3. Add CloudWatch alarms for:
   - sudden block spikes,
   - high rate-limit triggers,
   - sustained 4xx/5xx increase at origin.

## Rollout Strategy
1. Start with `COUNT` mode for new rules.
2. Observe production traffic patterns for 24-72 hours.
3. Move low-false-positive rules to `BLOCK`.
4. Keep emergency bypass runbook documented for incident handling.

## Local Mode Note
No AWS dependency is required for local AlgoCampus:
- LocalNet (`algod`, `indexer`, `kmd`) remains as-is.
- FastAPI runs directly on local port.
- Frontend runs on Vite dev server.

