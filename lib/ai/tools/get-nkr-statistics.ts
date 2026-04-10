import { tool } from "ai";
import { z } from "zod";

// NKR Cijfers API — Netherlands Cancer Registry statistics
// Docs: https://nkr-cijfers.iknl.nl

const NKR_API = "https://api.nkr-cijfers.iknl.nl/api";

async function fetchNavigationItems() {
  const res = await fetch(`${NKR_API}/navigation-items?format=json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ language: "nl-NL" }),
  });
  return res.json();
}

async function fetchFilterGroups(navigationCode: string) {
  const res = await fetch(`${NKR_API}/filter-groups?format=json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      currentNavigation: { code: navigationCode },
      language: "nl-NL",
      filterValuesSelected: [],
      userAction: { code: "restart", value: "" },
    }),
  });
  return res.json();
}

async function fetchData(body: Record<string, unknown>) {
  const res = await fetch(`${NKR_API}/data?format=json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

export const getNkrStatistics = tool({
  description: `Query the Netherlands Cancer Registry (NKR) for cancer statistics.
Use this tool when the user asks about cancer incidence, prevalence, survival rates, stage distribution, or trends in the Netherlands.
You can query different topics like incidence by stage, survival rates, etc.
Common navigation codes: "incidentie/verdeling-per-stadium", "incidentie/aantallen-en-trends", "overleving/relatieve-overleving".
Common cancer type codes: "kankersoort/totaal/alle" (all cancers), "kankersoort/borstkanker" (breast), "kankersoort/longkanker" (lung), "kankersoort/darmkanker" (colorectal), "kankersoort/prostaatkanker" (prostate).
Common period codes: "periode/1-jaar/2024", "periode/1-jaar/2023".
If you're unsure about available options, first call with action "list-topics" to see available navigation items, or "list-filters" to see available filters for a topic.`,
  inputSchema: z.object({
    action: z
      .enum(["list-topics", "list-filters", "query"])
      .describe(
        "Action to perform: list-topics (get available topics), list-filters (get filters for a topic), query (fetch data)"
      ),
    navigationCode: z
      .string()
      .optional()
      .describe(
        'Navigation code for the topic, e.g. "incidentie/verdeling-per-stadium"'
      ),
    cancerType: z
      .string()
      .optional()
      .describe(
        'Cancer type code, e.g. "kankersoort/totaal/alle" or "kankersoort/borstkanker"'
      ),
    period: z
      .string()
      .optional()
      .describe('Period code, e.g. "periode/1-jaar/2024"'),
    sex: z
      .string()
      .optional()
      .describe(
        'Sex filter code, e.g. "geslacht/totaal/alle", "geslacht/man", "geslacht/vrouw"'
      ),
    ageGroup: z
      .string()
      .optional()
      .describe(
        'Age group code, e.g. "leeftijdsgroep/totaal/alle"'
      ),
    region: z
      .string()
      .optional()
      .describe('Region code, e.g. "regio/totaal/alle"'),
  }),
  execute: async (input) => {
    try {
      if (input.action === "list-topics") {
        const items = await fetchNavigationItems();
        return {
          source: "nkr-cijfers.iknl.nl",
          description:
            "Available topics from the Netherlands Cancer Registry",
          data: items,
        };
      }

      if (input.action === "list-filters") {
        if (!input.navigationCode) {
          return {
            error:
              "Please provide a navigationCode to list filters for a specific topic.",
          };
        }
        const filters = await fetchFilterGroups(input.navigationCode);
        return {
          source: "nkr-cijfers.iknl.nl",
          topic: input.navigationCode,
          description: `Available filters for topic: ${input.navigationCode}`,
          data: filters,
        };
      }

      // action === "query"
      if (!input.navigationCode) {
        return {
          error:
            "Please provide a navigationCode to query data. Use action 'list-topics' first if unsure.",
        };
      }

      // Build the query body based on the navigation code
      const isStageDistribution =
        input.navigationCode === "incidentie/verdeling-per-stadium";

      const body: Record<string, unknown> = {
        language: "nl-NL",
        navigation: { code: input.navigationCode },
        aggregateBy: [
          {
            code: "filter/kankersoort",
            values: [
              { code: input.cancerType ?? "kankersoort/totaal/alle" },
            ],
          },
          {
            code: "filter/periode-van-diagnose",
            values: [{ code: input.period ?? "periode/1-jaar/2024" }],
          },
          {
            code: "filter/geslacht",
            values: [{ code: input.sex ?? "geslacht/totaal/alle" }],
          },
          {
            code: "filter/leeftijdsgroep",
            values: [
              {
                code: input.ageGroup ?? "leeftijdsgroep/totaal/alle",
              },
            ],
          },
          {
            code: "filter/regio",
            values: [{ code: input.region ?? "regio/totaal/alle" }],
          },
        ],
        statistic: {
          code: isStageDistribution
            ? "statistiek/verdeling"
            : "statistiek/aantallen",
        },
      };

      // Add groupBy for stage distribution
      if (isStageDistribution) {
        body.groupBy = [
          {
            code: "filter/stadium",
            values: [
              { code: "stadium/0" },
              { code: "stadium/i" },
              { code: "stadium/ii" },
              { code: "stadium/iii" },
              { code: "stadium/iv" },
              { code: "stadium/x" },
              { code: "stadium/nvt" },
            ],
          },
        ];
      }

      const data = await fetchData(body);
      return {
        source: "nkr-cijfers.iknl.nl",
        topic: input.navigationCode,
        filters: {
          cancerType: input.cancerType ?? "kankersoort/totaal/alle",
          period: input.period ?? "periode/1-jaar/2024",
          sex: input.sex ?? "geslacht/totaal/alle",
        },
        data,
      };
    } catch (error) {
      return {
        error: `Failed to fetch NKR data: ${error instanceof Error ? error.message : "Unknown error"}`,
        suggestion:
          "Try using action 'list-topics' to see available options, or check the navigation code.",
      };
    }
  },
});
