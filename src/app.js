import express from "express"
import cors from "cors"
import { connection } from "./db.js"

const app = express()

// Habilitamos CORS
app.use(cors())

// Middleware para parsear JSON entrante
app.use(express.json())

// Conexión a la base de datos

connection.connect((err) => {
    if (err) {
        console.error('Error al conectar a la base de datos:', err)
        return
    } else {
        console.log('Conexión exitosa a la base de datos MySQL')
    }
})

app.listen(process.env.DB_PORT, () => {
    console.log(`Servidor iniciado en el puerto ${process.env.DB_PORT}`)
});

// Rutas API
app.get("/", (req, res) => {
    res.send("Hello World!")
})

app.get("/usuarios", async (req, res) => {
    const consulta = 'SELECT * FROM `usuarios`'
    const resultado = await pool.query(consulta)
    res.json(resultado[0])
})