import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { db } from "../DatabaseController";
import { authenticateRequest } from "../AuthController";
import { checkUserIsAdmin } from "../Utils";
import {
  OrganisationFileResponse,
  OrganisationFileTrainingStatuses,
} from "../models/OrganisationFileResponse";
import { OrganisationFile } from "../models/Database";
import { getVectorStoreFile } from "../OpenAIHandler";

export async function getOrganisationFile(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const org_id = request.params.org_id as string;
  const file_id = request.params.file_id as string;
  if (!org_id) {
    return {
      status: 400,
      jsonBody: {
        error: "Must supply a valid organisation ID",
      },
    };
  }
  if (!file_id) {
    return {
      status: 400,
      jsonBody: {
        error: "Must supply a valid file ID",
      },
    };
  }

  // Authenticate
  try {
    const email = await authenticateRequest(request);
    if (!checkUserIsAdmin(org_id, email, false)) return { status: 403 };
  } catch {
    return { status: 401 };
  }

  context.log(`Get Organisation File ${org_id} ${file_id}`);

  try {
    const file: OrganisationFile = await db
      .selectFrom("organisation_files")
      .selectAll()
      .where("organisation_id", "=", org_id)
      .where("id", "=", file_id)
      .executeTakeFirst();

    if (file) {
      let training_status: OrganisationFileTrainingStatuses =
        OrganisationFileTrainingStatuses.NOT_SYNCED;
      if (file.openai_id) {
        // Get sync status from OpenAI
        try {
          const openaiFile = await getVectorStoreFile(
            await db
              .selectFrom("organisations")
              .select(["assistant_id"])
              .where("id", "=", org_id)
              .executeTakeFirst()
              .then((org) => org.assistant_id),
            file.openai_id,
          );
          training_status =
            openaiFile.status === "in_progress"
              ? OrganisationFileTrainingStatuses.IN_PROGRESS
              : openaiFile.status === "completed"
                ? OrganisationFileTrainingStatuses.ACTIVE
                : OrganisationFileTrainingStatuses.ERROR;
        } catch {
          context.error(
            `Error getting OpenAI file ${file.openai_id}. Deleting`,
          );
          await db
            .updateTable("organisation_files")
            .set({ openai_id: undefined })
            .where("id", "=", file.id)
            .execute();
          file.openai_id = undefined;
          training_status = OrganisationFileTrainingStatuses.NOT_SYNCED;
        }
      }

      const jsonBody: OrganisationFileResponse = {
        ...file,
        training_status,
      };

      return { status: 200, jsonBody };
    } else {
      return {
        status: 404,
        jsonBody: {
          error: "Organisation file not found",
        },
      };
    }
  } catch {
    return {
      status: 500,
      jsonBody: {
        error: "A weird error occured retrieving your file",
      },
    };
  }
}

app.http("getOrganisationFile", {
  methods: ["GET"],
  route: "organisations/{org_id}/files/{file_id}",
  authLevel: "anonymous",
  handler: getOrganisationFile,
});
