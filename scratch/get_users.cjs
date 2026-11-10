const { Pool } = require('../PROTOTIPO/api/node_modules/pg');

async function main() {
  const pool = new Pool({ connectionString: 'postgres://postgres:postgres@localhost:5432/postgres' });
  const res = await pool.query(`
    SELECT u.id_usuario, u.email, u.ci, u.estado, 
           ue.nombre as nombre_empleado, ue.rol as rol_empleado, ue.telefono,
           s.nombre as sucursal,
           STRING_AGG(r.nombre_rol, ', ') as roles
    FROM usuarios u
    LEFT JOIN usuarios_empleados ue ON ue.usuario_id = u.id_usuario
    LEFT JOIN sucursales s ON s.id_sucursal = ue.sucursal_id
    LEFT JOIN usuarios_roles ur ON ur.id_usuario = u.id_usuario
    LEFT JOIN roles r ON r.id_rol = ur.id_rol
    GROUP BY u.id_usuario, u.email, u.ci, u.estado, ue.nombre, ue.rol, ue.telefono, s.nombre
    ORDER BY u.id_usuario ASC;
  `);

  console.log(JSON.stringify(res.rows, null, 2));
  await pool.end();
}

main().catch(console.error);

