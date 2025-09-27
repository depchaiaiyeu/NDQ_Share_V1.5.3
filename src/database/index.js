import pg from "pg";
import chalk from "chalk";
import fs from "fs/promises";
import path from "path";
import { claimDailyReward, getMyCard } from "./player.js";
import { getTopPlayers } from "./jdbc.js";

export * from "./player.js";
export * from "./jdbc.js";

const { Pool } = pg;

let nameServer = "Kiên Đẹp Chai";
let pool;
let connection;
let NAME_TABLE_PLAYERS;
let NAME_TABLE_ACCOUNT;
let DAILY_REWARD;

async function loadConfig() {
  const configPath = path.join(
    process.cwd(),
    "assets",
    "json-data",
    "database-config.json"
  );
  const configFile = await fs.readFile(configPath, "utf8");
  return JSON.parse(configFile);
}

function convertMySQLToPostgreSQL(query, params = []) {
  let pgQuery = query;
  let paramIndex = 1;
  
  pgQuery = pgQuery.replace(/\?/g, () => `$${paramIndex++}`);
  pgQuery = pgQuery.replace(/NOW\(\)/g, 'CURRENT_TIMESTAMP');
  pgQuery = pgQuery.replace(/NULLIF\(([^,]+),\s*([^)]+)\)/g, 'NULLIF($1, $2)');
  
  return { query: pgQuery, params };
}

export async function initializeDatabase() {
  try {
    const config = await loadConfig();

    nameServer = config.nameServer;
    NAME_TABLE_PLAYERS = config.tablePlayerZalo;
    NAME_TABLE_ACCOUNT = config.tableAccount;
    DAILY_REWARD = config.dailyReward;

    pool = new Pool({
      connectionString: 'postgresql://neondb_owner:npg_CoHIK83qRkxi@ep-spring-fire-a11a460d-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
      ssl: { rejectUnauthorized: false }
    });

    connection = {
      async execute(query, params = []) {
        const converted = convertMySQLToPostgreSQL(query, params);
        const result = await pool.query(converted.query, converted.params);
        
        return [result.rows, {
          affectedRows: result.rowCount,
          insertId: result.insertId
        }];
      },
      async query(query, params = []) {
        const converted = convertMySQLToPostgreSQL(query, params);
        return pool.query(converted.query, converted.params);
      },
      async end() {
        return pool.end();
      }
    };

    const client = await pool.connect();
    client.release();

    const [tablesAccount] = await connection.execute(
      `SELECT table_name FROM information_schema.tables WHERE table_name = ?`, [NAME_TABLE_ACCOUNT]
    );
    if (tablesAccount.length === 0) {
      await connection.execute(`
            CREATE TABLE IF NOT EXISTS ${NAME_TABLE_ACCOUNT} (
                id SERIAL PRIMARY KEY,
                username VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                is_admin BOOLEAN DEFAULT false,
                vnd BIGINT DEFAULT 0
            )
            `);
      console.log(`✓ Đã kiểm tra/tạo bảng ${NAME_TABLE_ACCOUNT}`);
    }

    const [tables] = await connection.execute(
      `SELECT table_name FROM information_schema.tables WHERE table_name = ?`, [NAME_TABLE_PLAYERS]
    );

    if (tables.length === 0) {
      await connection.execute(`
                CREATE TABLE ${NAME_TABLE_PLAYERS} (
                    id SERIAL PRIMARY KEY,
                    username VARCHAR(255) NOT NULL,
                    idUserZalo VARCHAR(255) DEFAULT '-1',
                    playerName VARCHAR(255) NOT NULL,
                    balance BIGINT DEFAULT 10000,
                    registrationTime TIMESTAMP,
                    totalWinnings BIGINT DEFAULT 0,
                    totalLosses BIGINT DEFAULT 0,
                    netProfit BIGINT DEFAULT 0,
                    totalWinGames BIGINT DEFAULT 0,
                    totalGames BIGINT DEFAULT 0,
                    winRate DECIMAL(5, 2) DEFAULT 0,
                    lastDailyReward TIMESTAMP,
                    isBanned BOOLEAN DEFAULT FALSE,
                    UNIQUE (username)
                )
            `);
      console.log(`✓ Đã tạo bảng ${NAME_TABLE_PLAYERS}`);
    } else {
      const [columns] = await connection.execute(
        `SELECT column_name FROM information_schema.columns WHERE table_name = ?`, [NAME_TABLE_PLAYERS]
      );
      const existingColumns = columns.map((col) => col.column_name);

      const requiredColumns = [
        {
          name: "username",
          query: "ADD COLUMN username VARCHAR(255) NOT NULL DEFAULT ''",
        },
        {
          name: "idUserZalo",
          query: "ADD COLUMN idUserZalo VARCHAR(255) DEFAULT '-1'",
        },
        {
          name: "playerName",
          query: "ADD COLUMN playerName VARCHAR(255) NOT NULL DEFAULT ''",
        },
        {
          name: "balance",
          query: "ADD COLUMN balance BIGINT DEFAULT 10000",
        },
        {
          name: "registrationTime",
          query: "ADD COLUMN registrationTime TIMESTAMP",
        },
        {
          name: "totalWinnings",
          query: "ADD COLUMN totalWinnings BIGINT DEFAULT 0",
        },
        {
          name: "totalLosses",
          query: "ADD COLUMN totalLosses BIGINT DEFAULT 0",
        },
        {
          name: "netProfit",
          query: "ADD COLUMN netProfit BIGINT DEFAULT 0",
        },
        {
          name: "totalWinGames",
          query: "ADD COLUMN totalWinGames BIGINT DEFAULT 0",
        },
        {
          name: "totalGames",
          query: "ADD COLUMN totalGames BIGINT DEFAULT 0",
        },
        {
          name: "winRate",
          query: "ADD COLUMN winRate DECIMAL(5, 2) DEFAULT 0",
        },
        {
          name: "lastDailyReward",
          query: "ADD COLUMN lastDailyReward TIMESTAMP",
        },
        {
          name: "isBanned",
          query: "ADD COLUMN isBanned BOOLEAN DEFAULT FALSE",
        },
      ];

      for (const column of requiredColumns) {
        if (!existingColumns.includes(column.name)) {
          try {
            await connection.execute(`ALTER TABLE ${NAME_TABLE_PLAYERS} ${column.query}`);
            console.log(`Đã thêm/sửa cột ${column.name} vào bảng ${NAME_TABLE_PLAYERS}`);
          } catch (error) {
            if (!error.message.includes('already exists')) {
              console.log(`Cột ${column.name} có thể đã tồn tại`);
            }
          }
        }
      }
    }

    console.log(chalk.green("✓ Khởi tạo database thành công"));
  } catch (error) {
    console.error(chalk.red("Lỗi khi khởi tạo cơ sở dữ liệu: "), error);
    console.error(chalk.red("Vui lòng kiểm tra kết nối database!"));
  }
}

export {
  connection,
  NAME_TABLE_PLAYERS,
  NAME_TABLE_ACCOUNT,
  claimDailyReward,
  getTopPlayers,
  getMyCard,
  nameServer,
  DAILY_REWARD,
};
