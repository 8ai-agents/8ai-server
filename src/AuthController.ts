import { HttpRequest } from "@azure/functions";
import { createRemoteJWKSet, jwtVerify } from "jose";

export const authenticateRequest = async (
  request: HttpRequest,
): Promise<string> => {
  const authHeader = request.headers.get("authorization");

  if (!authHeader) {
    throw "No Auth Token";
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

  return payload["email"] as string;
};
