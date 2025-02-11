export const OnshoreCopynewSchema = {
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
