# Optional Clean Architecture Layout

Load only when clean architecture is explicitly selected.

```
src/
├── domain/           # Business rules (pure logic, no external deps)
├── application/      # Use cases (domain composition)
├── infrastructure/   # External integrations (DB, API, files)
└── presentation/     # UI or API endpoints
```

Layer rules:

- Dependency direction: presentation → application → domain (reverse forbidden)
- domain must not import external packages
- infrastructure implements domain interfaces
