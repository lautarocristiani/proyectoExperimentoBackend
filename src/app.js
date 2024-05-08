import express from "express"
import cors from "cors"
import { pool } from "./db.js"
import axios from 'axios'; 
import dotenv from 'dotenv';

dotenv.config();
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

app.listen(process.env.PORT || 4000, "0.0.0.0",  () => {
    console.log(`Servidor iniciado en el puerto ${process.env.PORT || 4000}`)
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


// Variable global para almacenar el token
let globalToken = null;

// Función para obtener el token
const fetchToken = async () => {
    const urlToken = 'https://api.remarkets.primary.com.ar/auth/getToken';
    const headers = {
        'X-Username': process.env['X-Username'],
        'X-Password': process.env['X-Password']
    };
    try {
        const responseToken = await axios.post(urlToken, {}, { headers });
        globalToken = responseToken.headers['x-auth-token'];
        console.log("Token actualizado:", globalToken);
    } catch (error) {
        console.error("Error al obtener el token:", error);
    }
};

// Obtener el token
fetchToken();

// Función para realizar solicitudes API con manejo de token expirado
const makeApiRequest = async (url, headers, res) => {
    try {
        const response = await axios.get(url, { headers });
        return res.status(200).json(response.data);
    } catch (error) {
        if (error.response && error.response.status === 401) { // Error de autenticación
            console.log("Token expirado, obteniendo un nuevo token...");
            await fetchToken(); // Obtener un nuevo token
            if (globalToken) {
                headers['X-Auth-Token'] = globalToken; // Actualizar el token en los headers
                try {
                    const retryResponse = await axios.get(url, { headers });
                    return res.status(200).json(retryResponse.data);
                } catch (retryError) {
                    console.error("Error después de reintento:", retryError);
                    return res.status(500).json({ error: retryError.message });
                }
            } else {
                return res.status(500).json({ error: 'No se pudo obtener un nuevo token.' });
            }
        } else {
            console.error("Error en la solicitud API:", error);
            return res.status(500).json({ error: error.message });
        }
    }
};

// Ruta que usa la función de manejo de solicitudes
app.get("/getInstrumentDetails", async (req, res) => {

    if (!globalToken) {
        return res.status(403).json({ error: "Token no disponible. Obtenga un token primero." });
    }

    const urlDetails = 'https://api.remarkets.primary.com.ar/rest/instruments/details';
    const headers = {
        'X-Auth-Token': globalToken
    };
    
    makeApiRequest(urlDetails, headers, res);
});

app.get("/getTrades", async (req, res) => {
    const { symbol, date, dateFrom, dateTo } = req.query;
    try {
        const url = `https://api.remarkets.primary.com.ar/rest/data/getTrades`;
        const headers = {
            'X-Auth-Token': globalToken,
            'marketId': 'ROFX',
            'symbol': symbol,
            'date': date,
            'dateFrom': dateFrom,
            'dateTo': dateTo
        };
        const response = await axios.get(url, { headers });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get("/getMarketData", async (req, res) => {
    const { symbol } = req.query;
    try {
        const url = `https://api.remarkets.primary.com.ar/rest/marketdata/get`;
        const params = {
            'marketId': 'ROFX',
            'symbol': symbol,
            'entries': 'BI,OF,LA,OP,CL,SE,OI',
            'depth': 1
        };
        const headers = {
            'X-Auth-Token': globalToken
        };
        const response = await axios.get(url, { headers, params });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});