import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { ConversationResponse } from "../models/ConversationResponse";
import { assert } from "console";

export async function getConversation(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const conv_id = request.params.conv_id as string;
  if (!conv_id) {
    return {
      status: 400,
      jsonBody: {
        error: "Must supply a valid conversation ID",
      },
    };
  }
  context.log(`Get Conversation ${conv_id}`);

  const fakeData: ConversationResponse[] = [
    {
      id: "conv_a1b2c3d4e5",
      contact: {
        id: "contact_01",
        name: "Brave Blue Tiger",
        email: "brave.blue.tiger@example.com",
        phone: "+1234567890",
      },
      created_at: 1672702800,
      last_message_at: 1672706400,
      messages: [
        {
          id: "msg_001",
          conversation_id: "conv_a1b2c3d4e5",
          message: "Hello, how can I assist you today?",
          created_at: 1672702800,
          creator: "AGENT",
        },
        {
          id: "msg_002",
          conversation_id: "conv_a1b2c3d4e5",
          message: "I need help with my order.",
          created_at: 1672703400,
          creator: "CONTACT",
        },
      ],
      status: "OPEN",
      summary: "Assistance with order",
      sentiment: 0.8,
    },
    {
      id: "conv_f6g7h8i9j0",
      contact: {
        id: "contact_02",
        name: "Calm Green Fox",
        email: "calm.green.fox@example.com",
        phone: "+1987654321",
      },
      created_at: 1672800000,
      last_message_at: 1672803600,
      messages: [
        {
          id: "msg_003",
          conversation_id: "conv_f6g7h8i9j0",
          message: "I'm experiencing an issue with my account.",
          created_at: 1672800000,
          creator: "CONTACT",
        },
        {
          id: "msg_004",
          conversation_id: "conv_f6g7h8i9j0",
          message: "I'm sorry to hear that. Can you provide more details?",
          created_at: 1672800600,
          creator: "AGENT",
        },
      ],
      status: "CLOSED",
      summary: "Account issue resolution",
      sentiment: 0.7,
    },
    {
      id: "conv_k1l2m3n4o5",
      contact: {
        id: "contact_03",
        name: "Quick Yellow Cheetah",
        email: "quick.yellow.cheetah@example.com",
        phone: "+1122334455",
      },
      created_at: 1672900000,
      last_message_at: 1672903600,
      messages: [
        {
          id: "msg_005",
          conversation_id: "conv_k1l2m3n4o5",
          message: "Can I change my shipping address?",
          created_at: 1672900000,
          creator: "CONTACT",
        },
        {
          id: "msg_006",
          conversation_id: "conv_k1l2m3n4o5",
          message: "Certainly! I'll assist you with that.",
          created_at: 1672900600,
          creator: "AGENT",
        },
      ],
      status: "OPEN",
      summary: "Change of shipping address",
      sentiment: 0.9,
    },
    {
      id: "conv_p6q7r8s9t0",
      contact: {
        id: "contact_04",
        name: "Gentle Red Panda",
        email: "gentle.red.panda@example.com",
        phone: "+1231231234",
      },
      created_at: 1673000000,
      last_message_at: 1673003600,
      messages: [
        {
          id: "msg_007",
          conversation_id: "conv_p6q7r8s9t0",
          message: "Can you help me with a refund?",
          created_at: 1673000000,
          creator: "CONTACT",
        },
        {
          id: "msg_008",
          conversation_id: "conv_p6q7r8s9t0",
          message: "Of course! Let's get that sorted for you.",
          created_at: 1673000600,
          creator: "AGENT",
        },
      ],
      status: "CLOSED",
      summary: "Refund processing",
      sentiment: 0.6,
    },
    {
      id: "conv_u1v2w3x4y5",
      contact: {
        id: "contact_05",
        name: "Mighty Purple Lion",
        email: "mighty.purple.lion@example.com",
        phone: "+9876543210",
      },
      created_at: 1673100000,
      last_message_at: 1673103600,
      messages: [
        {
          id: "msg_009",
          conversation_id: "conv_u1v2w3x4y5",
          message: "I have a question about my subscription.",
          created_at: 1673100000,
          creator: "CONTACT",
        },
        {
          id: "msg_010",
          conversation_id: "conv_u1v2w3x4y5",
          message: "I'm here to help! What would you like to know?",
          created_at: 1673100600,
          creator: "AGENT",
        },
      ],
      status: "OPEN",
      summary: "Subscription inquiry",
      sentiment: 0.5,
    },
    {
      id: "conv_z6a7b8c9d0",
      contact: {
        id: "contact_06",
        name: "Swift Black Wolf",
        email: "swift.black.wolf@example.com",
        phone: "+2468101214",
      },
      created_at: 1673200000,
      last_message_at: 1673203600,
      messages: [
        {
          id: "msg_011",
          conversation_id: "conv_z6a7b8c9d0",
          message: "I'd like to update my payment details.",
          created_at: 1673200000,
          creator: "CONTACT",
        },
        {
          id: "msg_012",
          conversation_id: "conv_z6a7b8c9d0",
          message: "No problem! I'll guide you through the process.",
          created_at: 1673200600,
          creator: "AGENT",
        },
      ],
      status: "OPEN",
      summary: "Payment details update",
      sentiment: 0.7,
    },
  ];

  const conversation = fakeData.find((c) => c.id === conv_id);
  if (conversation) {
    return { status: 200, jsonBody: conversation };
  } else {
    return {
      status: 404,
      jsonBody: {
        error: "Conversation not found",
      },
    };
  }
}

app.http("getConversation", {
  methods: ["GET"],
  route: "conversations/{conv_id}",
  authLevel: "anonymous",
  handler: getConversation,
});
