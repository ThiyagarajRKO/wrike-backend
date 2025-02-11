import { GetResponse } from "../../../utils/node-fetch";
import customFieldIdMeta from "../utils/customFieldsIds-onshore";
import { produce as logger } from "../../../utils/kafka";

const WrikeEndpoint = process.env.WRIKE_ENDPOINT;
const WrikeToken = process.env.WRIKE_TOKEN;
const CustomFieldIds = customFieldIdMeta[process.env.NODE_ENV?.toLowerCase()];
const OriginalCustomFieldData = { TEST: [], LIVE: [] };
const CustomFieldRequired = [
  "Agency*",
  "Campaign Start Date*",
  "Campaign End Date*",
  "Currency*",
  "Campaign Objective*",
  "Brand*",
  "Requestor's Market*",
  "CCUID*",
  "CSSID*",
  "WrikeXPI-State",
  "Space Name*",
  "Campaign Name*",
];

export const OnshoreCopynew = (params, startedAt, fastify) => {
  return new Promise(async (resolve, reject) => {
    try {
      if (!WrikeToken) {
        return reject({ message: "Invalid auth token!" });
      }

      // Variable Declaration
      const { folderId } = params;

      let taskUpdateCustomFields = [];
      let folderCustomFieldsValues = {};

      const folderData = await getFolder(startedAt, folderId);

      await updateFolder(startedAt, folderId, {
        customFields: [
          { id: CustomFieldIds["CopyToChild*"], value: "In Progress" },
        ],
      });

      let spaceName;
      // Filtering Onshore customfield value
      await Promise.all(
        folderData?.data[0]?.customFields?.map((data) => {
          const index = Object.values(CustomFieldIds)?.indexOf(data["id"]);
          const reqCFIndex = CustomFieldRequired.indexOf(
            Object.keys(CustomFieldIds)[index]
          );
          if (index > -1 && reqCFIndex > -1) {
            taskUpdateCustomFields.push({
              id: data["id"],
              value: data["value"],
            });
          }

          if (data?.id == CustomFieldIds["Space Name*"]) {
            spaceName = data?.value;
          }

          folderCustomFieldsValues[data?.id] = data?.value;
        })
      );

      if (!spaceName)
        return setWarningStatus(
          startedAt,
          folderId,
          "CopyToChild failed to run due to missing custom field <b>space name</b>"
        )
          .then(resolve)
          .catch(reject);

      const spaceNameArray = spaceName.split("-");
      const clientCol = `Clients-${spaceNameArray[0]}-${spaceNameArray[1]}`;
      const debtorCol = `Debtors-${spaceNameArray[0]}-${spaceNameArray[1]}`;

      const customFieldData = await getCustomFields(startedAt);

      if (customFieldData?.data?.length == 0)
        return reject({ message: "Customfield ids are Empty" });

      const { clientSpaceNameId, debtorSpaceNameId } =
        await findClientAndDebtorValue(
          customFieldData?.data,
          clientCol,
          debtorCol
        );

      if (!clientSpaceNameId || clientSpaceNameId?.length <= 0)
        return setWarningStatus(
          startedAt,
          folderId,
          `CopyToChild failed to run due to missing custom field <b>${clientCol}</b> (for your market or agency)`
        )
          .then(resolve)
          .catch(reject);

      if (!debtorSpaceNameId || debtorSpaceNameId?.length <= 0)
        return setWarningStatus(
          startedAt,
          folderId,
          `CopyToChild failed to run due to missing custom field <b>${debtorCol}</b> (for your market or agency)`
        )
          .then(resolve)
          .catch(reject);

      if (clientSpaceNameId?.length > 1)
        return setWarningStatus(
          startedAt,
          folderId,
          `CopyToChild failed to run due to missing custom field <b>${clientCol}</b> (for your market or agency) present multiple times`
        )
          .then(resolve)
          .catch(reject);

      if (debtorSpaceNameId?.length > 1)
        return setWarningStatus(
          startedAt,
          folderId,
          `CopyToChild failed to run due to missing custom field <b>${debtorCol}</b> (for your market or agency) present multiple times`
        )
          .then(resolve)
          .catch(reject);

      if (!folderCustomFieldsValues[clientSpaceNameId[0]])
        return setWarningStatus(
          startedAt,
          folderId,
          `CopyToChild failed to run due to missing custom field <b>${clientCol}</b> (for your market or agency)`
        )
          .then(resolve)
          .catch(reject);

      if (!folderCustomFieldsValues[debtorSpaceNameId[0]])
        return setWarningStatus(
          startedAt,
          folderId,
          `CopyToChild failed to run due to missing custom field <b>${debtorCol}</b> (for your market or agency)`
        )
          .then(resolve)
          .catch(reject);

      // Inserting Client and Debtors space name
      // taskUpdateCustomFields.push({
      //   id: clientSpaceNameId[0],
      //   value: folderCustomFieldsValues[clientSpaceNameId[0]],
      // });

      // taskUpdateCustomFields.push({
      //   id: debtorSpaceNameId[0],
      //   value: folderCustomFieldsValues[debtorSpaceNameId[0]],
      // });

      taskUpdateCustomFields.push({
        id: CustomFieldIds["Client*"],
        value: folderCustomFieldsValues[clientSpaceNameId[0]],
      });

      taskUpdateCustomFields.push({
        id: CustomFieldIds["Debtor*"],
        value: folderCustomFieldsValues[debtorSpaceNameId[0]],
      });

      taskUpdateCustomFields.push({
        id: CustomFieldIds["WrikeXPI-State"],
        value: "Completed",
      });

      await executeTaskOperation(startedAt, folderId, taskUpdateCustomFields);

      await updateFolder(startedAt, folderId, {
        customFields: [
          {
            id: CustomFieldIds["Campaign Name*"],
            value: folderData?.data[0]?.title,
          },
          {
            id: CustomFieldIds["Client*"],
            value: folderCustomFieldsValues[clientSpaceNameId[0]],
          },
          {
            id: CustomFieldIds["Debtor*"],
            value: folderCustomFieldsValues[debtorSpaceNameId[0]],
          },
          { id: CustomFieldIds["CopyToChild*"], value: "Completed" },
        ],
      });

      logIt({
        status: "Info",
        message: "",
        step: "End",
        folderId,
        startedAt,
      });

      // Sending final response
      resolve({
        message:
          "CopyToChild - Onshore copynew process has been created successfully",
        data: {},
      });
    } catch (err) {
      reject(err);
    }
  });
};

const setWarningStatus = (startedAt, folderId, message) => {
  return new Promise((resolve, reject) => {
    try {
      updateFolder(startedAt, folderId, {
        customFields: [{ id: CustomFieldIds["CopyToChild*"], value: "Error" }],
      }).catch(console.log);

      if (process.env.NODE_ENV != "LIVE")
        sendComment(startedAt, folderId, message);

      logIt({
        status: "Warn",
        message,
        step: "CustomField Validation",
        folderId,
        startedAt,
      });

      resolve({ message });
    } catch (err) {
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

      if (folderOutput?.errorDescription) {
        // Sending folder update error response
        logIt({
          status: "Error",
          message: folderOutput?.errorDescription,
          step: "Get Folder",
          startedAt,
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
          status: "Error",
          message: folderOutput?.errorDescription,
          step: "Update Folder",
          folderId,
          startedAt,
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
          status: "Error",
          message: commentOutput?.errorDescription,
          step: "Folder Comment",
          folderId,
          startedAt,
        });

        return reject(commentOutput);
      }

      resolve(commentOutput);
    } catch (error) {
      reject(error);
    }
  });
};

const getCustomFields = (startedAt) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Get folder data
      let customFieldOutput = {};
      if (OriginalCustomFieldData[process.env.NODE_ENV].length == 0)
        customFieldOutput = await GetResponse(
          `${WrikeEndpoint}/customfields`,
          "GET",
          {
            "content-type": "application/json",
            Authorization: `Bearer ${WrikeToken}`,
          }
        );
      else customFieldOutput = OriginalCustomFieldData[process.env.NODE_ENV];

      // Sending folder update error response
      if (customFieldOutput?.errorDescription) {
        logIt({
          status: "Error",
          message: customFieldOutput?.errorDescription,
          step: "Get Custom Field",
          folderId,
          startedAt,
        });

        return reject(customFieldOutput);
      }

      if (OriginalCustomFieldData[process.env.NODE_ENV].length == 0)
        OriginalCustomFieldData[process.env.NODE_ENV] = customFieldOutput;

      resolve(customFieldOutput);
    } catch (error) {
      reject(error);
    }
  });
};

const findClientAndDebtorValue = (customFieldData, clientCol, debtorCol) => {
  return new Promise(async (resolve, reject) => {
    try {
      let debtorSpaceNameId = [],
        clientSpaceNameId = [];
      await customFieldData.map((data) => {
        if (data?.title.startsWith(clientCol)) {
          clientSpaceNameId.push(data.id);
        }
        if (data?.title.startsWith(debtorCol)) {
          debtorSpaceNameId.push(data.id);
        }

        if (debtorSpaceNameId.length > 0 && clientSpaceNameId.length > 0)
          return;
      });

      resolve({ debtorSpaceNameId, clientSpaceNameId });
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

      const taskIds = await Promise.all(
        tasks?.data
          ?.filter(
            (task) =>
              !task?.customFields?.some(
                (field) =>
                  field?.id === CustomFieldIds["WrikeXPI-State"] &&
                  field?.value === "Completed"
              )
          )
          ?.map(async (task) => task.id)
      );

      if (taskIds.length == 0) {
        if (tasks?.nextPageToken) {
          await executeTaskOperation(
            startedAt,
            folderId,
            taskUpdateCustomFields,
            tasks?.nextPageToken
          );

          return resolve();
        } else {
          logIt({
            status: "Warn",
            message: "No tasks found in the project",
            startedAt,
            folderId,
          });
          return resolve();
        }
      }

      if (taskIds.length > 0)
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
      // Get folder data
      const taskOutput = await GetResponse(
        `${WrikeEndpoint}/folders/${folderId}/tasks?descendants=true&sortField=Title&sortOrder=Asc&subTasks=true&pageSize=20&fields=[customFields]&nextPageToken=${taskTempToken ?? ""}`,
        "GET",
        {
          "content-type": "application/json",
          Authorization: `Bearer ${WrikeToken}`,
        }
      );

      // Sending folder update error response
      if (taskOutput?.errorDescription) {
        logIt({
          status: "Error",
          message: taskOutput?.errorDescription,
          step: "Get Tasks",
          folderId,
          startedAt,
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
          status: "Error",
          message: taskOutput?.errorDescription,
          step: "Update Task",
          folderId,
          startedAt,
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
    c2cType: "Onshore",
    c2cExecution: "CopyNew",
    endedAt,
    responseTime,
    responseTimeInSeconds,
    folderId,
  });
};
