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
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'respaldo_programacion' ORDER BY ordinal_position;"
  );
  console.log('Current columns:', columns);
  
  // The seed data inserts '02:00:00' as time, but column is TIMESTAMP
  // Change column to TIME type
  await dataSource.query(
    "ALTER TABLE respaldo_programacion ALTER COLUMN hora_ejecucion TYPE TIME USING hora_ejecucion::time;"
  );
  console.log('Changed hora_ejecucion to TIME type');
  
  // Set default
  await dataSource.query(
    "ALTER TABLE respaldo_programacion ALTER COLUMN hora_ejecucion SET DEFAULT '02:00:00';"
  );
  console.log('Set default');
  
  await dataSource.destroy();
  console.log('Done');
}

run().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});