import { GetResponse } from "../../../utils/node-fetch";
import { produce as logger } from "../../../utils/kafka";
import customFieldIdMeta from "../utils/customFieldsIds";
import { Offshore } from "./offshore";
import { OffshoreCopynew } from "./offshore-copynew";

const WrikeEndpoint = process.env.WRIKE_ENDPOINT;
const WrikeToken = process.env.WRIKE_TOKEN;
const CustomFieldIds = customFieldIdMeta[process.env.NODE_ENV?.toLowerCase()];

export const OffshoreAutomation = (params, startedAt, fastify) => {
  return new Promise(async (resolve, reject) => {
    try {
      if (!WrikeToken) {
        return reject({ message: "Invalid auth token!" });
      }

      const { spaceId } = params;

      const statuses = ["Overwrite", "In Progress", "CopyNew"];

      for (const status of statuses) {
        const folderData = await getFoldersBySpace(startedAt, spaceId, status);

        console.log(`Total '${status}' folders: ${folderData?.data?.length}`);
        for (let i = 0; i < folderData?.data.length; i++) {
          console.log(`Folder ${i + 1} started at ${new Date()}`);

          const folderId = folderData?.data[i]["id"];

          if (status == "Overwrite")
            await Offshore(
              {
                folderId,
              },
              null,
              fastify
            );
          else if (status == "CopyNew")
            await OffshoreCopynew(
              {
                folderId,
              },
              null,
              fastify
            );

          logIt({
            startedAt,
            status: "Info",
            message: "",
            step: "Completed offshore process",
            folderId,
          });
        }
      }

      // Sending final response
      resolve({
        message: "Offshore Automation process has been created successfully",
        data: {},
      });
    } catch (err) {
      console.log(err?.message || err);

      logIt({
        startedAt,
        status: "Error",
        message: err?.message,
        step: "Automation Error",
      });

      reject(err);
    }
  });
};

const getFoldersBySpace = (startedAt, spaceId, status) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Get folder data
      const folderOutput = await GetResponse(
        `${WrikeEndpoint}/spaces/${spaceId}/folders?customFields=[{ id:'${CustomFieldIds["CopyToChild*"]}', comparator:'EqualTo', value:'${status}' }]&descendants=true&project=false`,
        "GET",
        {
          "content-type": "application/json",
          Authorization: `Bearer ${WrikeToken}`,
        }
      );

      // Sending folder update error response
      if (folderOutput?.errorDescription) {
        logIt({
          startedAt,
          status: "Error",
          message: folderOutput?.errorDescription,
          step: "Get Folder",
          spaceId,
        });

        return reject(folderOutput);
      }

      resolve(folderOutput);
    } catch (error) {
      reject(error);
    }
  });
};

const logIt = ({ status, message, step, startedAt, folderId, spaceId }) => {
  const endedAt = new Date();
  // Calculate response time in milliseconds
  const responseTimeMs = endedAt - startedAt;

  // Convert milliseconds to total seconds
  const responseTimeInSeconds = responseTimeMs / 1000;

  // Convert total seconds to HH:mm:ss format
  const responseTime = new Date(responseTimeMs).toISOString().substr(11, 8);

  logger(`c2c-backlogs-${process.env.NODE_ENV.toLowerCase()}`, {
    status,
    message,
    step,
    startedAt,
    environment: process.env.NODE_ENV,
    c2cType: "Onshore",
    c2cExecution: "Overwrite",
    isAutomation: true,
    endedAt,
    responseTime,
    responseTimeInSeconds,
    folderId,
    spaceId,
  });
};
