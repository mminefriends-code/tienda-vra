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
  
  await dataSource.query("ALTER TABLE ventas ADD COLUMN IF NOT EXISTS modalidad VARCHAR(20) NOT NULL DEFAULT 'Presencial';");
  console.log('Added modalidad column');
  
  await dataSource.destroy();
  console.log('Column added successfully');
}

run().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});