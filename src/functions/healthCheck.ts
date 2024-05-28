import { app, HttpResponseInit, InvocationContext } from "@azure/functions";
import { db } from "../DatabaseController";
import { HttpRequest } from "@azure/functions";

export async function healthCheck(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const result = await db.selectFrom("users").select(["id"]).execute();
    if (result && result.length > 0) {
      return { status: 200, body: "8ai API Server Healthy" };
    } else {
      context.error("HEALTH_CHECK FAILED - No Users Found");
      return { status: 500, body: "8ai API Server Unhealthy - No Users Found" };
    }
  } catch (error) {
    context.error("HEALTH_CHECK FAILED - Database is not available");
    return {
      status: 500,
      body: "8ai API Server Unhealthy - Database is not available",
    };
  }
}
app.http("healthCheck", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "health",
  handler: healthCheck,
});
