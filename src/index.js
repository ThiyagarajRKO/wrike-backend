"use strict";

// Importing Modules to Start Server
import AutoLoad from "@fastify/autoload";
import path from "path";
import Fastify from "fastify";
import dotenv from "dotenv";

dotenv.config();

// Importing Routes
import { PrivateRouters, PublicRouters, ExternalRouters } from "./routes";

// Configure the framework and instantiate it
const fastify = Fastify({
  logger: true,
});

// app.use(express.static("public"));
// app.set("view engine", "ejs");

// This loads all plugins defined in plugins those should be support plugins that are reused through your application
fastify.register(AutoLoad, {
  dir: path.join(process.cwd(), "/src/plugins"),
});

// fastify.get("/", (req, res) => {
//   res.code(200).send({ message: "Server is running..." });
// });

//routes
fastify.register(PublicRouters, { prefix: "/api/v1" });
fastify.register(PrivateRouters, { prefix: "/api/v1" });
fastify.register(ExternalRouters, { prefix: "/api/v2" });

// Run the server!
fastify.listen(
  { port: process.env.PORT, host: "0.0.0.0" },
  function (err, address) {
    if (err) {
      fastify.log.error(err);
    }
    fastify.log.info(`Server listening on ${address}`);
  }
);

// Hooks

fastify.addHook("onError", async (request, reply, error) => {
  console.log(new Date() + " : " + error?.message || error);
  reply.code(500).send({ success: false, message: error?.message || error });
});

fastify.addHook("onSend", function (request, reply, payload, done) {
  try {
    if (!reply.sent && payload) {
      done(null, payload);
    }
  } catch (err) {
    console.error(new Date().toISOString() + " : " + err?.message || err);
  }
});

// View Handlers
fastify.get("/", (req, res) => {
  res.view("index.ejs");
});

fastify.get("/AdminMain", function (req, res) {
  res.view("AdminMain.ejs", {
    full_name: req?.session?.full_name,
    role_name: req?.session?.role_name,
  });
});

fastify.get("/Dashboard", function (req, res) {
  res.view("Dashboard.ejs");
});

fastify.get("/LogReport", function (req, res) {
  res.view("LogReport.ejs");
});
