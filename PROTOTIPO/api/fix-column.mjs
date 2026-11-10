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
  const query = await dataSource.query(
    "ALTER TABLE ventas ADD COLUMN IF NOT EXISTS tipo_venta VARCHAR(20) DEFAULT 'Presencial';"
  );
  console.log('Column added successfully:', query);
  await dataSource.destroy();
}

run().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});