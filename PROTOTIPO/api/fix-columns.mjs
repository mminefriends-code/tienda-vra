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
  
  await dataSource.query("ALTER TABLE ventas ADD COLUMN IF NOT EXISTS descuento DECIMAL(10,2) DEFAULT 0;");
  console.log('Added descuento column');
  
  await dataSource.query("ALTER TABLE ventas ADD COLUMN IF NOT EXISTS impuesto DECIMAL(10,2) DEFAULT 0;");
  console.log('Added impuesto column');
  
  await dataSource.query("ALTER TABLE ventas ADD COLUMN IF NOT EXISTS metodo_pago VARCHAR(30) DEFAULT 'Efectivo';");
  console.log('Added metodo_pago column');
  
  await dataSource.query("ALTER TABLE ventas ADD COLUMN IF NOT EXISTS estado VARCHAR(20) DEFAULT 'Completada';");
  console.log('Added estado column');
  
  await dataSource.query("ALTER TABLE ventas ADD COLUMN IF NOT EXISTS fecha_venta TIMESTAMP DEFAULT NOW();");
  console.log('Added fecha_venta column');
  
  await dataSource.destroy();
  console.log('All columns added successfully');
}

run().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});