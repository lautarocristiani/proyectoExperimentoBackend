import express from "express"
import cors from "cors"
import { pool } from "./db.js"
import requi from 'axios';

const app = express()

// Habilitamos CORS

const corsOptions = {
    origin: function (origin, callback) {
      const allowedOrigins = ['https://expfrontend.vercel.app', 'http://localhost:3000'];
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    optionsSuccessStatus: 200
  };
  
  app.use(cors(corsOptions));
  

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
    const consultaInsertar = `INSERT INTO usuarios (nombre, apellido, email) VALUES (?, ?, ?)`;
    const consultaID = `SELECT LAST_INSERT_ID() as id`;

    try {
        await pool.query('START TRANSACTION');
        await pool.query(consultaInsertar, [nombre, apellido, email]);
        const resultadoID = await pool.query(consultaID);
        await pool.query('COMMIT');
        res.json({ id: resultadoID[0].id, nombre, apellido, email });
    } catch (error) {
        await pool.query('ROLLBACK');
        res.status(500).json({ error: error.message });
    }
});


app.delete("/usuarios/:id", async (req, res) => {
    const { id } = req.params;
    const consulta = `DELETE FROM usuarios WHERE id = ?`;
    try {
        const [resultado] = await pool.query(consulta, [id]);
        console.log(resultado);
        if (resultado.affectedRows  > 0) {
            res.status(200).json({ message: "Usuario eliminado correctamente" });
            alert("Usuario eliminado correctamente");
        } else {
            res.status(404).json({ message: "Usuario no encontrado" });
            alert("Usuario no encontrado");
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
        alert("Error al eliminar usuario");
    }
});

app.put("/usuarios/:id", async (req, res) => {
    const { id } = req.params;
    const { nombre, apellido, email } = req.body;
    const consulta = `UPDATE usuarios SET nombre = ?, apellido = ?, email = ? WHERE id = ?`;

    try {
        const resultado = await pool.query(consulta, [nombre, apellido, email, id]);
        if (resultado.affectedRows > 0) {
            res.status(200).json({ message: "Usuario actualizado correctamente" });
        } else {
            res.status(404).json({ message: "Usuario no encontrado" });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get("/instrumentos", async (req, res) => {
    const urlToken = 'https://api.remarkets.primary.com.ar/auth/getToken';
    const credentials = {
      username: 'lautarocristiani200110465',
      password: 'uxvinI9('
    };
    const config = {
      headers: {
        'Content-Type': 'application/json'
      }
    };

    try {
        // Obtener el token
        const responseToken = await axios.post(urlToken, credentials, config);
        const token = responseToken.headers['x-auth-token']; // Asegúrate de acceder correctamente al token en la respuesta
        console.log('Token:', token);
        console.log(responseToken);
        // Configuración para usar el token en futuras solicitudes
        const apiConfig = {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        };

        // Realizar otras solicitudes con el token
        // Ejemplo: Obtener todos los instrumentos
        const urlInstrumentos = 'https://api.remarkets.primary.com.ar/api/instrumentos';
        const respuestaInstrumentos = await axios.get(urlInstrumentos, apiConfig);
        console.log('Instrumentos:', respuestaInstrumentos.data);
        // Asumiendo que necesitas más datos, puedes seguir haciendo más solicitudes aquí
        // ...

        // Finalmente, enviar todos los datos necesarios al cliente
        res.json({
          token,
          instrumentos: respuestaInstrumentos.data
        });

    } catch (error) {
        console.error('Error al obtener el token:', error);
        res.status(500).json({ error: 'Error al obtener el token' });
    }
});