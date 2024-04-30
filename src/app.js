import express from "express"
import cors from "cors"
import { pool } from "./db.js"

const app = express()

// Habilitamos CORS
app.use(cors())

// Middleware para parsear JSON entrante
app.use(express.json())

// Conexión a la base de datos
pool.getConnection()
    .then(connection => {
        console.log('Conexión exitosa a la base de datos MySQL')
        connection.release() // No olvides liberar la conexión
    })
    .catch(err => {
        console.error('Error al conectar a la base de datos:', err)
    });

app.listen(process.env.DB_PORT, () => {
    console.log(`Servidor iniciado en el puerto ${process.env.DB_PORT}`)
});

// Rutas API
app.get("/", async (req, res) => {
    const consulta = 'SELECT * FROM `usuarios`'
    const resultado = await pool.query(consulta)
    res.json(resultado[0])
})