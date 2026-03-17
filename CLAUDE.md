# CLAUDE.md — Resourceful

## Project Overview

**Resourceful** is a home resource broker that monetizes excess solar export, bandwidth leasing, and GPU compute — safely and automatically.

- **Language:** Python
- **Status:** Early-stage (initial scaffolding)
- **Repository:** `Resourceful`

## Repository Structure

```
Resourceful/
├── .gitignore          # Python-standard ignore rules
├── README.md           # Project description
└── CLAUDE.md           # This file
```

> The project is in its initial phase. No application code, tests, or CI/CD pipelines exist yet. This file should be updated as the codebase grows.

## Branch Strategy

| Branch    | Purpose                        |
|-----------|--------------------------------|
| `main`    | Stable releases                |
| `develop` | Integration branch for features|
| `claude/*`| AI-assisted feature branches   |

Always branch from `develop` for new features. Merge back into `develop` via pull request.

## Development Setup

### Prerequisites

- Python 3.10+ (recommended)

### Getting Started

```bash
# Clone the repository
git clone <repo-url> && cd Resourceful

# Create a virtual environment
python -m venv .venv
source .venv/bin/activate  # Linux/macOS

# Install dependencies (once a requirements file exists)
# pip install -r requirements.txt
# or: pip install -e ".[dev]"
```

## Build & Run Commands

> These commands are placeholders — update as tooling is configured.

| Task         | Command                        |
|--------------|--------------------------------|
| Run app      | `python -m resourceful`        |
| Run tests    | `pytest`                       |
| Lint         | `ruff check .`                 |
| Format       | `ruff format .`                |
| Type check   | `mypy .`                       |

## Testing

- Test framework: **pytest** (planned, per `.gitignore` entries)
- Place tests in a `tests/` directory mirroring the source structure
- Run: `pytest -v`

## Code Style & Conventions

- **Formatter/Linter:** Ruff (planned, per `.gitignore` entries)
- Follow PEP 8 naming conventions
- Use type hints for all public function signatures
- Keep modules focused — one responsibility per file
- Prefer descriptive variable and function names over comments

## Key Design Principles

1. **Safety first** — resource brokering involves real money and hardware; validate all inputs, fail safely
2. **Modularity** — each resource type (solar, bandwidth, GPU) should be an independent module
3. **Automation** — minimize manual intervention; the broker should operate unattended
4. **Observability** — log decisions, earnings, and errors for the homeowner to review

## AI Assistant Guidelines

- Read existing code before making changes
- Do not create unnecessary files; prefer editing existing ones
- Run tests after making changes (once tests exist)
- Keep commits focused — one logical change per commit
- Never commit secrets, API keys, or `.env` files
- Update this CLAUDE.md when adding new tooling, modules, or conventions
