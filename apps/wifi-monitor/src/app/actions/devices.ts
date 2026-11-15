"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { countDevices, createDevice, deleteDevice } from "@/db/queries";
import { requireUser } from "@/lib/auth";
import { MAX_DEVICE_NAME_LENGTH, MAX_DEVICES_PER_USER } from "@/lib/limits";
import { generateToken, hashToken } from "@/lib/token";

export type CreateDeviceState =
  | { status: "idle" }
  | { status: "error"; error: string }
  /** token は発行直後のこの 1 回しか見せない（DB にはハッシュしか残らない） */
  | { status: "created"; name: string; token: string };

const nameSchema = z
  .string()
  .trim()
  .min(1, "端末名を入力してください")
  .max(
    MAX_DEVICE_NAME_LENGTH,
    `端末名は ${MAX_DEVICE_NAME_LENGTH} 文字以内で入力してください`,
  );

export async function createDeviceAction(
  _prev: CreateDeviceState,
  formData: FormData,
): Promise<CreateDeviceState> {
  const user = await requireUser();
  const name = nameSchema.safeParse(formData.get("name") ?? "");
  if (!name.success) {
    return {
      status: "error",
      error: name.error.issues[0]?.message ?? "端末名が不正です",
    };
  }

  const db = await getDb();
  if ((await countDevices(db, user.id)) >= MAX_DEVICES_PER_USER) {
    return {
      status: "error",
      error: `端末は ${MAX_DEVICES_PER_USER} 台までです。使っていない端末を消してください`,
    };
  }

  const token = generateToken();
  await createDevice(db, user.id, {
    name: name.data,
    tokenHash: await hashToken(token),
  });
  revalidatePath("/");
  return { status: "created", name: name.data, token };
}

const idSchema = z.coerce.number().int().positive();

export async function deleteDeviceAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = idSchema.safeParse(formData.get("id"));
  if (!id.success) throw new Error("端末の ID が不正です");

  const db = await getDb();
  await deleteDevice(db, user.id, id.data);
  revalidatePath("/");
  redirect("/");
}
