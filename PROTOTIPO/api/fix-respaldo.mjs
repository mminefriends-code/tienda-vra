import { DataSource } from 'typeorm';

const dataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: 'postgres',
  database: 'postgres'
});

async function run() {
  await dataSource.initialize();
  
  // Check current columns
  const columns = await dataSource.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'respaldo_programacion' ORDER BY ordinal_position;"
  );
  console.log('Current columns:', columns.map(c => c.column_name));
  
  // The seed data expects these columns based on the INSERT statement:
  // id_programacion, tipo_frecuencia, hora_ejecucion, activo, retencion_dias
  // But the table has: id_programacion, frecuencia, hora, dia_semana, activo, creado_por, ultima_ejecucion, fecha_creacion
  
  // Add missing columns that seed data expects
  await dataSource.query(
    "ALTER TABLE respaldo_programacion ADD COLUMN IF NOT EXISTS tipo_frecuencia VARCHAR(20) DEFAULT 'Diario';"
  );
  console.log('Added tipo_frecuencia');
  
  await dataSource.query(
    "ALTER TABLE respaldo_programacion ADD COLUMN IF NOT EXISTS hora_ejecucion TIMESTAMP DEFAULT NOW();"
  );
  console.log('Added hora_ejecucion');
  
  await dataSource.query(
    "ALTER TABLE respaldo_programacion ADD COLUMN IF NOT EXISTS retencion_dias INTEGER DEFAULT 30;"
  );
  console.log('Added retencion_dias');
  
  // Set defaults and not null
  await dataSource.query(
    "ALTER TABLE respaldo_programacion ALTER COLUMN tipo_frecuencia SET DEFAULT 'Diario';"
  );
  await dataSource.query(
    "ALTER TABLE respaldo_programacion ALTER COLUMN tipo_frecuencia SET NOT NULL;"
  );
  await dataSource.query(
    "ALTER TABLE respaldo_programacion ALTER COLUMN hora_ejecucion SET DEFAULT NOW();"
  );
  await dataSource.query(
    "ALTER TABLE respaldo_programacion ALTER COLUMN retencion_dias SET DEFAULT 30;"
  );
  
  // Update existing row
  await dataSource.query(
    "UPDATE respaldo_programacion SET tipo_frecuencia = 'Diario', hora_ejecucion = NOW(), retencion_dias = 30 WHERE tipo_frecuencia IS NULL;"
  );
  console.log('Updated existing rows');
  
  await dataSource.destroy();
  console.log('Done');
}

run().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});