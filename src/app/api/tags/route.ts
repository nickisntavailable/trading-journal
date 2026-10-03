import { NextResponse } from "next/server";
import { z } from "zod";
import { getAccount } from "@/lib/account";
import { handleError } from "@/lib/api";
import { createTag, listTags, tagNameSchema } from "@/lib/tags";

export async function GET() {
  try {
    const account = await getAccount();
    return NextResponse.json({ tags: await listTags(account.id) });
  } catch (error) {
    return handleError(error);
  }
}

const bodySchema = z.object({ name: tagNameSchema });

/** Создать тег или вернуть существующий (архивный — достаётся из архива). */
export async function POST(request: Request) {
  try {
    const account = await getAccount();
    const { name } = bodySchema.parse(await request.json());
    const tag = await createTag(account.id, name);
    return NextResponse.json(
      { tag: { id: tag.id, name: tag.name, archived: false } },
      { status: 201 },
    );
  } catch (error) {
    return handleError(error);
  }
}
