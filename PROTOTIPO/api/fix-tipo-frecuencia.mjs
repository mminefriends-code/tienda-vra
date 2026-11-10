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
  
  // Add missing column
  await dataSource.query(
    "ALTER TABLE respaldo_programacion ADD COLUMN IF NOT EXISTS tipo_frecuencia VARCHAR(20) DEFAULT 'Diario';"
  );
  console.log('Added tipo_frecuencia column');
  
  // Set default and not null if needed
  await dataSource.query(
    "ALTER TABLE respaldo_programacion ALTER COLUMN tipo_frecuencia SET DEFAULT 'Diario';"
  );
  console.log('Set default');
  
  await dataSource.query(
    "ALTER TABLE respaldo_programacion ALTER COLUMN tipo_frecuencia SET NOT NULL;"
  );
  console.log('Set NOT NULL');
  
  await dataSource.destroy();
  console.log('Done');
}

run().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});