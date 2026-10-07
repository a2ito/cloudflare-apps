import { requireApiUser } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/db";
import {
  questions,
  choices,
  categories,
  groups,
  exams,
  examSessions,
} from "@/db/schema";
import { desc, eq } from "drizzle-orm";

type ChoiceInput = {
  text: string;
  isCorrect: boolean;
};

type QuestionInput = {
  title: string;
  body: string;
  explanation?: string;
  choices: ChoiceInput[];
  examId: number;
  examSessionId: number;
};

export async function POST(request: NextRequest) {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;

  try {
    const body = (await request.json()) as QuestionInput;

    const {
      title,
      body: questionBody,
      explanation,
      choices: choiceList,
      examId,
      examSessionId,
    } = body;

    // ---- validation ----
    if (!title || !questionBody || !Array.isArray(choiceList)) {
      return NextResponse.json({ error: "invalid-request" }, { status: 400 });
    }

    if (choiceList.length < 2) {
      return NextResponse.json({ error: "choices-too-few" }, { status: 400 });
    }

    const correctCount = choiceList.filter(
      (c: ChoiceInput) => c.isCorrect,
    ).length;

    if (correctCount !== 1) {
      return NextResponse.json(
        { error: "invalid-correct-answer-count" },
        { status: 400 },
      );
    }

    // ---- 仮データ（後で差し替え）----
    const categoryId = 1;
    const createdBy = "system";

    const db = getDB();

    // ---- transaction ----
    //const result = await db.transaction(async (tx) => {
    //  const [question] = await tx
    //    .insert(questions)
    //    .values({
    //      title,
    //      body: questionBody,
    //      explanation,
    //      categoryId,
    //      createdBy,
    //      createdAt: Date.now(),
    //      updatedAt: Date.now(),
    //    })
    //    .returning({ id: questions.id });
    //
    //  const questionId = question.id;
    //
    //  await tx.insert(choices).values(
    //    choiceList.map((c: ChoiceInput) => ({
    //      questionId,
    //      text: c.text,
    //      isCorrect: c.isCorrect ? 1 : 0,
    //    })),
    //  );
    //
    //  return questionId;
    //});
    // return NextResponse.json({ id: result }, { status: 201 });

    const [question] = await db
      .insert(questions)
      .values({
        title,
        body: questionBody,
        explanation,
        categoryId,
        examId,
        examSessionId,
        createdBy,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      .returning({ id: questions.id });

    const questionId = question.id;

    await db.insert(choices).values(
      choiceList.map((c: ChoiceInput) => ({
        questionId,
        text: c.text,
        isCorrect: c.isCorrect ? 1 : 0,
      })),
    );

    return NextResponse.json({ id: questionId }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "internal-server-error" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/questions
 * 問題一覧取得
 */
export async function GET() {
  const user = await requireApiUser();
  if (user instanceof NextResponse) return user;

  try {
    const db = getDB();

    const items = await db
      .select({
        id: questions.id,
        title: questions.title,
        categoryId: questions.categoryId,
        createdAt: questions.createdAt,
        categoryName: categories.name,
        groupName: groups.name,
        examName: exams.name,
        examSession: examSessions.name,
      })
      .from(questions)
      .innerJoin(exams, eq(questions.examId, exams.id))
      .innerJoin(examSessions, eq(questions.examSessionId, examSessions.id))
      .leftJoin(categories, eq(questions.categoryId, categories.id))
      .leftJoin(groups, eq(categories.groupId, groups.id))
      .orderBy(desc(questions.createdAt))
      .limit(50);

    return NextResponse.json({ items });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "internal-server-error" },
      { status: 500 },
    );
  }
}
