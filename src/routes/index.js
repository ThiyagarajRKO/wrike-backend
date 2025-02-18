"use strict";

import usersRoute from "./users";
import roleMasterRoute from "./role_master";
import campaignRoute from "./campaign";
import logRoute from "./log";

// Auth Middleware
import {
  ValidateUser,
  ValidateExternalUser,
} from "../middlewares/authentication";

//Public Routes
export const PublicRouters = (fastify, opts, done) => {
  fastify.register(usersRoute, { prefix: "/auth" });

  fastify.register(roleMasterRoute, { prefix: "/roles" });

  done();
};

//Protected Routes
export const PrivateRouters = (fastify, opts, done) => {
  // Validating session
  fastify.addHook("onRequest", ValidateUser);
  // fastify.use(ValidateUser);

  fastify.register(logRoute, { prefix: "/log" });

  done();
};

//External Routes
export const ExternalRouters = (fastify, opts, done) => {
  // Validating session
  fastify.addHook("onRequest", ValidateExternalUser);

  fastify.register(campaignRoute, { prefix: "/campaign" });

  done();
};
