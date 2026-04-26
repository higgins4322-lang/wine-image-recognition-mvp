import { NextResponse } from "next/server";
import { recognizeWineImage } from "@/lib/imageRecognition";

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

    return NextResponse.json(
      { error: "Could not recognize wine image." },
      { status: 500 }
    );
  }
}
