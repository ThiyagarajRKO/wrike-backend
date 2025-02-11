import { GetResponse } from "../../../utils/node-fetch";
import { produce as logger } from "../../../utils/kafka";
import customFieldIdMeta from "../utils/customFieldsIds";
import moment from "moment";

const WrikeEndpoint = process.env.WRIKE_ENDPOINT;
const WrikeToken = process.env.WRIKE_TOKEN;
const CustomFieldIds = customFieldIdMeta[process.env.NODE_ENV?.toLowerCase()];

export const Offshore = (params, startedAt, fastify) => {
  return new Promise(async (resolve, reject) => {
    try {
      if (!WrikeToken) {
        return reject({ message: "Invalid auth token!" });
      }

      // Variable Declaration
      const { folderId } = params;

      let taskUpdateCustomFields = [];

      const folderData = await getFolder(startedAt, folderId);

      if (folderData?.data[0]?.project) {
        return resolve({
          message: "Offshore doesn't apply on project",
          data: {},
        });
      }

      await updateFolder(startedAt, folderId, {
        customFields: [
          { id: CustomFieldIds["CopyToChild*"], value: "In Progress" },
        ],
      });

      let offshoreGlobalHub;
      // Filtering Offshore customfield value
      await Promise.all(
        folderData?.data[0]?.customFields?.map((data) => {
          if (data["id"] != CustomFieldIds["CopyToChild*"]) {
            const index = Object.values(CustomFieldIds)?.indexOf(data["id"]);
            if (index >= 0) {
              taskUpdateCustomFields.push({
                id: data["id"],
                value: data["value"],
              });

              if (data?.id == CustomFieldIds["Offshore Global Hub*"]) {
                offshoreGlobalHub = data?.value;
              }
            }
          }
        })
      );

      if (!offshoreGlobalHub) {
        logIt({
          startedAt,
          status: "Warn",
          message: "Offshore Global Hub custom field must not be empty",
          step: "CustomField Validation",
          folderId,
        });

        updateFolder(startedAt, folderId, {
          customFields: [
            { id: CustomFieldIds["CopyToChild*"], value: "Error" },
          ],
        });

        sendComment(
          startedAt,
          folderId,
          "CopyToChild failed to run due to missing custom field <b>Offshore Global Hub</b>"
        );

        return reject({
          message: "Offshore Global Hub custom field must not be empty",
        });
      }

      taskUpdateCustomFields.push({
        id: CustomFieldIds["WrikeXPI-State"],
        value: "Completed",
      });

      await executeTaskOperation(startedAt, folderId, taskUpdateCustomFields);

      await updateFolder(startedAt, folderId, {
        customFields: [
          { id: CustomFieldIds["CopyToChild*"], value: "Completed" },
        ],
      }).catch(console.log);

      logIt({
        startedAt,
        status: "Info",
        message: "",
        step: "End",
        folderId,
      });

      // Sending final response
      resolve({
        message:
          "CopyToChild - Offshore overwrite process has been created successfully",
        data: {},
      });
    } catch (err) {
      console.log(err?.message || err);
      reject(err);
    }
  });
};

const getFolder = (startedAt, folderId) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Get folder data
      const folderOutput = await GetResponse(
        `${WrikeEndpoint}/folders/${folderId}`,
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
          folderId,
        });

        return reject(folderOutput);
      }

      resolve(folderOutput);
    } catch (error) {
      reject(error);
    }
  });
};

const updateFolder = (startedAt, folderId, folderData) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Get folder data
      const folderOutput = await GetResponse(
        `${WrikeEndpoint}/folders/${folderId}`,
        "PUT",
        {
          "content-type": "application/json",
          Authorization: `Bearer ${WrikeToken}`,
        },
        folderData
      );

      // Sending folder update error response
      if (folderOutput?.errorDescription) {
        logIt({
          startedAt,
          status: "Error",
          message: folderOutput?.errorDescription,
          step: "Update Folder",
          folderId,
        });

        return reject(folderOutput);
      }

      resolve(folderOutput);
    } catch (error) {
      reject(error);
    }
  });
};

const sendComment = (startedAt, folderId, comment) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Get folder data
      const commentOutput = await GetResponse(
        `${WrikeEndpoint}/folders/${folderId}/comments?text=${comment}`,
        "POST",
        {
          "content-type": "application/json",
          Authorization: `Bearer ${WrikeToken}`,
        }
      );

      // Sending folder update error response
      if (commentOutput?.errorDescription) {
        logIt({
          startedAt,
          status: "Error",
          message: commentOutput?.errorDescription,
          step: "Folder Comment",
          folderId,
        });

        return reject(commentOutput);
      }

      resolve(commentOutput);
    } catch (error) {
      reject(error);
    }
  });
};

const executeTaskOperation = (
  startedAt,
  folderId,
  taskUpdateCustomFields,
  taskTempToken
) => {
  return new Promise(async (resolve, reject) => {
    try {
      const tasks = await getTasks(startedAt, folderId, taskTempToken);

      const taskIds = await Promise.all(tasks?.data?.map((data) => data?.id));

      if (taskIds.length == 0 && !tasks?.nextPageToken) {
        return resolve();
      }

      await updateTask(
        startedAt,
        taskIds,
        {
          customFields: taskUpdateCustomFields,
        },
        folderId
      );

      if (tasks?.nextPageToken) {
        await executeTaskOperation(
          startedAt,
          folderId,
          taskUpdateCustomFields,
          tasks?.nextPageToken
        );

        return resolve();
      }

      resolve();
    } catch (error) {
      reject(error);
    }
  });
};

const getTasks = (startedAt, folderId, taskTempToken) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Get the current date and time in UTC
      const currentDate = moment.utc();
      // Calculate the date 4 months before
      const dateBefore4Years = currentDate.clone().subtract(4, "months");

      // Format the dates
      const formattedCurrentDate = currentDate.format("YYYY-MM-DDTHH:mm:ss[Z]");
      const formattedDateBefore4Years = dateBefore4Years.format(
        "YYYY-MM-DDTHH:mm:ss[Z]"
      );

      // Manually construct the JSON string
      const createdDate = JSON.stringify({
        start: formattedDateBefore4Years,
        end: formattedCurrentDate,
      });

      // Get folder data
      const taskOutput = await GetResponse(
        `${WrikeEndpoint}/folders/${folderId}/tasks?subTasks=true&pageSize=20&createdDate=${createdDate}&nextPageToken=${taskTempToken ?? ""}`,
        "GET",
        {
          "content-type": "application/json",
          Authorization: `Bearer ${WrikeToken}`,
        }
      );

      // Sending folder update error response
      if (taskOutput?.errorDescription) {
        logIt({
          startedAt,
          status: "Error",
          message: taskOutput?.errorDescription,
          step: "Get Tasks",
          folderId,
        });

        return reject(taskOutput);
      }

      resolve(taskOutput);
    } catch (error) {
      reject(error);
    }
  });
};

const updateTask = (startedAt, taskIds, taskData, folderId) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Get folder data
      const taskOutput = await GetResponse(
        `${WrikeEndpoint}/tasks/${taskIds}`,
        "PUT",
        {
          "content-type": "application/json",
          Authorization: `Bearer ${WrikeToken}`,
        },
        taskData
      );

      // Sending folder update error response
      if (taskOutput?.errorDescription) {
        logIt({
          startedAt,
          status: "Error",
          message: taskOutput?.errorDescription,
          step: "Update Task",
          folderId,
        });

        return reject(taskOutput);
      }

      resolve(taskOutput);
    } catch (error) {
      reject(error);
    }
  });
};

const logIt = ({ status, message, step, startedAt, folderId }) => {
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
    c2cType: "Offshore",
    c2cExecution: "Overwrite",
    endedAt,
    responseTime,
    responseTimeInSeconds,
    folderId,
  });
};
