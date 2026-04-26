import { NextResponse } from "next/server";
import {
  WineRecognitionError,
  recognizeWineImage
} from "@/lib/imageRecognition";

export const runtime = "nodejs";

const supportedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
]);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const image = formData.get("image");

    if (!(image instanceof File)) {
      return NextResponse.json(
        { error: "Image file is required." },
        { status: 400 }
      );
    }

    if (!supportedMimeTypes.has(image.type)) {
      return NextResponse.json(
        { error: "Unsupported image type." },
        { status: 415 }
      );
    }

    if (image.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Image must be 10 MB or smaller." },
        { status: 413 }
      );
    }

    const buffer = Buffer.from(await image.arrayBuffer());
    const result = await recognizeWineImage({
      imageBase64: buffer.toString("base64"),
      mimeType: image.type
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);

    if (error instanceof WineRecognitionError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          suggestions: getRecognitionSuggestions(error.code)
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        error: "Could not recognize wine image.",
        code: "recognition_failed",
        suggestions: [
          "Try a clearer photo with the front label centered.",
          "Add the bottle manually if the label is damaged or unreadable."
        ]
      },
      { status: 500 }
    );
  }
}

function getRecognitionSuggestions(code: string): string[] {
  if (code === "openai_unauthorized") {
    return [
      "Check that OPENAI_API_KEY in Vercel is the actual key value and starts with sk-.",
      "Redeploy the Vercel project after changing the environment variable.",
      "Create a fresh OpenAI API key if the current key was deleted or copied incorrectly."
    ];
  }

  if (code === "openai_rate_limited") {
    return [
      "Check your OpenAI billing, quota, or rate limits.",
      "Wait a minute and try scanning again.",
      "Add the bottle manually if you need to keep moving."
    ];
  }

  if (code === "openai_model_error") {
    return [
      "Check OPENAI_VISION_MODEL in Vercel.",
      "Use gpt-4.1-mini unless you intentionally changed the model.",
      "Redeploy after changing environment variables."
    ];
  }

  return [
    "Try a clearer, brighter photo with visible label text.",
    "Try again in a minute.",
    "Add the bottle manually if recognition keeps failing."
  ];
}
