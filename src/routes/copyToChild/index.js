import { Offshore } from "./handlers/offshore";
import { Onshore } from "./handlers/onshore";
import { OffshoreAutomation } from "./handlers/offshore-automation";
import { OnshoreAutomation } from "./handlers/onshore-automation";
import { OnshoreCopynew } from "./handlers/onshore-copynew";
import { OffshoreCopynew } from "./handlers/offshore-copynew";

// Schema
import { OffshoreSchema } from "./schema/offshore";
import { OnshoreSchema } from "./schema/onshore";
import { OffshoreAutomationSchema } from "./schema/offshore-automation";
import { OnshoreAutomationSchema } from "./schema/onshore-automation";
import { OnshoreCopynewSchema } from "./schema/onshore-copynew";
import { OffshoreCopynewSchema } from "./schema/offshore-copynew";

export const copyToChildRoute = (fastify, opts, done) => {
  fastify.post("/offshore/overwrite", OffshoreSchema, async (req, reply) => {
    try {
      const startedAt = new Date();

      const result = await Offshore(req.body, startedAt, fastify);

      reply.code(result.statusCode || 200).send({
        success: true,
        message: result.message,
        data: result?.data,
      });
    } catch (err) {
      reply.code(err?.statusCode || 400).send({
        success: false,
        message: err?.message || err,
      });
    }
  });

  fastify.post(
    "/offshore/copynew",
    OffshoreCopynewSchema,
    async (req, reply) => {
      try {
        const startedAt = new Date();

        const result = await OffshoreCopynew(req.body, startedAt, fastify);

        reply.code(result.statusCode || 200).send({
          success: true,
          message: result.message,
          data: result?.data,
        });
      } catch (err) {
        reply.code(err?.statusCode || 400).send({
          success: false,
          message: err?.message || err,
        });
      }
    }
  );

  fastify.post("/onshore/overwrite", OnshoreSchema, async (req, reply) => {
    try {
      const startedAt = new Date();

      const result = await Onshore(req.body, startedAt, fastify);

      reply.code(result.statusCode || 200).send({
        success: true,
        message: result.message,
        data: result?.data,
      });
    } catch (err) {
      reply.code(err?.statusCode || 400).send({
        success: false,
        message: err?.message || err,
      });
    }
  });

  fastify.post("/onshore/copynew", OnshoreCopynewSchema, async (req, reply) => {
    try {
      const startedAt = new Date();

      const result = await OnshoreCopynew(req.body, startedAt, fastify);

      reply.code(result.statusCode || 200).send({
        success: true,
        message: result.message,
        data: result?.data,
      });
    } catch (err) {
      reply.code(err?.statusCode || 400).send({
        success: false,
        message: err?.message || err,
      });
    }
  });

  fastify.post(
    "/offshore/auto",
    OffshoreAutomationSchema,
    async (req, reply) => {
      try {
        const startedAt = new Date();

        const result = await OffshoreAutomation(req.body, startedAt, fastify);

        reply.code(result.statusCode || 200).send({
          success: true,
          message: result.message,
          data: result?.data,
        });
      } catch (err) {
        reply.code(err?.statusCode || 400).send({
          success: false,
          message: err?.message || err,
        });
      }
    }
  );

  fastify.post("/onshore/auto", OnshoreAutomationSchema, async (req, reply) => {
    try {
      const startedAt = new Date();

      const result = await OnshoreAutomation(req.body, startedAt, fastify);

      reply.code(result.statusCode || 200).send({
        success: true,
        message: result.message,
        data: result?.data,
      });
    } catch (err) {
      reply.code(err?.statusCode || 400).send({
        success: false,
        message: err?.message || err,
      });
    }
  });

  done();
};

export default copyToChildRoute;
