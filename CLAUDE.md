# CLAUDE.md — Resourceful

## Project Overview

**Resourceful** is a home resource broker that automatically monetizes excess home resources:
- **Solar Export** — sells surplus solar energy back to the grid or peer-to-peer markets
- **Bandwidth Leasing** — rents unused internet bandwidth to VPN/CDN providers
- **GPU Compute** — leases idle GPU cycles to distributed compute marketplaces

The system operates safely and automatically, with user-defined limits, kill-switches, and audit trails.

---

## Repository Structure

```
Resourceful/
├── CLAUDE.md              # This file
├── README.md              # Project summary
├── src/
│   ├── brokers/           # Resource broker modules (solar, bandwidth, gpu)
│   ├── monitors/          # Resource usage monitors
│   ├── schedulers/        # Task scheduling and automation
│   ├── integrations/      # Third-party API integrations
│   ├── safety/            # Kill-switch, limits, and safety checks
│   └── api/               # Internal REST/gRPC API
├── config/
│   ├── default.yaml       # Default configuration
│   └── schema.yaml        # Config validation schema
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
└── docs/
    └── architecture.md
```

---

## Development Branch

Active development branch: `claude/comprehensive-claude-docs-5SRrQ`

Always develop on and push to the correct branch. Never push to `main` or `master` without an explicit PR review.

---

## Common Commands

```bash
# Install dependencies
npm install          # or: pip install -r requirements.txt

# Run in development mode
npm run dev

# Run tests
npm test
npm run test:unit
npm run test:integration

# Lint and format
npm run lint
npm run format

# Build for production
npm run build

# Start production server
npm start
```

> Update this section once actual tooling is confirmed.

---

## Architecture

### Broker Model

Each resource type is a self-contained broker module implementing a common interface:

```
BrokerInterface:
  - status()         → current state and metrics
  - enable()         → activate monetization
  - disable()        → deactivate monetization
  - getLimits()      → current safety limits
  - setLimits(cfg)   → update safety limits
  - getEarnings()    → earnings summary
```

### Safety Layer

All brokers pass through a central **Safety Layer** before any external action. The safety layer enforces:

1. **Hard limits** — never exceed user-configured resource thresholds (e.g., max 20% GPU, max 50 Mbps bandwidth)
2. **Kill-switch** — global or per-resource immediate shutoff
3. **Time windows** — only monetize during user-defined schedules
4. **Audit log** — every action is logged with timestamp, resource, amount, and counterparty

### Event Flow

```
Resource Monitor → Safety Check → Broker Action → Earnings Ledger → Audit Log
```

---

## Key Design Principles

- **Safety first**: resource limits and kill-switches are non-negotiable constraints, not suggestions
- **Transparency**: all automated actions are logged and surfaced to the user
- **Modularity**: each resource type (solar, bandwidth, GPU) is independently enable/disable-able
- **Minimal footprint**: the agent should use as few system resources as possible when monitoring
- **Fail-safe defaults**: when uncertain, do nothing and alert the user

---

## Configuration

User configuration lives in `config/default.yaml`. Key sections:

```yaml
solar:
  enabled: true
  max_export_kw: 5.0          # Maximum kW to export
  min_home_reserve_kw: 1.0    # Always keep this much for home use
  market: "octopus"           # Integration target

bandwidth:
  enabled: false
  max_upload_mbps: 50
  max_download_mbps: 10
  provider: "mysterium"

gpu:
  enabled: false
  max_utilization_pct: 30
  min_vram_reserve_gb: 4
  provider: "vast_ai"

safety:
  kill_switch: false           # Set true to stop all monetization immediately
  audit_log_path: "./logs/audit.log"
  alert_email: ""
```

---

## Integrations

| Resource   | Primary Integration      | Fallback        |
|------------|--------------------------|-----------------|
| Solar      | Octopus Agile API        | SolarEdge API   |
| Bandwidth  | Mysterium Network        | Honeygain       |
| GPU        | Vast.ai                  | Salad.io        |

Each integration module lives in `src/integrations/<provider>/`.

---

## Testing Guidelines

- Unit tests mock all external APIs and hardware sensors
- Integration tests run against sandboxed provider staging environments
- E2E tests require a full local environment (see `docs/e2e-setup.md`)
- Safety layer must have 100% unit test coverage — no exceptions

```bash
# Run with coverage
npm run test:coverage

# Run safety layer tests specifically
npm test -- --testPathPattern=safety
```

---

## Security Considerations

- API keys and credentials go in `.env` (never committed)
- `.env.example` documents required variables without values
- No credentials in logs or audit trails
- All outbound connections to monetization providers must use TLS
- Rate-limit all inbound API calls to the internal API

---

## Environment Variables

```bash
# Copy and fill in
cp .env.example .env
```

Required variables:

```
OCTOPUS_API_KEY=
MYSTERIUM_NODE_KEY=
VAST_AI_API_KEY=
AUDIT_LOG_LEVEL=info       # debug | info | warn | error
PORT=3000
```

---

## Pull Request Checklist

- [ ] Tests pass (`npm test`)
- [ ] Lint passes (`npm run lint`)
- [ ] Safety layer tests at 100% coverage
- [ ] No credentials or secrets committed
- [ ] Audit log updated if new automated actions are added
- [ ] Config schema updated if new config keys are added
- [ ] CLAUDE.md updated if architecture changes

---

## Notes for Claude

- When adding a new resource broker, always implement the full `BrokerInterface` and add it to the Safety Layer pipeline
- The kill-switch in `safety/` must be checked before any external action — do not bypass it
- Prefer editing existing files over creating new ones
- Keep changes minimal and focused; do not refactor unrelated code
- All monetary amounts should be stored as integers (cents/satoshis) to avoid floating-point errors
