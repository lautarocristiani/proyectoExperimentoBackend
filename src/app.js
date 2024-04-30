import express from "express"
import cors from "cors"
import { pool } from "./db.js"

const app = express()

// Habilitamos CORS

const corsOptions = {
    origin: 'https://expfrontend.vercel.app',
    optionsSuccessStatus: 200
  };

app.use(cors(corsOptions))

// Middleware para parsear JSON entrante
app.use(express.json())

// Conexión a la base de datos

pool.getConnection()
    .then(async connection => {
        console.log('Conexión exitosa a la base de datos MySQL')
        connection.release() // No olvides liberar la conexión
    })
    .catch(err => {
        console.error('Error al conectar a la base de datos:', err)
    });

app.listen(process.env.PORT, "0.0.0.0",  () => {
    console.log(`Servidor iniciado en el puerto ${process.env.PORT}`)
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

app.post("/usuarios", async (req, res) => {
    const { nombre, apellido, email } = req.body;
    // Asegúrate de que los nombres de las columnas sean estáticos y correctos según tu esquema de DB
    const consulta = `INSERT INTO usuarios (nombre, apellido, email) VALUES (?, ?, ?)`;
    try {
        const resultado = await pool.query(consulta, [nombre, apellido, email]);
        res.json(resultado);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});