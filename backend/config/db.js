import oracledb from "oracledb";
import dotenv from "dotenv";
dotenv.config({});

const {
  ORACLE_CLIENT_LIB_DIR,
  DB_USER,
  DB_PASS,
  DB_CONNECT_STRING,
  DB_POOL_MIN = 1,
  DB_POOL_MAX = 10,
  DB_POOL_INCREMENT = 1,
} = process.env;

console.log("USER =", process.env.DB_USER);
console.log("PASS =", process.env.DB_PASS);
console.log("CONNECT =", process.env.DB_CONNECT_STRING);

if (ORACLE_CLIENT_LIB_DIR)
  try {
    oracledb.initOracleClient({ libDir: ORACLE_CLIENT_LIB_DIR });
  } catch {}
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
const poolConfig = {
  user: DB_USER ?? process.env.ORACLE_USER ?? "app_user",
  password: DB_PASS ?? process.env.ORACLE_PASSWORD ?? "password",
  connectString:
    DB_CONNECT_STRING ??
    process.env.ORACLE_CONNECT_STRING ??
    "localhost/XEPDB1",
  poolMin: Number(DB_POOL_MIN),
  poolMax: Number(DB_POOL_MAX),
  poolIncrement: Number(DB_POOL_INCREMENT),
};
const poolPromise = oracledb.createPool(poolConfig);
const convertQuestionBinds = (sql, bindsArray = []) => {
  let idx = 0;
  const bindObj = {};
  const newSql = sql.replace(/\?/g, () => {
    idx += 1;
    const key = `b${idx}`;
    bindObj[key] = bindsArray[idx - 1];
    return `:${key}`;
  });
  return { sql: newSql, binds: bindObj };
};
const getConnection = async () => {
  const pool = await poolPromise;
  return pool.getConnection();
};
const query = async (sql, binds = {}, opts = {}) => {
  const conn = await getConnection();
  try {
    let useSql = sql;
    let useBinds = binds;
    if (Array.isArray(binds)) {
      const converted = convertQuestionBinds(sql, binds);
      useSql = converted.sql;
      useBinds = converted.binds;
    }
    const execOpts = {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      autoCommit: Boolean(opts.autoCommit),
      fetchArraySize: opts.fetchArraySize || 100,
      ...opts,
    };
    const result = await conn.execute(useSql, useBinds, execOpts);
    return [result.rows || [], result.metaData || null];
  } finally {
    try {
      await conn.close();
    } catch {}
  }
};
const execute = async (sql, binds = {}, opts = {}) => {
  const conn = await getConnection();
  try {
    let useSql = sql;
    let useBinds = binds;
    if (Array.isArray(binds)) {
      const converted = convertQuestionBinds(sql, binds);
      useSql = converted.sql;
      useBinds = converted.binds;
    }
    const execOpts = {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      autoCommit: Boolean(opts.autoCommit),
      ...opts,
    };
    const result = await conn.execute(useSql, useBinds, execOpts);
    return result;
  } finally {
    try {
      await conn.close();
    } catch {}
  }
};
const closePool = async (timeout = 10) => {
  try {
    const pool = await poolPromise;
    await pool.close(timeout);
  } catch {}
};
export { oracledb, query, execute, closePool, poolPromise };
