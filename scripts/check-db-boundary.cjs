const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

function violations(file, source) {
  const adapter = file.startsWith("packages/db/src/adapters/sqlite/");
  const bootstrap = file === "packages/db/src/controller.ts";
  const postgresMigration = file.startsWith("packages/db/src/adapters/postgres/");
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const errors = [];
  function visit(node) {
    let spec;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) spec = node.moduleSpecifier;
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(parsed) === "require")) spec = node.arguments[0];
    if (spec && ts.isStringLiteral(spec)) {
      const value = spec.text;
      const resolved = value.startsWith(".") ? path.posix.normalize(path.posix.join(path.posix.dirname(file), value)) : value;
      if (value === "node:sqlite" && !adapter && !postgresMigration) errors.push("SQLite driver import outside its adapter");
      if (value.startsWith("@projectplaner/db/")) errors.push("Private database deep import");
      if (resolved.includes("packages/db/src/adapters/sqlite/") && !adapter && !postgresMigration && !(bootstrap && value === "./adapters/sqlite")) errors.push("SQLite adapter dependency outside its composition root");
    }
    if (!adapter && !postgresMigration && ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "prepare") errors.push("SQL statement preparation outside the adapter");
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  return errors;
}

function walk(dir) {
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
    if (["node_modules", ".next", "dist", ".git"].includes(entry.name)) return [];
    const file = `${dir}/${entry.name}`;
    return entry.isDirectory() ? walk(file) : /\.tsx?$/.test(file) ? [file] : [];
  });
}

if (require.main === module) {
  const failures = ["apps", "packages", "tests"].flatMap(dir => fs.existsSync(dir) ? walk(dir) : [])
    .flatMap(file => violations(file, fs.readFileSync(file, "utf8")).map(error => `${file}: ${error}`));
  if (failures.length) { console.error(failures.join("\n")); process.exitCode = 1; }
  else console.log("Database import boundary passed.");
}
module.exports = { violations };
