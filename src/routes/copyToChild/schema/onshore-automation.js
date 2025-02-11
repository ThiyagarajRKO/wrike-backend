export const OnshoreAutomationSchema = {
  schema: {
    body: {
      type: "object",
      required: ["spaceId"],
      properties: {
        spaceId: { type: "string" },
        statuses: { type: "array" },
      },
    },
  },
};
