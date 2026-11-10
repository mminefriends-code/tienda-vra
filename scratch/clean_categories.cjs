const { Pool } = require('../PROTOTIPO/api/node_modules/pg');

async function main() {
  const pool = new Pool({ connectionString: 'postgres://postgres:postgres@localhost:5432/postgres' });

  // Deactivate old duplicates
  await pool.query(`UPDATE productos SET estado = 'Inactivo' WHERE codigo IN ('POL-003', 'POL-005', 'PAN-001', 'PAN-002')`);

  // Deactivate old categories
  await pool.query(`UPDATE categorias SET estado = 'Inactivo' WHERE id_categoria IN (2, 3, 6, 8)`);

  // Make sure CAN-101, CAN-102, CAN-103 point to id_categoria of Canguros y Hoodies
  const catCanguro = (await pool.query(`SELECT id_categoria FROM categorias WHERE nombre = 'Canguros y Hoodies'`)).rows[0]?.id_categoria;
  if (catCanguro) {
    await pool.query(`UPDATE productos SET id_categoria = $1 WHERE codigo LIKE 'CAN-%'`, [catCanguro]);
  }

  // Update any product linked to old categories so they link to Canguros (id 9 or 2)
  await pool.query(`UPDATE productos SET id_categoria = 1 WHERE codigo LIKE 'POL-%' AND id_categoria NOT IN (1, 4, 5, 7)`);

  const active = (await pool.query(`
    SELECT p.codigo, p.nombre, c.nombre as categoria
    FROM productos p
    JOIN categorias c ON c.id_categoria = p.id_categoria
    WHERE p.estado = 'Activo'
    ORDER BY p.nombre
  `)).rows;

  console.log('=== CLEAN ACTIVE TORSO CATALOG (' + active.length + ' products) ===');
  active.forEach(a => console.log('•', a.codigo, '|', a.nombre, '| [' + a.categoria + ']'));

  await pool.end();
}

main().catch(console.error);
