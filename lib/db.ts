import { MongoClient } from "mongodb";

let client;

export async function getDb() {
  if (!client) {
      client = new MongoClient(process.env.MONGO_URL!);
          await client.connect();
            }
              return client.db(process.env.DB_NAME);
              }