import "dotenv/config.js";
import dns from "dns";
import app from "../src/app.js";

dns.setDefaultResultOrder("ipv4first");

export default app;
