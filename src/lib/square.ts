import { Client, Environment } from "square";

export const squareClient = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN || "",
  environment:
    process.env.NODE_ENV === "production"
      ? Environment.Production
      : Environment.Sandbox,
});