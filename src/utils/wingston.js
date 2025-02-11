import winston from "winston";
import path from "path";
import dayjs from "dayjs"; // Lightweight alternative to moment

// Function to create a logger instance based on environment and date
const createLogger = (env) => {
  const currentDate = dayjs().format("YYYY-MM-DD"); // Format date as YYYY-MM-DD
  const logFileName = `copytochild-${env}-${currentDate}.log`; // Log file includes date
  const logFilePath = path.join(__dirname, "../../logs", logFileName);

  return winston.createLogger({
    level: "info",
    format: winston.format.combine(
      winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
      winston.format.printf(({ timestamp, level, message, topic, data }) => {
        return JSON.stringify({
          timestamp,
          level,
          topic,
          message,
          data,
        });
      })
    ),
    transports: [
      new winston.transports.File({
        filename: logFilePath,
        maxsize: 5242880, // 5MB max size
        maxFiles: 5, // Keep 5 rotated files
      }),
    ],
  });
};

// Function to log your data
export const logData = (level, topic, data, env, message = "") => {
  const logger = createLogger(env); // Create logger dynamically based on env and date
  logger.log({
    level,
    topic,
    data,
    message,
  });
};
