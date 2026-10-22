import postgres from 'postgres';
let client;
export function db() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL chưa được cấu hình');
  if (!client) client = postgres(process.env.DATABASE_URL, {
    max: 1, prepare: false, ssl: 'require', idle_timeout: 20, connect_timeout: 10
  });
  return client;
}
