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
  
  // First, check current columns
  const columns = await dataSource.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'ventas' ORDER BY ordinal_position;"
  );
  console.log('Current columns:', columns.map(c => c.column_name));
  
  // Check if modalidad exists and its properties
  const modalidadCol = columns.find(c => c.column_name === 'modalidad');
  if (modalidadCol) {
    console.log('modalidad exists, default:', modalidadCol.default, 'notnull:', modalidadCol.is_nullable === 'NO');
  }
  
  // Update existing rows to set modalidad = 'Presencial'
  await dataSource.query(
    "UPDATE ventas SET modalidad = 'Presencial' WHERE modalidad IS NULL;"
  );
  console.log('Updated existing rows');
  
  // Alter column to set NOT NULL with default
await dataSource.query(
    "ALTER TABLE ventas ALTER COLUMN modalidad SET DEFAULT 'Presencial';"
  );
  console.log('Set default');
  
  await dataSource.query(
    "ALTER TABLE ventas ALTER COLUMN modalidad SET NOT NULL;"
  );
  console.log('Set NOT NULL');
  
  await dataSource.destroy();
  console.log('Done');
}

run().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});