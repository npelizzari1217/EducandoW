import { Pool } from "pg";
import * as fs from "fs";

const pg = new Pool({ connectionString: "postgresql://postgres:postgres@localhost:5433/educandow_master" });

function esc(s: string): string {
  return s.replace(/'/g, "''");
}
function arr(a: string[]): string {
  return "ARRAY[" + a.map(x => `'${x}'`).join(",") + "]::text[]";
}

async function main() {
  const [actions, modules, roles, roleModules, profiles, profilePerms] = await Promise.all([
    pg.query("SELECT * FROM module_actions ORDER BY code"),
    pg.query("SELECT * FROM modules ORDER BY code"),
    pg.query("SELECT * FROM roles ORDER BY id"),
    pg.query('SELECT * FROM role_modules ORDER BY "roleId", "moduleId"'),
    pg.query("SELECT * FROM profiles ORDER BY id"),
    pg.query('SELECT * FROM profile_module_permissions ORDER BY "profileId", "moduleId"'),
  ]);

  let sql = "-- ============================================================\n";
  sql += "-- EducandoW — Full system sync to production\n";
  sql += "-- Generado: " + new Date().toISOString() + "\n";
  sql += "-- Tablas: module_actions, modules, roles, role_modules,\n";
  sql += "--         profiles, profile_module_permissions\n";
  sql += "-- Uso: psql -U postgres -d educandow_master -f sync-system.sql\n";
  sql += "-- ============================================================\n\n";
  sql += "BEGIN;\n\n";

  // 1. module_actions
  sql += `-- 📦 module_actions (${actions.rows.length})\n`;
  for (const r of actions.rows) {
    sql += `INSERT INTO module_actions (id, code, name, active, "createdAt", "updatedAt")\n`;
    sql += `VALUES ('${r.id}', '${r.code}', '${esc(r.name)}', ${r.active}, '${r.createdAt.toISOString()}', '${r.updatedAt.toISOString()}')\n`;
    sql += `ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, active=EXCLUDED.active, "updatedAt"=EXCLUDED."updatedAt";\n\n`;
  }

  // 2. modules
  sql += `-- 📦 modules (${modules.rows.length})\n`;
  for (const r of modules.rows) {
    sql += `INSERT INTO modules (id, code, name, active, "createdAt", "updatedAt")\n`;
    sql += `VALUES ('${r.id}', '${r.code}', '${esc(r.name)}', ${r.active}, '${r.createdAt.toISOString()}', '${r.updatedAt.toISOString()}')\n`;
    sql += `ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, active=EXCLUDED.active, "updatedAt"=EXCLUDED."updatedAt";\n\n`;
  }

  // 3. roles
  sql += `-- 📦 roles (${roles.rows.length})\n`;
  for (const r of roles.rows) {
    sql += `INSERT INTO roles (id, name, description, active, "createdAt", "updatedAt")\n`;
    sql += `VALUES ('${r.id}', '${r.name}', '${esc(r.description || "")}', ${r.active}, '${r.createdAt.toISOString()}', '${r.updatedAt.toISOString()}')\n`;
    sql += `ON CONFLICT (name) DO UPDATE SET description=EXCLUDED.description, active=EXCLUDED.active, "updatedAt"=EXCLUDED."updatedAt";\n\n`;
  }

  // 4. role_modules
  sql += `-- 📦 role_modules (${roleModules.rows.length})\n`;
  for (const r of roleModules.rows) {
    sql += `INSERT INTO role_modules (id, "roleId", "moduleId", actions)\n`;
    sql += `VALUES ('${r.id}', '${r.roleId}', '${r.moduleId}', ${arr(r.actions)})\n`;
    sql += `ON CONFLICT ("roleId", "moduleId") DO UPDATE SET actions=EXCLUDED.actions;\n\n`;
  }

  // 5. profiles — solo activos, excluir perfiles de test
  const prodProfiles = profiles.rows.filter(
    (p: any) => p.active && !p.name.includes("SDD") && !p.name.includes("Proxy")
  );
  const excluded = profiles.rows.length - prodProfiles.length;
  sql += `-- 📦 profiles (${prodProfiles.length} activos, ${excluded} test excluidos)\n`;
  for (const r of prodProfiles) {
    sql += `INSERT INTO profiles (id, name, active, "createdAt", "updatedAt")\n`;
    sql += `VALUES ('${r.id}', '${esc(r.name)}', ${r.active}, '${r.createdAt.toISOString()}', '${r.updatedAt.toISOString()}')\n`;
    sql += `ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, active=EXCLUDED.active, "updatedAt"=EXCLUDED."updatedAt";\n\n`;
  }

  // 6. profile_module_permissions — solo de los perfiles activos
  const prodProfileIds = new Set(prodProfiles.map((p: any) => p.id));
  const prodPerms = profilePerms.rows.filter((p: any) => prodProfileIds.has(p.profileId));
  sql += `-- 📦 profile_module_permissions (${prodPerms.length} de perfiles activos)\n`;
  for (const r of prodPerms) {
    sql += `INSERT INTO profile_module_permissions (id, "profileId", "moduleId", "canRead", "canCreate", "canEdit", "canDelete", "canPrint")\n`;
    sql += `VALUES ('${r.id}', '${r.profileId}', '${r.moduleId}', ${r.canRead}, ${r.canCreate}, ${r.canEdit}, ${r.canDelete}, ${r.canPrint})\n`;
    sql += `ON CONFLICT ("profileId", "moduleId") DO UPDATE SET "canRead"=EXCLUDED."canRead", "canCreate"=EXCLUDED."canCreate", "canEdit"=EXCLUDED."canEdit", "canDelete"=EXCLUDED."canDelete", "canPrint"=EXCLUDED."canPrint";\n\n`;
  }

  sql += "COMMIT;\n";
  sql += "-- ✅ Verify:\n";
  sql += "-- SELECT code, name FROM modules ORDER BY code;\n";
  sql += "-- SELECT id, name FROM roles ORDER BY id;\n";
  sql += "-- SELECT id, name FROM profiles ORDER BY id;\n";

  fs.writeFileSync(__dirname + "/sync-system.sql", sql);

  console.log("✅ sync-system.sql generado:");
  console.log(`   module_actions:         ${actions.rows.length}`);
  console.log(`   modules:                ${modules.rows.length}`);
  console.log(`   roles:                  ${roles.rows.length}`);
  console.log(`   role_modules:           ${roleModules.rows.length}`);
  console.log(`   profiles:               ${prodProfiles.length} (${excluded} test excluidos)`);
  console.log(`   profile_module_perms:   ${prodPerms.length}`);
  console.log("");
  console.log("⚠️  Users, user_roles, user_modules NO incluidos — son datos de la instancia.");
  console.log("⚠️  Perfiles excluidos: Perfil SDD Test, Desde el Proxy, Test SDD Fix");

  await pg.end();
}

main().catch(e => console.error(e));
