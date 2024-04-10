import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { ConversationsResponse } from "../models/ConversationsResponse";

export async function getConversations(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Get Conversations`);

  const conversations: ConversationsResponse[] = [
    {
      id: "conv_a1b2c3d4e5",
      contact_name: "Brave Blue Tiger",
      created_at: 1672702800,
      last_message_at: 1672706400,
      status: "OPEN",
      summary: "Assistance with order",
    },
    {
      id: "conv_f6g7h8i9j0",
      contact_name: "Calm Green Fox",
      created_at: 1672800000,
      last_message_at: 1672803600,
      status: "CLOSED",
      summary: "Account issue resolution",
    },
    {
      id: "conv_k1l2m3n4o5",
      contact_name: "Quick Yellow Cheetah",
      created_at: 1672900000,
      last_message_at: 1672903600,
      status: "OPEN",
      summary: "Change of shipping address",
    },
    {
      id: "conv_p6q7r8s9t0",
      contact_name: "Gentle Red Panda",
      created_at: 1673000000,
      last_message_at: 1673003600,
      status: "CLOSED",
      summary: "Refund processing",
    },
    {
      id: "conv_u1v2w3x4y5",
      contact_name: "Mighty Purple Lion",
      created_at: 1673100000,
      last_message_at: 1673103600,
      status: "OPEN",
      summary: "Subscription inquiry",
    },
    {
      id: "conv_z6a7b8c9d0",
      contact_name: "Swift Black Wolf",
      created_at: 1673200000,
      last_message_at: 1673203600,
      status: "OPEN",
      summary: "Payment details update",
    },
  ];

  return { status: 200, jsonBody: conversations };
}

app.http("getConversations", {
  methods: ["GET"],
  route: "conversations",
  authLevel: "anonymous",
  handler: getConversations,
});
