import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { authenticateRequest } from "../AuthController";
import { NewOrganisation } from "../models/Database";
import { OrganisationRequest } from "../models/OrganisationRequest";
import { db, getOrganisation } from "../DatabaseController";
import { checkUserIsAdmin, createID } from "../Utils";
import OpenAI from "openai";

export async function createOrganisation(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const { email } = await authenticateRequest(request);
    if (!checkUserIsAdmin("", email, true)) return { status: 403 };
  } catch {
    return { status: 401 };
  }

  try {
    const organisationRequest = (await request.json()) as OrganisationRequest;

    if (!organisationRequest.assistant_id) {
      // Create a new assistant using OpenAI's JS SDK
      try {
        const openai = new OpenAI({
          apiKey: process.env.OPEN_API_KEY,
        });
        const myAssistant = await openai.beta.assistants.create({
          name: `8ai-${organisationRequest.name
            .trim()
            .split(" ")
            .join("-")
            .toLowerCase()}`,
          instructions: `You are a customer support agent for ${organisationRequest.name}. Please answer concisely and nicely to potential customers, if you don't know the answer or the question is sensitive, please ask them to provide a phone number for a call back by an expert within 2 business days.`,
          model: "gpt-4o",
          tools: [
            {
              type: "function",
              function: {
                name: "save_contact_details",
                description: "Save contact details of user to database",
                parameters: {
                  type: "object",
                  properties: {
                    name: {
                      type: "string",
                      description: "The user's name",
                    },
                    email: {
                      type: "string",
                      description: "The user's email",
                    },
                    phone: {
                      type: "string",
                      description: "The user's phone number",
                    },
                  },
                  required: [],
                },
              },
            },
          ],
        });
        organisationRequest.assistant_id = myAssistant.id;
      } catch (e) {
        context.error(`Failed to create assistant in OpenAI: ${e.message}`);
      }
    }

    const organisationToSave: NewOrganisation = {
      ...organisationRequest,
      id: createID("org"),
    };
    await db
      .insertInto("organisations")
      .values(organisationToSave)
      .executeTakeFirst();

    const jsonBody = await getOrganisation(organisationToSave.id);
    return { status: 200, jsonBody };
  } catch (e) {
    console.error(e);
    return {
      status: 500,
      jsonBody: {
        error: `Can't create organisation`,
      },
    };
  }
}

app.http("createOrganisation", {
  methods: ["POST"],
  route: "organisations",
  authLevel: "anonymous",
  handler: createOrganisation,
});
