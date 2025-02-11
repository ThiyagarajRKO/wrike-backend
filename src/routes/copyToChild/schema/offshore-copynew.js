export const OffshoreCopynewSchema = {
  schema: {
    body: {
      type: "object",
      required: ["folderId"],
      properties: {
        folderId: { type: "string" },
      },
    },
  },
};
