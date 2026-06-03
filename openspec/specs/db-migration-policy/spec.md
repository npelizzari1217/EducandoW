# DB Migration Policy Specification

## Purpose

Establish a project-wide policy prohibiting `prisma db push` in documented workflows, scripts, and CI pipelines. `prisma migrate deploy` (production) and `prisma migrate dev` (development) are the only approved schema synchronization commands.

## Requirements

### Requirement: prisma db push Is Prohibited

The command `prisma db push` MUST NOT appear in any project documentation, task files, design documents, archive reports, scripts, CI configuration, or package.json commands as a recommended or documented workflow step.

#### Scenario: db push found in archive documentation

- GIVEN an archive document referencing `prisma db push` as an accepted workflow
- WHEN the document is reviewed
- THEN a visible deprecation warning MUST be present at the top of the file
- AND the warning MUST state that `prisma migrate deploy` is the correct alternative

#### Scenario: New task or design references db push

- GIVEN a new SDD artifact being created
- WHEN the artifact references `prisma db push` as a schema sync step
- THEN the artifact SHALL be rejected during review
- AND `prisma migrate deploy` or `prisma migrate dev` MUST be used instead

#### Scenario: db push used in a script

- GIVEN any shell script, Node.js script, or CI step
- WHEN `prisma db push` is invoked
- THEN it SHALL be replaced with `prisma migrate deploy` for production or `prisma migrate dev` for local development

### Requirement: Approved Migration Commands

All migration workflows MUST use:
- `prisma migrate deploy` for production and CI (non-interactive, applies pending migrations)
- `prisma migrate dev` for local development (interactive, creates migration files)
- `prisma migrate status` for drift detection

#### Scenario: Production deployment uses migrate deploy

- GIVEN a deployment pipeline
- WHEN schema changes need to be applied
- THEN `prisma migrate deploy` is executed against the target database
- AND `prisma db push` is never invoked

#### Scenario: Local development uses migrate dev

- GIVEN a developer making schema changes locally
- WHEN they need to sync the database
- THEN they run `prisma migrate dev` to generate migration files
- AND `prisma db push` is not used
