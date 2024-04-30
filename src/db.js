import { createConnection } from "mysql2/promise"

export const pool = await createConnection({
    host: process.env.DB_HOST, 
    user: process.env.DB_USER,  
    password: process.env.DB_PASSWORD, 
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
})
