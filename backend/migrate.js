const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

async function setupDatabase() {
  console.log('Iniciando configuración/migración de la base de datos...');
  const dbPath = path.join(__dirname, 'database.db');
  
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  // Paso 1: Asegurar que la tabla base 'users' exista con los campos originales.
  // Esto es seguro de ejecutar múltiples veces.
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    )
  `);
  console.log('Tabla "users" base asegurada.');

  // Paso 2: Intentar añadir las nuevas columnas.
  // Usamos un bucle y un try/catch para cada columna para hacerlo más robusto.
  const columns = [
    { name: 'nombre', type: 'TEXT' },
    { name: 'apellido', type: 'TEXT' },
    { name: 'verification_code', type: 'TEXT' },
    { name: 'is_verified', type: 'INTEGER DEFAULT 0' },
    { name: 'reset_token', type: 'TEXT' },
    { name: 'reset_token_expires', type: 'INTEGER' }
  ];

  for (const column of columns) {
    try {
      await db.exec(`ALTER TABLE users ADD COLUMN ${column.name} ${column.type}`);
      console.log(`Columna "${column.name}" añadida con éxito.`);
    } catch (error) {
      if (error.message.includes('duplicate column name')) {
        // Esto es esperado si el script ya se ejecutó antes.
        console.log(`Columna "${column.name}" ya existe.`);
      } else {
        console.error(`Error al añadir la columna "${column.name}":`, error.message);
      }
    }
  }

  // Paso 3: Crear la tabla para el historial de cálculos.
  // La llave foránea (FOREIGN KEY) asegura la integridad de los datos.
  await db.exec(`
    CREATE TABLE IF NOT EXISTS calculations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      fecha TEXT NOT NULL,
      monto_total REAL NOT NULL,
      detalles TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )
  `);
  console.log('Tabla "calculations" para el historial asegurada.');


  await db.close();
  console.log('Configuración de la base de datos finalizada.');
}

setupDatabase();