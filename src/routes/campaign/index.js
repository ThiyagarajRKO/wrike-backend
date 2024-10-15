import { CreateCampaign } from "./handlers/create_campaign";

// Schema
import { CreateCampaignSchema } from "./schema/create_campaign";

export const campaignRoute = (fastify, opts, done) => {
  fastify.post("/", CreateCampaignSchema, async (req, reply) => {
    try {
      const result = await CreateCampaign(req?.token, req.body, fastify);

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

export default campaignRoute;
