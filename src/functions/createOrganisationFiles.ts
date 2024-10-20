import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { db } from "../DatabaseController";
import { authenticateRequest } from "../AuthController";
import { checkUserIsAdmin, createID } from "../Utils";
import { OrganisationFileRequest } from "../models/OrganisationFileRequest";
import {
  NewOrganisationFile,
  OrganisationFile,
  OrganisationFileToUpdate,
} from "../models/Database";
import {
  createAzureOpenAIClient,
  createFilesAndAttachToVectorStore,
  resetVectorStoreAndFiles,
  updateFiles,
} from "../OpenAIHandler";
import { OrganisationFilesResponse } from "../models/OrganisationFilesResponse";

export async function createOrganisationFiles(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  const org_id = request.params.org_id as string;
  if (!org_id) {
    return {
      status: 400,
      jsonBody: {
        error: "Must supply a valid organisation ID",
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

  const fileRequest = (await request.json()) as {
    duplicate_behaviour: "skip" | "replace" | "error" | "clear_all";
    files: OrganisationFileRequest[];
  };

  if (!fileRequest.files || !fileRequest.files.length) {
    return {
      status: 400,
      jsonBody: {
        error: "Must supply at least one file",
      },
    };
  }

  const { assistant_id, name: organisation_name } = await db
    .selectFrom("organisations")
    .select(["assistant_id", "name", "id"])
    .where("id", "=", org_id)
    .executeTakeFirst();

  let existingFiles: OrganisationFile[] = [];
  if (fileRequest.duplicate_behaviour === "clear_all") {
    if (assistant_id) {
      await resetVectorStoreAndFiles(assistant_id, context);
    }
    await db
      .deleteFrom("organisation_files")
      .where("organisation_id", "=", org_id)
      .execute();
  } else {
    existingFiles = await db
      .selectFrom("organisation_files")
      .selectAll()
      .where("organisation_id", "=", org_id)
      .execute();
  }

  let filesToCreate: NewOrganisationFile[] = [];
  let filesToUpdate: OrganisationFileToUpdate[] = [];

  // Lets look for duplicates
  for (const newFile of fileRequest.files) {
    const existingFile = existingFiles
      .filter((f) => f.url)
      .find((f) => f.url.toLowerCase() === newFile.url.toLowerCase());
    if (existingFile) {
      if (fileRequest.duplicate_behaviour === "error") {
        return {
          status: 400,
          jsonBody: {
            error: `There is already a file with the url ${newFile.url}`,
          },
        };
      } else if (fileRequest.duplicate_behaviour === "skip") {
        continue;
      } else if (fileRequest.duplicate_behaviour === "replace") {
        filesToUpdate.push({
          id: existingFile.id,
          organisation_id: existingFile.organisation_id,
          name: newFile.name,
          url: newFile.url,
          content: newFile.content,
          openai_id: existingFile.openai_id,
          created_at: existingFile.created_at,
          updated_at: Date.now(),
        });
      }
    } else {
      filesToCreate.push({
        ...newFile,
        organisation_id: org_id,
        id: createID("file"),
        created_at: Date.now(),
        updated_at: Date.now(),
        openai_id: undefined,
      });
    }
  }

  context.log(
    `Create ${filesToCreate.length} files and update ${filesToUpdate.length} files for ${org_id}`,
  );

  if (assistant_id) {
    // Publish to openAI
    const openai = createAzureOpenAIClient();
    if (filesToCreate.length) {
      try {
        filesToCreate = await createFilesAndAttachToVectorStore(
          filesToCreate,
          assistant_id,
          org_id,
          organisation_name,
          openai,
          context,
        );
      } catch (e) {
        context.error(`Error Publishing file to OpenAI`);
        context.error(e);
        return {
          status: 500,
          jsonBody: {
            error: "We could not submit your file to the AI model",
          },
        };
      }
      await db.insertInto("organisation_files").values(filesToCreate).execute();
    }

    if (filesToUpdate.length) {
      try {
        filesToUpdate = await updateFiles(
          filesToUpdate,
          assistant_id,
          org_id,
          organisation_name,
          openai,
          context,
        );
      } catch (e) {
        context.error(`Error Publishing file to OpenAI`);
        context.error(e);
        return {
          status: 500,
          jsonBody: {
            error: "We could not submit your file to the AI model",
          },
        };
      }
      // Update DB
      for (const fileToUpdate of filesToUpdate) {
        await db
          .updateTable("organisation_files")
          .set(fileToUpdate)
          .where("id", "=", fileToUpdate.id)
          .execute();
      }
    }
  }

  try {
    const jsonBody: OrganisationFilesResponse[] = await db
      .selectFrom("organisation_files")
      .selectAll()
      .where("organisation_id", "=", org_id)
      .where(
        "id",
        "in",
        filesToCreate.map((f) => f.id).concat(filesToUpdate.map((f) => f.id)),
      )
      .execute();
    return { status: 200, jsonBody };
  } catch {
    return {
      status: 500,
      jsonBody: {
        error: "A weird error occured creating your file",
      },
    };
  }
}

app.http("createOrganisationFiles", {
  methods: ["POST"],
  route: "organisations/{org_id}/files/bulk",
  authLevel: "anonymous",
  handler: createOrganisationFiles,
});
