export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export async function parseJsonRequest(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new HttpError(400, "INVALID_JSON", "รูปแบบ JSON ไม่ถูกต้อง");
    }

    throw error;
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof HttpError) {
    return Response.json(
      { error: error.code, message: error.message },
      { status: error.status },
    );
  }

  console.error("Unhandled API error", error);
  return Response.json(
    {
      error: "INTERNAL_ERROR",
      message: "ระบบไม่สามารถดำเนินการได้ในขณะนี้",
    },
    { status: 500 },
  );
}
