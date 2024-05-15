import { HttpRequest } from "@azure/functions";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { UserRoleType } from "./models/Database";

export const authenticateRequest = async (
  request: HttpRequest,
): Promise<{ email: string }> => {
  const authHeader = request.headers.get("authorization");

  if (!authHeader) {
  }

  const tokenParts = authHeader.split(" ");

  if (tokenParts.length !== 2 || tokenParts[0] !== "Bearer") {
    throw "Invalid Token";
  }

  const token = tokenParts[1];

  const JWKS = createRemoteJWKSet(
    new URL("https://8ai.au.auth0.com/.well-known/jwks.json"),
  );

  const { payload } = await jwtVerify(token, JWKS, {
    issuer: "https://8ai.au.auth0.com/",
    audience: "https://api.8ai.co.nz",
  });

  return {
    email: payload["email"] as string,
  };
};
