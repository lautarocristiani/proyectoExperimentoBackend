import { createPool } from "mysql2/promise"

export const pool = await createPool({
    host: process.env.DB_HOST || "localhost", 
    user: process.env.DB_USER || "root",  
    password: process.env.DB_PASSWORD || "", 
    database: process.env.DB_NAME || "proyecto1",
    port: process.env.DB_PORT || 3306
})
