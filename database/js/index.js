// Accès JS à la base de données
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database/db.sqlite', (err) => {
    if (err) console.error('Erreur de connexion à la base:', err.message);
    else console.log('Connecté à la base SQLite.');
});
module.exports = db;