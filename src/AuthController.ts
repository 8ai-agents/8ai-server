import { HttpRequest } from "@azure/functions";
import { createRemoteJWKSet, jwtVerify } from "jose";

export const authenticateRequest = async (request: HttpRequest) => {
  const authHeader = request.headers.get("authorization");

  if (!authHeader) {
  }

  const tokenParts = authHeader.split(" ");

  if (tokenParts.length !== 2 || tokenParts[0] !== "Bearer") {
    throw "Invalid Token";
  }

  const token = tokenParts[1];

  const JWKS = createRemoteJWKSet(
    new URL("https://bayly.au.auth0.com/.well-known/jwks.json")
  );

  const { payload } = await jwtVerify(token, JWKS, {
    issuer: "https://bayly.au.auth0.com/",
    audience: "8ai-prod",
  });

  return payload;
};
