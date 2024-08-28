import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { authenticateRequest } from "../AuthController";
import { db } from "../DatabaseController";
import { OrganisationResponse } from "../models/OrganisationResponse";
import { checkUserIsAdmin } from "../Utils";

export async function getOrganisations(
  request: HttpRequest,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const { email } = await authenticateRequest(request);
    if (!checkUserIsAdmin("", email, true)) return { status: 403 };
  } catch {
    return { status: 401 };
  }

  const data = await db
    .selectFrom("organisations")
    .select([
      "id",
      "name",
      "assistant_id",
      "description",
      "website",
      "logo_url",
      "support_email",
      "support_phone",
      "chat_icon_color",
      "chat_bubble_color",
      "chat_text_color",
      "fine_tuning_filename",
      "default_questions",
    ])
    .execute();

  const results: OrganisationResponse[] = data.map((d) => {
    return {
      ...d,
    };
  });

  return { status: 200, jsonBody: results };
}

app.http("getOrganisations", {
  methods: ["GET"],
  route: "organisations",
  authLevel: "anonymous",
  handler: getOrganisations,
});
