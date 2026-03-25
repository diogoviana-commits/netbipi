# Contributing to NetBIPI

Thanks for considering a contribution.

NetBIPI is an open source platform focused on operational support, monitoring,
service desk and network diagnostics. Contributions that improve reliability,
clarity, documentation and maintainability are especially welcome.

## Before you start

1. Read the main [README](README.md).
2. Review the integration guide in [INTEGRACAO.md](INTEGRACAO.md).
3. Make sure you are not committing secrets, `.env` files or generated tokens.

## Local setup

### Docker

```bash
docker-compose up -d
```

### Backend

```bash
cd backend
npm ci
npm run build
```

### Frontend

```bash
cd frontend
npm ci
npm run build
```

## Branches and commits

Use small, focused branches and keep commits descriptive. Recommended prefixes:

- `feat/` for new features
- `fix/` for bug fixes
- `docs/` for documentation changes
- `chore/` for maintenance work

## Pull request checklist

- The change is scoped and easy to review.
- Documentation was updated when the behavior changed.
- The project still builds locally.
- Screenshots were refreshed if the UI changed.
- No secrets, tokens or environment files were added.

## Reporting issues

Please include:

- What you were trying to do
- Expected behavior
- Actual behavior
- Steps to reproduce
- Relevant logs or screenshots

## Code style

- Keep the codebase consistent with the existing TypeScript and React style.
- Prefer small, incremental changes over large refactors.
- Add comments only when the code would otherwise be hard to follow.
