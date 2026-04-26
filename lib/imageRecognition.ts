import type {
  WineBottleCandidate,
  WineColor,
  WineRecognitionResult
} from "./wineRecognitionTypes";

type RecognizeWineInput = {
  imageBase64: string;
  mimeType: string;
};

const allowedColors: WineColor[] = [
  "red",
  "white",
  "rose",
  "sparkling",
  "dessert",
  "fortified",
  "unknown"
];

export const wineRecognitionPrompt = `Analyze this wine bottle image. The image may contain one bottle or multiple bottles.

Extract the most likely wine information from visible labels only.

Return strict JSON only in this shape:
{
  "bottles": [
    {
      "producer": "string or null",
      "name": "string or null",
      "vintage": "number or null",
      "region": "string or null",
      "country": "string or null",
      "appellation": "string or null",
      "varietal": "string or null",
      "color": "red | white | rose | sparkling | dessert | fortified | unknown",
      "confidence": "number from 0 to 1",
      "uncertaintyNotes": "string",
      "rawLabelText": "string"
    }
  ]
}

Rules:
- Do not guess when the label is unclear.
- Use null for unknown fields.
- If multiple bottles are visible, return one object per bottle.
- If you can read label text but cannot identify the wine confidently, include the readable text in rawLabelText and explain uncertainty.
- Do not include commentary outside the JSON.`;

const mockRecognition: WineRecognitionResult = {
  bottles: [
    {
      producer: "Domaine Example",
      name: "Estate Pinot Noir",
      vintage: 2019,
      region: "Willamette Valley",
      country: "United States",
      appellation: "Willamette Valley",
      varietal: "Pinot Noir",
      color: "red",
      confidence: 0.78,
      uncertaintyNotes:
        "Mock result because OPENAI_API_KEY is not configured. Confirm label details before saving.",
      rawLabelText: "Domaine Example Estate Pinot Noir Willamette Valley 2019"
    },
    {
      producer: null,
      name: "Brut Reserve",
      vintage: null,
      region: null,
      country: null,
      appellation: null,
      varietal: null,
      color: "sparkling",
      confidence: 0.42,
      uncertaintyNotes:
        "Mock low-confidence result. Producer and region were not readable.",
      rawLabelText: "Brut Reserve"
    }
  ]
};

export async function recognizeWineImage({
  imageBase64,
  mimeType
}: RecognizeWineInput): Promise<WineRecognitionResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return mockRecognition;
  }

  const model = process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: wineRecognitionPrompt
            },
            {
              type: "input_image",
              image_url: `data:${mimeType};base64,${imageBase64}`,
              detail: "high"
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vision recognition failed: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as { output_text?: string };
  const outputText = extractOutputText(data);
  const parsed = parseStrictJson(outputText);

  return validateRecognitionResult(parsed);
}

function extractOutputText(data: unknown): string {
  if (isRecord(data) && typeof data.output_text === "string") {
    return data.output_text;
  }

  if (isRecord(data) && Array.isArray(data.output)) {
    const textParts = data.output.flatMap((item) => {
      if (!isRecord(item) || !Array.isArray(item.content)) {
        return [];
      }

      return item.content
        .map((contentItem) => {
          if (!isRecord(contentItem)) {
            return "";
          }

          if (typeof contentItem.text === "string") {
            return contentItem.text;
          }

          return "";
        })
        .filter(Boolean);
    });

    if (textParts.length > 0) {
      return textParts.join("\n");
    }
  }

  throw new Error("Vision recognition response did not include text output.");
}

function parseStrictJson(outputText: string): unknown {
  try {
    return JSON.parse(outputText);
  } catch {
    const jsonMatch = outputText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error("Vision recognition output was not valid JSON.");
    }

    return JSON.parse(jsonMatch[0]);
  }
}

export function validateRecognitionResult(value: unknown): WineRecognitionResult {
  if (!isRecord(value) || !Array.isArray(value.bottles)) {
    return { bottles: [] };
  }

  return {
    bottles: value.bottles.map(normalizeBottle).filter(isBottleCandidate)
  };
}

function normalizeBottle(value: unknown): WineBottleCandidate | null {
  if (!isRecord(value)) {
    return null;
  }

  const color = typeof value.color === "string" && isWineColor(value.color)
    ? value.color
    : "unknown";

  return {
    producer: nullableString(value.producer),
    name: nullableString(value.name),
    vintage: nullableVintage(value.vintage),
    region: nullableString(value.region),
    country: nullableString(value.country),
    appellation: nullableString(value.appellation),
    varietal: nullableString(value.varietal),
    color,
    confidence: normalizeConfidence(value.confidence),
    uncertaintyNotes: stringValue(value.uncertaintyNotes),
    rawLabelText: stringValue(value.rawLabelText)
  };
}

function isWineColor(value: string): value is WineColor {
  return allowedColors.includes(value as WineColor);
}

function nullableString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function nullableVintage(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric = typeof value === "number" ? value : Number(value);

  if (!Number.isInteger(numeric) || numeric < 1500 || numeric > 2100) {
    return null;
  }

  return numeric;
}

function normalizeConfidence(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.min(1, Math.max(0, numeric));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isBottleCandidate(
  value: WineBottleCandidate | null
): value is WineBottleCandidate {
  return value !== null;
}
