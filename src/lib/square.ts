import { SquareClient, SquareEnvironment } from "square";

const envOverride = (process.env.SQUARE_ENVIRONMENT || "").toLowerCase().trim();
const useProduction = envOverride === "production" || envOverride === "";

export const squareClient = new SquareClient({
  token: process.env.SQUARE_ACCESS_TOKEN || "",
  environment: useProduction ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
});