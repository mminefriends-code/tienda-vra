const { Pool } = require('../PROTOTIPO/api/node_modules/pg');

async function main() {
  const pool = new Pool({ connectionString: 'postgres://postgres:postgres@localhost:5432/postgres' });

  await pool.query("UPDATE usuarios_empleados SET nombre = 'Dayana Rojas Ascarraga' WHERE usuario_id = 1;");
  await pool.query("UPDATE usuarios_empleados SET nombre = 'Pedro Rojas' WHERE usuario_id = 2;");
  await pool.query("UPDATE clientes SET nombre = 'Dayana Rojas Ascarraga' WHERE usuario_id = 1;");
  await pool.query("UPDATE clientes SET nombre = 'Pedro Rojas' WHERE usuario_id = 2;");
  await pool.query("UPDATE tiendas SET nombre = 'Tienda VRA', slug = 'tienda-vra' WHERE id_tienda = 1;");

  const emp = (await pool.query("SELECT usuario_id, nombre, rol FROM usuarios_empleados WHERE usuario_id IN (1, 2);")).rows;
  const t = (await pool.query("SELECT id_tienda, nombre, slug FROM tiendas WHERE id_tienda = 1;")).rows;

  console.log('Employees:', emp);
  console.log('Tienda:', t);

  await pool.end();
}

main().catch(console.error);
