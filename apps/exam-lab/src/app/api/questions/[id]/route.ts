import { requireApiUser } from "@/lib/auth";
import { NextResponse } from "next/server";
import { getDB } from "@/db";
import { questions, choices } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/questions/:id
 * 問題詳細 + 選択肢取得
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await context.params;
    const questionId = Number(id);

    if (Number.isNaN(questionId)) {
      return NextResponse.json({ error: "invalid-id" }, { status: 400 });
    }

    const db = getDB();

    // ---- 問題本体 ----
    const question = await db
      .select({
        id: questions.id,
        title: questions.title,
        body: questions.body,
        explanation: questions.explanation,
      })
      .from(questions)
      .where(eq(questions.id, questionId))
      .get();

    if (!question) {
      return NextResponse.json({ error: "not-found" }, { status: 404 });
    }

    // ---- 選択肢 ----
    const choiceList = await db
      .select({
        id: choices.id,
        text: choices.text,
        isCorrect: choices.isCorrect,
      })
      .from(choices)
      .where(eq(choices.questionId, questionId));

    return NextResponse.json({
      ...question,
      choices: choiceList,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "internal-server-error" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/questions/:id
 * 問題更新
 */
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await context.params;
    const questionId = Number(id);

    if (Number.isNaN(questionId)) {
      return NextResponse.json({ error: "invalid-id" }, { status: 400 });
    }

    const body = (await request.json()) as {
      title?: string;
      body?: string;
      explanation?: string;
      choices?: Array<{ text: string; isCorrect: boolean }>;
    };
    const {
      title,
      body: questionBody,
      explanation,
      choices: choiceData,
    } = body;

    if (!title || !questionBody || !choiceData || !Array.isArray(choiceData)) {
      return NextResponse.json({ error: "invalid-input" }, { status: 400 });
    }

    const hasCorrectChoice = choiceData.some((c) => c.isCorrect);
    if (!hasCorrectChoice) {
      return NextResponse.json({ error: "no-correct-choice" }, { status: 400 });
    }

    const db = getDB();

    // ---- 存在確認 ----
    const exists = await db
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.id, questionId))
      .get();

    if (!exists) {
      return NextResponse.json({ error: "not-found" }, { status: 404 });
    }

    // ---- 問題本体を更新 ----
    await db
      .update(questions)
      .set({
        title,
        body: questionBody,
        explanation: explanation || null,
        updatedAt: Date.now(),
      })
      .where(eq(questions.id, questionId));

    // ---- 既存の選択肢を全削除 ----
    await db.delete(choices).where(eq(choices.questionId, questionId));

    // ---- 新しい選択肢を挿入 ----
    if (choiceData.length > 0) {
      await db.insert(choices).values(
        choiceData.map((c) => ({
          questionId,
          text: c.text,
          // is_correct は integer カラム。POST 側 (api/questions) と同じ扱いにする
          isCorrect: c.isCorrect ? 1 : 0,
        })),
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "internal-server-error" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/questions/:id
 * 問題削除
 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;

  try {
    const { id } = await context.params;
    const questionId = Number(id);

    if (Number.isNaN(questionId)) {
      return NextResponse.json({ error: "invalid-id" }, { status: 400 });
    }

    const db = getDB();

    await db.transaction(async (tx) => {
      // ---- 存在確認 ----
      const exists = await tx
        .select({ id: questions.id })
        .from(questions)
        .where(eq(questions.id, questionId))
        .get();

      if (!exists) {
        throw new Error("not-found");
      }

      // ---- 子 → 親の順で削除 ----
      await tx.delete(choices).where(eq(choices.questionId, questionId));

      await tx.delete(questions).where(eq(questions.id, questionId));
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message === "not-found") {
      return NextResponse.json({ error: "not-found" }, { status: 404 });
    }

    console.error(err);
    return NextResponse.json(
      { error: "internal-server-error" },
      { status: 500 },
    );
  }
}
