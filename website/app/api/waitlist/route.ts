import { NextResponse } from "next/server";
import { z } from "zod";

const requestSchema = z.object({
  email: z.string().trim().email(),
});

const AIRTABLE_API_URL = "https://api.airtable.com/v0";

function getEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = requestSchema.parse(body);

    const apiKey = getEnv("AIRTABLE_API_KEY");
    const baseId = getEnv("AIRTABLE_BASE_ID");
    const tableName = getEnv("AIRTABLE_TABLE_NAME");

    const airtableUrl = `${AIRTABLE_API_URL}/${baseId}/${encodeURIComponent(tableName)}`;
    const airtablePayload = {
      records: [
        {
          fields: {
            Email: email.toLowerCase(),
            Source: "website",
            Product: "lunar",
            CreatedAt: new Date().toISOString(),
          },
        },
      ],
    };

    console.log("[waitlist] POST", airtableUrl);
    console.log("[waitlist] payload", JSON.stringify(airtablePayload, null, 2));

    const airtableResponse = await fetch(airtableUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(airtablePayload),
    });

    const responseText = await airtableResponse.text();

    if (!airtableResponse.ok) {
      console.error("[waitlist] Airtable responded with an error:", {
        status: airtableResponse.status,
        statusText: airtableResponse.statusText,
        body: responseText,
      });

      return NextResponse.json(
        {
          error: "Failed to save email to waitlist storage.",
          details: responseText,
        },
        { status: 502 },
      );
    }

    console.log("[waitlist] Airtable success:", responseText);

    return NextResponse.json(
      { success: true, message: "You have been added to the waitlist." },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Please provide a valid email address.",
          issues: error.flatten(),
        },
        { status: 400 },
      );
    }

    const message =
      error instanceof Error ? error.message : "Unexpected server error.";

    console.error("[waitlist] Caught exception:", message);

    const status = message.startsWith("Missing required environment variable:")
      ? 500
      : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
