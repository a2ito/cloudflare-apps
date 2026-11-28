import { notFound } from "next/navigation";
import { requireTreeAccess, type TreeAccess, TreeAccessError } from "./access";
import { idFromForm } from "./form";

/**
 * /trees/[id] 配下のページ用。メンバーでなければ、家系図が存在するかどうかも含めて
 * 何も見せずに 404 にする。
 */
export async function treeAccessFromParams(
  params: Promise<{ id: string }>,
): Promise<TreeAccess> {
  const id = idFromForm.safeParse((await params).id);
  if (!id.success) notFound();
  try {
    return await requireTreeAccess(id.data);
  } catch (error) {
    if (error instanceof TreeAccessError) notFound();
    throw error;
  }
}
