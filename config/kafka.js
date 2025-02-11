require("dotenv").config();

module.exports = {
  GROUP_ID: process.env.GROUP_ID,
  CLIENT_ID: process.env.CLIENT_ID,
  BROKERS: process.env.BROKERS?.split(","),
};
