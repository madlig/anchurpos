# Test Credentials

## Accounts

| Username | Password | Role | Default Route |
|----------|----------|------|---------------|
| manager | anchur123 | manager | /manager/dashboard |
| crew1 | anchur123 | crew | /crew/attendance |
| owner | anchur123 | owner | /owner/dashboard |

## Notes
- Email format: `{username}@anchurpos.id`
- All accounts were seeded via `scripts/seed.ts`
- Firebase project: anchurpos

## Access Hierarchy
- **Owner** can access: /owner/*, /manager/*, /crew/*
- **Manager** can access: /manager/*, /crew/*
- **Crew** can only access: /crew/*
