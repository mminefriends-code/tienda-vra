const { Pool } = require('../PROTOTIPO/api/node_modules/pg');

async function main() {
  const pool = new Pool({ connectionString: 'postgres://postgres:postgres@localhost:5432/postgres' });
  
  // 1. Identify non-upper-body products
  // Categories:
  // id_categoria 2: Pantalones
  // id_categoria 3: Faldas
  // id_categoria 6: Vestidos
  // id_categoria 8: Accesorios
  // Plus any product whose name includes: Jean, Pantalon, Falda, Vestido, Cinturón, Conjunto Deportivo
  
  const badProducts = await pool.query(`
    SELECT id_producto, codigo, nombre, id_categoria 
    FROM productos 
    WHERE id_categoria IN (2, 3, 6, 8)
       OR nombre ILIKE '%pantalon%'
       OR nombre ILIKE '%jean%'
       OR nombre ILIKE '%falda%'
       OR nombre ILIKE '%vestido%'
       OR nombre ILIKE '%cintur%'
       OR nombre ILIKE '%conjunto deportivo%'
  `);
  
  console.log('Bad products to deactivate/remove:', badProducts.rows);
  
  const badIds = badProducts.rows.map(p => p.id_producto);
  if (badIds.length > 0) {
    // Set estado to Inactivo so they never appear in public catalog, or search
    await pool.query(`UPDATE productos SET estado = 'Inactivo' WHERE id_producto = ANY($1)`, [badIds]);
    console.log('Deactivated', badIds.length, 'lower-body/non-torso products.');
  }

  // 2. Also ensure remaining upper-body products have estado = 'Activo'
  await pool.query(`UPDATE productos SET estado = 'Activo' WHERE estado != 'Inactivo'`);

  // 3. Let's add Canguros / Hoodies if they don't exist yet!
  const canguroCheck = await pool.query(`SELECT id_producto, codigo, nombre FROM productos WHERE codigo LIKE 'CAN-%' OR nombre ILIKE '%canguro%' OR nombre ILIKE '%hoodie%'`);
  console.log('Existing canguros:', canguroCheck.rows);

  if (canguroCheck.rows.length === 0) {
    // Make sure category 'Canguros y Hoodies' exists
    let catCanguro = (await pool.query(`SELECT id_categoria FROM categorias WHERE nombre ILIKE '%canguro%' OR nombre ILIKE '%hoodie%'`)).rows[0];
    if (!catCanguro) {
      const insCat = await pool.query(`
        INSERT INTO categorias (nombre, descripcion, estado, porcentaje_iva_default)
        VALUES ('Canguros y Hoodies', 'Sudaderas con capucha, canguros térmicos y polerones torso oversize', 'Activo', 13.00)
        RETURNING id_categoria
      `);
      catCanguro = insCat.rows[0];
    }
    const catId = catCanguro.id_categoria;
    console.log('Canguro category ID:', catId);

    const canguros = [
      {
        codigo: 'CAN-101',
        nombre: 'Polerón Canguro Hoodie Urbano con Capucha',
        descripcion: 'Polerón canguro con capucha ajustable, bolsillo delantero y tejido polar suave de alto gramaje para torso superior.',
        precio_base: 180.00,
        id_categoria: catId
      },
      {
        codigo: 'CAN-102',
        nombre: 'Sudadera Canguro Fleece Oversized Streetwear',
        descripcion: 'Canguro oversize con forro térmico fleece y mangas con puño elástico. Ajuste ergonómico para torso.',
        precio_base: 195.00,
        id_categoria: catId
      },
      {
        codigo: 'CAN-103',
        nombre: 'Canguro Deportivo Torso Zip-Hoodie Transpirable',
        descripcion: 'Canguro deportivo con cierre frontal completo y capucha ergonómica, perfecto para entrenar o uso casual diario.',
        precio_base: 170.00,
        id_categoria: catId
      }
    ];

    for (const c of canguros) {
      const res = await pool.query(`
        INSERT INTO productos (codigo, nombre, descripcion, id_categoria, id_temporada, precio_base, porcentaje_iva, destacado, descuento, estado, id_tienda, fecha_registro)
        VALUES ($1, $2, $3, $4, 1, $5, 13.00, true, 0, 'Activo', 1, NOW())
        ON CONFLICT (codigo) DO UPDATE SET estado = 'Activo', nombre = EXCLUDED.nombre
        RETURNING id_producto
      `, [c.codigo, c.nombre, c.descripcion, c.id_categoria, c.precio_base]);

      const idProd = res.rows[0].id_producto;
      console.log('Inserted Canguro:', c.codigo, 'ID:', idProd);

      // Add tallas (S, M, L, XL) and colores (Azul marino, Negro, Gris, Blanco)
      const tallas = (await pool.query(`SELECT id_talla, nombre FROM tallas WHERE nombre IN ('S', 'M', 'L', 'XL')`)).rows;
      const colores = (await pool.query(`SELECT id_color, nombre FROM colores WHERE nombre IN ('Azul marino', 'Negro', 'Gris', 'Blanco')`)).rows;

      for (const t of tallas) {
        for (const col of colores) {
          const ptcRes = await pool.query(`
            INSERT INTO producto_talla_color (id_producto, id_talla, id_color, estado_stock)
            VALUES ($1, $2, $3, 'Disponible')
            ON CONFLICT DO NOTHING
            RETURNING id_ptc
          `, [idProd, t.id_talla, col.id_color]);

          let idPtc = ptcRes.rows[0]?.id_ptc;
          if (!idPtc) {
            idPtc = (await pool.query(`SELECT id_ptc FROM producto_talla_color WHERE id_producto = $1 AND id_talla = $2 AND id_color = $3`, [idProd, t.id_talla, col.id_color])).rows[0]?.id_ptc;
          }

          if (idPtc) {
            // Price
            await pool.query(`
              INSERT INTO producto_precios (id_ptc, precio, fecha_inicio)
              VALUES ($1, $2, CURRENT_DATE)
              ON CONFLICT DO NOTHING
            `, [idPtc, c.precio_base]);

            // Stock in all 4 sucursales
            for (let sId = 1; sId <= 4; sId++) {
              await pool.query(`
                INSERT INTO inventario_stock (id_ptc, id_sucursal, cantidad_disponible, cantidad_reservada)
                VALUES ($1, $2, 25, 0)
                ON CONFLICT (id_ptc, id_sucursal) DO UPDATE SET cantidad_disponible = 25
              `, [idPtc, sId]);
            }
          }
        }
      }

      // Add product images pointing to transparent cutouts
      const colorMap = {
        'Negro': '/productos/polera-negra.png',
        'Blanco': '/productos/polera-blanca.png',
        'Azul marino': '/productos/polera-azul.png',
        'Gris': '/productos/polera-gris.png'
      };
      for (const col of colores) {
        const url = colorMap[col.nombre] || '/productos/polera-negra.png';
        await pool.query(`
          INSERT INTO producto_imagenes (id_producto, id_color, url, es_principal, orden)
          VALUES ($1, $2, $3, $4, 1)
          ON CONFLICT DO NOTHING
        `, [idProd, col.id_color, url, col.nombre === 'Negro']);
      }
    }
  }

  // 4. Update CAM-002 / POL-002 and other active upper garments so they have all sizes S, M, L, XL and colors
  const activeUpper = (await pool.query(`
    SELECT id_producto, codigo, nombre 
    FROM productos 
    WHERE estado = 'Activo'
    ORDER BY id_producto
  `)).rows;

  console.log('Active Upper Garments count:', activeUpper.length);
  for (const p of activeUpper) {
    const ptcCount = (await pool.query(`SELECT COUNT(*) FROM producto_talla_color WHERE id_producto = $1`, [p.id_producto])).rows[0].count;
    console.log(`Product ${p.codigo} (${p.nombre}) has ${ptcCount} variants.`);
    if (parseInt(ptcCount) === 0) {
      // Add standard S, M, L, XL with colors
      const tallas = (await pool.query(`SELECT id_talla FROM tallas WHERE nombre IN ('S', 'M', 'L', 'XL')`)).rows;
      const colores = (await pool.query(`SELECT id_color FROM colores WHERE nombre IN ('Negro', 'Blanco', 'Gris', 'Azul marino')`)).rows;
      for (const t of tallas) {
        for (const col of colores) {
          const ptcRes = await pool.query(`
            INSERT INTO producto_talla_color (id_producto, id_talla, id_color, estado_stock)
            VALUES ($1, $2, $3, 'Disponible')
            RETURNING id_ptc
          `, [p.id_producto, t.id_talla, col.id_color]);
          const idPtc = ptcRes.rows[0].id_ptc;
          await pool.query(`INSERT INTO producto_precios (id_ptc, precio, fecha_inicio) VALUES ($1, 150.00, CURRENT_DATE) ON CONFLICT DO NOTHING`, [idPtc]);
          for (let sId = 1; sId <= 4; sId++) {
            await pool.query(`
              INSERT INTO inventario_stock (id_ptc, id_sucursal, cantidad_disponible, cantidad_reservada)
              VALUES ($1, $2, 20, 0)
              ON CONFLICT (id_ptc, id_sucursal) DO UPDATE SET cantidad_disponible = 20
            `, [idPtc, sId]);
          }
        }
      }
    }
  }

  console.log('Finished updating catalog successfully.');
  await pool.end();
}

main().catch(console.error);
