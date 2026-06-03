# Migration Archive — Historical Notes

This directory contains migrations that were applied at some point but whose tables/columns have since been removed or superseded by newer migrations. They are kept here for historical reference and audit trail.

## Index

| Migration | Table/Column | Status | Notes |
|-----------|-------------|--------|-------|
| `20260522082520_init` | `users`, `institutions`, `students`, `teachers`, `enrollments`, `refresh_tokens` | Superseded | Initial schema with cross-schema FKs to master `institutions` table. Multi-tenant architecture now replicates institution data per-tenant DB. |
| `20260522091557_add_role_to_refresh_token` | `refresh_tokens.role` | Removed | Added `role` column to `refresh_tokens`. Silently removed in later migrations. The column no longer exists in the current schema. |
| `20260522095306_add_pedagogical_models` | `grades` table | Superseded | Created `grades` table for student numeric/qualitative marks. Current schema uses `notas` + `evaluaciones` instead. The `grades` table does not exist in any active database. |
| `20260522100000_add_rbac_core` | RBAC tables | Active | Core role/permission system. Still in use across all tenants. |
| `20260526164900_student_permissions` | Student module permissions | Active | In use. |
| `20260529100000_add_institution_print_colors` | Print color config | Active | In use. |
| `20260601000000_add_user_levels` | User educational levels | Active | In use. |
| `20260601100000_drop_deprecated_user_level_modality` | Drops old columns | Active | Cleanup migration. In use. |
| `20260601115437_add_user_profiles` | Profile/permission templates | Active | In use. |
| `20260602000000_add_guardian_boolean_fields` | Guardian flags | Active | In use. |

## Cross-Schema Foreign Keys

The `20260522082520_init` migration originally created foreign keys from tenant tables (`users`, `students`, `teachers`, `enrollments`) to the master `institutions` table. In the current multi-tenant architecture, each tenant has its own database with a local `institutions` table — the cross-schema FKs are no longer applicable. This was the initial proof-of-concept schema before the tenant-per-DB pattern was adopted.
