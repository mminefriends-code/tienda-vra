const { Pool } = require('../PROTOTIPO/api/node_modules/pg');

async function main() {
  const pool = new Pool({ connectionString: 'postgres://postgres:postgres@localhost:5432/postgres' });

  // Add CAN-102 and CAN-103 if not present
  const catCanguro = (await pool.query(`SELECT id_categoria FROM categorias WHERE nombre ILIKE '%canguro%'`)).rows[0]?.id_categoria || 1;
  
  const moreCanguros = [
    {
      codigo: 'CAN-101',
      nombre: 'Polerón Canguro Hoodie Urbano con Capucha',
      descripcion: 'Polerón canguro con capucha ajustable, bolsillo delantero y tejido polar suave para torso superior.',
      precio_base: 180.00
    },
    {
      codigo: 'CAN-102',
      nombre: 'Sudadera Canguro Fleece Oversized Streetwear',
      descripcion: 'Canguro oversize con forro térmico fleece y mangas con puño elástico. Ajuste ergonómico para torso.',
      precio_base: 195.00
    },
    {
      codigo: 'CAN-103',
      nombre: 'Canguro Deportivo Torso Zip-Hoodie Transpirable',
      descripcion: 'Canguro deportivo con cierre frontal completo y capucha ergonómica, perfecto para entrenar o uso casual diario.',
      precio_base: 170.00
    }
  ];

  for (const c of moreCanguros) {
    await pool.query(`
      INSERT INTO productos (codigo, nombre, descripcion, id_categoria, id_temporada, precio_base, porcentaje_iva, destacado, descuento, estado, id_tienda, fecha_registro)
      VALUES ($1, $2, $3, $4, 1, $5, 13.00, true, 0, 'Activo', 1, NOW())
      ON CONFLICT (codigo) DO UPDATE SET estado = 'Activo', nombre = EXCLUDED.nombre, precio_base = EXCLUDED.precio_base
    `, [c.codigo, c.nombre, c.descripcion, catCanguro, c.precio_base]);
  }

  // Get all active products
  const activeProds = (await pool.query(`SELECT id_producto, codigo, nombre, precio_base FROM productos WHERE estado = 'Activo'`)).rows;
  const tallas = (await pool.query(`SELECT id_talla, nombre FROM tallas WHERE nombre IN ('S', 'M', 'L', 'XL') ORDER BY orden`)).rows;
  const colores = (await pool.query(`SELECT id_color, nombre FROM colores WHERE nombre IN ('Negro', 'Blanco', 'Gris', 'Azul marino')`)).rows;

  const colorMap = {
    'Negro': '/productos/polera-negra.png',
    'Blanco': '/productos/polera-blanca.png',
    'Azul marino': '/productos/polera-azul.png',
    'Gris': '/productos/polera-gris.png'
  };

  for (const p of activeProds) {
    for (const t of tallas) {
      for (const c of colores) {
        // Ensure PTC
        let ptc = (await pool.query(`
          SELECT id_ptc FROM producto_talla_color 
          WHERE id_producto = $1 AND id_talla = $2 AND id_color = $3
        `, [p.id_producto, t.id_talla, c.id_color])).rows[0];

        if (!ptc) {
          const insPtc = await pool.query(`
            INSERT INTO producto_talla_color (id_producto, id_talla, id_color, estado_stock)
            VALUES ($1, $2, $3, 'Disponible')
            RETURNING id_ptc
          `, [p.id_producto, t.id_talla, c.id_color]);
          ptc = insPtc.rows[0];
        }

        const idPtc = ptc.id_ptc;

        // Ensure Price
        await pool.query(`
          INSERT INTO producto_precios (id_ptc, precio, fecha_inicio)
          VALUES ($1, $2, CURRENT_DATE)
          ON CONFLICT DO NOTHING
        `, [idPtc, p.precio_base || 120.00]);

        // Ensure stock in all 4 sucursales
        for (let sId = 1; sId <= 4; sId++) {
          await pool.query(`
            INSERT INTO inventario_stock (id_ptc, id_sucursal, cantidad_disponible, cantidad_reservada)
            VALUES ($1, $2, 30, 0)
            ON CONFLICT (id_ptc, id_sucursal) DO UPDATE SET cantidad_disponible = 30
          `, [idPtc, sId]);
        }
      }
    }

    // Ensure transparent images in producto_imagenes
    for (const c of colores) {
      const url = colorMap[c.nombre] || '/productos/polera-negra.png';
      await pool.query(`
        INSERT INTO producto_imagenes (id_producto, id_color, url, es_principal, orden)
        VALUES ($1, $2, $3, $4, 1)
        ON CONFLICT DO NOTHING
      `, [p.id_producto, c.id_color, url, c.nombre === 'Negro']);
    }
  }

  console.log('All active torso products populated with S, M, L, XL and all colors + stock.');
  await pool.end();
}

main().catch(console.error);
