import { generateDummyPassword } from "./db/utils";

export const isProductionEnvironment = process.env.NODE_ENV === "production";
export const isDevelopmentEnvironment = process.env.NODE_ENV === "development";
export const isTestEnvironment = Boolean(
  process.env.PLAYWRIGHT_TEST_BASE_URL ||
    process.env.PLAYWRIGHT ||
    process.env.CI_PLAYWRIGHT
);

export const guestRegex = /^guest-\d+$/;

export const DUMMY_PASSWORD = generateDummyPassword();

export const suggestions = [
  "Hoeveel mensen krijgen jaarlijks longkanker in Nederland?",
  "What is the survival rate for breast cancer?",
  "Hoe verschilt kankerincidentie per regio in Nederland?",
  "Wat zijn de behandelopties bij darmkanker?",
];
