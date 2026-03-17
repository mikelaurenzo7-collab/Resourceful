# CLAUDE.md

## Project Overview

**Resourceful** is a home resource broker that monetizes excess solar export, bandwidth leasing, and GPU compute — safely and automatically.

This is an early-stage Python project. The repository is currently in a clean/empty state awaiting initial implementation.

## Technology Stack

- **Language:** Python
- **Linter:** Ruff
- **Type Checking:** mypy
- **Testing:** pytest
- **Documentation:** mkdocs or Sphinx (TBD)
- **Environment Management:** venv, uv, or poetry (see .gitignore for supported options)

## Repository Structure

```
Resourceful/
├── CLAUDE.md          # This file — guidance for AI assistants
├── .gitignore         # Python-focused gitignore
└── README.md          # Project description
```

As the project grows, expect a standard Python layout:

```
Resourceful/
├── src/resourceful/   # Main package source
│   ├── __init__.py
│   ├── solar/         # Solar export monetization
│   ├── bandwidth/     # Bandwidth leasing
│   └── gpu/           # GPU compute sharing
├── tests/             # pytest test suite
├── pyproject.toml     # Project metadata, dependencies, tool config
├── CLAUDE.md
├── README.md
└── .gitignore
```

## Development Conventions

### Code Style

- Follow PEP 8 and modern Python conventions (3.10+)
- Use type annotations for all public functions and methods
- Use Ruff for linting and formatting
- Keep modules focused — one responsibility per module

### Testing

- Use pytest for all tests
- Place tests in `tests/` mirroring the source structure
- Name test files `test_<module>.py`
- Run tests: `pytest`
- Run with coverage: `pytest --cov`

### Dependencies

- Define dependencies in `pyproject.toml`
- Pin versions for reproducibility
- Separate dev dependencies from runtime dependencies

### Git Workflow

- Branch names: `claude/<description>-<id>` for AI-assisted work
- Write clear, concise commit messages describing the "why"
- Keep commits atomic — one logical change per commit
- Default branch: `main`

## Key Design Principles

1. **Safety first** — all resource sharing must be opt-in with sensible defaults and hard limits
2. **Automatic operation** — minimize manual intervention once configured
3. **Modularity** — solar, bandwidth, and GPU modules should be independent and composable
4. **Observable** — log and expose metrics for all resource brokering activity
5. **Secure** — never expose credentials, validate all external inputs, follow OWASP guidelines

## Common Commands

```bash
# Install dependencies (once pyproject.toml exists)
pip install -e ".[dev]"

# Run tests
pytest

# Lint
ruff check .

# Format
ruff format .

# Type check
mypy src/
```

## Environment

- Do not commit `.env` files — use `.env.example` for templates
- Sensitive configuration (API keys, credentials) must come from environment variables
- The `.gitignore` already excludes `.env`, `.envrc`, virtual environments, and IDE configs
