import express from 'express';
import cors from 'cors';
import { pool } from './db.js';
import axios from 'axios';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import CryptoJS from 'crypto-js';

dotenv.config();
const app = express();

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
app.use(express.json());

const secretKey = process.env.JWT_SECRET || 'mysecretkey';

pool.getConnection()
  .then(async connection => {
    console.log('Conexión exitosa a la base de datos MySQL');
    connection.release();
  })
  .catch(err => {
    console.error('Error al conectar a la base de datos:', err);
  });

app.listen(process.env.PORT || 4000, '0.0.0.0', () => {
  console.log(`Servidor iniciado en el puerto ${process.env.PORT || 4000}`);
});

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.get('/usuarios', async (req, res) => {
  const consulta = 'SELECT * FROM `usuarios`';
  const resultado = await pool.query(consulta);
  res.json(resultado[0]);
});

app.post('/usuarios', async (req, res) => {
  const { nombre, apellido, email } = req.body;
  const consultaInsertar = 'INSERT INTO usuarios (nombre, apellido, email) VALUES (?, ?, ?)';
  const consultaID = 'SELECT LAST_INSERT_ID() as id';

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

app.delete('/usuarios/:id', async (req, res) => {
  const { id } = req.params;
  const consulta = 'DELETE FROM usuarios WHERE id = ?';
  try {
    const [resultado] = await pool.query(consulta, [id]);
    console.log(resultado);
    if (resultado.affectedRows > 0) {
      res.status(200).json({ message: 'Usuario eliminado correctamente' });
    } else {
      res.status(404).json({ message: 'Usuario no encontrado' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/usuarios/:id', async (req, res) => {
  const { id } = req.params;
  const { nombre, apellido, email } = req.body;
  const consulta = 'UPDATE usuarios SET nombre = ?, apellido = ?, email = ? WHERE id = ?';

  try {
    const resultado = await pool.query(consulta, [nombre, apellido, email, id]);
    if (resultado.affectedRows > 0) {
      res.status(200).json({ message: 'Usuario actualizado correctamente' });
    } else {
      res.status(404).json({ message: 'Usuario no encontrado' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

let globalToken = null;

const fetchToken = async () => {
  const urlToken = 'https://api.remarkets.primary.com.ar/auth/getToken';
  const headers = {
    'X-Username': process.env.XU || process.env['X-Username'],
    'X-Password': process.env.XP || process.env['X-Password']
  };
  console.log(headers);
  try {
    const responseToken = await axios.post(urlToken, {}, { headers });
    globalToken = responseToken.headers['x-auth-token'];
    console.log('Token actualizado:', globalToken);
  } catch (error) {
    console.error('Error al obtener el token:', error);
  }
};

fetchToken();

app.get('/getInstrumentDetails', async (req, res) => {
  const url = 'https://api.remarkets.primary.com.ar/rest/instruments/details';
  const headers = { 'X-Auth-Token': globalToken };
  try {
    const instrumentResponse = await axios.get(url, { headers });
    const instrumentDetails = instrumentResponse.data;
    res.status(200).json(instrumentDetails);
  } catch (error) {
    console.error('Error fetching Instrument Details:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/getTrades', async (req, res) => {
  const { symbol, date, dateTo, intervalo } = req.query;
  const url = `https://api.remarkets.primary.com.ar/rest/data/getTrades?marketId=ROFX&symbol=${symbol}&date=${date}&dateTo=${dateTo}&environment=REMARKETS`;
  const headers = { 'X-Auth-Token': globalToken };

  try {
    const tradesResponse = await axios.get(url, { headers });
    const tradesData = tradesResponse.data.trades;
    const groupedTrades = processTrades(tradesData, intervalo);
    res.status(200).json(groupedTrades);
  } catch (error) {
    console.error('Error fetching trades:', error);
    res.status(500).json({ error: error.message });
  }
});

function processTrades(trades, interval) {
  const groupedTrades = {};
  trades.forEach(trade => {
    const time = new Date(trade.datetime).getTime();
    const roundedTime = Math.floor(time / interval) * interval;

    if (!groupedTrades[roundedTime]) {
      groupedTrades[roundedTime] = {
        open: trade.price,
        high: trade.price,
        low: trade.price,
        close: trade.price,
        date: new Date(roundedTime).getTime()
      };
    } else {
      groupedTrades[roundedTime].high = Math.max(groupedTrades[roundedTime].high, trade.price);
      groupedTrades[roundedTime].low = Math.min(groupedTrades[roundedTime].low, trade.price);
      groupedTrades[roundedTime].close = trade.price;
    }
  });
  return Object.values(groupedTrades);
}

app.get('/getTodayTrades', async (req, res) => {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
  const { symbol } = req.query;
  const url = `https://api.remarkets.primary.com.ar/rest/data/getTrades?marketId=ROFX&symbol=${symbol}&date=${today}&environment=REMARKETS`;
  const headers = { 'X-Auth-Token': globalToken };
  try {
    const tradesResponse = await axios.get(url, { headers });
    const todayTrades = tradesResponse.data;
    res.status(200).json(todayTrades);
  } catch (error) {
    console.error('Error fetching trades:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/getMarketData', async (req, res) => {
  const { symbol, entries, depth } = req.query;
  const url = `https://api.remarkets.primary.com.ar/rest/marketdata/get?marketId=ROFX&symbol=${symbol}&entries=${entries}&depth=${depth}`;
  const headers = { 'X-Auth-Token': globalToken };
  try {
    const marketResponse = await axios.get(url, { headers });
    const marketData = marketResponse.data;
    res.status(200).json(marketData);
  } catch (error) {
    console.error('Error fetching Market data:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/signup', async (req, res) => {
  const { nombre, apellido, email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  const consultaInsertar = 'INSERT INTO usuarios (nombre, apellido, email, password) VALUES (?, ?, ?, ?)';

  try {
    await pool.query(consultaInsertar, [nombre, apellido, email, hashedPassword]);
    res.status(201).json({ message: 'Usuario registrado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const consulta = 'SELECT * FROM usuarios WHERE email = ?';

  try {
    const [result] = await pool.query(consulta, [email]);
    const user = result[0];

    if (user) {
      // Desencriptar la contraseña
      const bytes = CryptoJS.AES.decrypt(password, 'your-secret-key');
      const originalPassword = bytes.toString(CryptoJS.enc.Utf8);

      if (await bcrypt.compare(originalPassword, user.password)) {
        const token = jwt.sign({ userId: user.id }, secretKey, { expiresIn: '1h' });
        res.status(200).json({
          token,
          nombre: user.nombre,
          apellido: user.apellido
        });
      } else {
        res.status(401).json({ message: 'Credenciales incorrectas' });
      }
    } else {
      res.status(401).json({ message: 'Credenciales incorrectas' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/protected', (req, res) => {
  const token = req.headers['authorization'];

  if (!token) {
    return res.status(401).json({ message: 'Token no proporcionado' });
  }

  try {
    const decoded = jwt.verify(token, secretKey);
    req.user = decoded;
    res.status(200).json({ message: 'Acceso autorizado' });
  } catch (error) {
    res.status(401).json({ message: 'Token inválido' });
  }
});