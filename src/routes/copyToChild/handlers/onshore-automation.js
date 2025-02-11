import { GetResponse } from "../../../utils/node-fetch";
import { produce as logger } from "../../../utils/kafka";
import customFieldIdMeta from "../utils/customFieldsIds";
import { Onshore } from "./onshore";
import { OnshoreCopynew } from "./onshore-copynew";

const WrikeEndpoint = process.env.WRIKE_ENDPOINT;
const WrikeToken = process.env.WRIKE_TOKEN;
const CustomFieldIds = customFieldIdMeta[process.env.NODE_ENV?.toLowerCase()];

export const OnshoreAutomation = (params, startedAt, fastify) => {
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
        for (const data of folderData?.data) {
          console.log(`Folder ${data?.id} started at ${new Date()}`);

          if (status == "Overwrite")
            await Onshore(
              {
                folderId: data?.id,
              },
              startedAt,
              fastify
            ).catch(console.log);
          else if (status == "CopyNew")
            await OnshoreCopynew(
              {
                folderId: data?.id,
              },
              startedAt,
              fastify
            ).catch(console.log);

          logIt({
            startedAt,
            status: "Info",
            message: "",
            step: `Completed ${status} process`,
            folderId: data?.id,
          });
        }
      }

      // Sending final response
      resolve({
        message: "Onshore Automation process has been created successfully",
        data: {},
      });
    } catch (err) {
      console.log(err?.message || err);

      reject(err);
    }
  });
};

const getFoldersBySpace = (startedAt, spaceId, status) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Get folder data
      const folderOutput = await GetResponse(
        `${WrikeEndpoint}/spaces/${spaceId}/folders?customFields=[{ id:'${CustomFieldIds["CopyToChild*"]}', comparator:'EqualTo', value:'${status}' }]&descendants=true&project=true`,
        "GET",
        {
          "content-type": "application/json",
          Authorization: `Bearer ${WrikeToken}`,
        }
      );

      if (folderOutput?.errorDescription) {
        // Sending folder update error response
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
