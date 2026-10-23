"use client";

import { useState } from "react";
import { deleteCommentAction } from "@/app/actions/comments";
import type { CommentWithAuthor } from "@/db/queries";
import { buildThreads } from "@/lib/comments";
import { formatTimestamp } from "@/lib/datetime";
import { CommentForm } from "./comment-form";
import { ConfirmForm, DangerButton } from "./ui";

function Avatar({ name, image }: { name: string; image: string | null }) {
  if (image)
    return <img src={image} alt="" className="h-7 w-7 shrink-0 rounded-full" />;
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-700 dark:bg-sky-900 dark:text-sky-200">
      {name.slice(0, 1)}
    </span>
  );
}

function CommentBody({
  comment,
  currentUserId,
}: {
  comment: CommentWithAuthor;
  currentUserId: number;
}) {
  const name = comment.author.name ?? comment.author.email;
  return (
    <div className="flex gap-2">
      <Avatar name={name} image={comment.author.image} />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-zinc-500">
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            {name}
          </span>
          <time dateTime={comment.createdAt}>
            {formatTimestamp(comment.createdAt)}
          </time>
        </p>
        <p className="whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">
          {comment.body}
        </p>
        {comment.authorId === currentUserId && (
          <ConfirmForm
            action={deleteCommentAction}
            message="このコメントを削除しますか？（返信も消えます）"
          >
            <input type="hidden" name="id" value={comment.id} />
            <DangerButton>削除</DangerButton>
          </ConfirmForm>
        )}
      </div>
    </div>
  );
}

export function CommentThreads({
  entryId,
  comments,
  currentUserId,
}: {
  entryId: number;
  comments: CommentWithAuthor[];
  currentUserId: number;
}) {
  const threads = buildThreads(comments);
  const [replyTo, setReplyTo] = useState<number | null>(null);

  return (
    <div className="space-y-5">
      {threads.length === 0 && (
        <p className="text-sm text-zinc-500">まだコメントはありません</p>
      )}

      {threads.map((thread) => (
        <div
          key={thread.comment.id}
          className="space-y-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
        >
          <CommentBody comment={thread.comment} currentUserId={currentUserId} />

          {thread.replies.length > 0 && (
            <div className="space-y-3 border-l-2 border-zinc-200 pl-3 dark:border-zinc-800">
              {thread.replies.map((reply) => (
                <CommentBody
                  key={reply.id}
                  comment={reply}
                  currentUserId={currentUserId}
                />
              ))}
            </div>
          )}

          {replyTo === thread.comment.id ? (
            <div className="space-y-2 border-l-2 border-sky-300 pl-3 dark:border-sky-700">
              <CommentForm
                entryId={entryId}
                parentId={thread.comment.id}
                placeholder="返信を書く…"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="text-xs text-zinc-500 hover:underline"
              >
                やめる
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setReplyTo(thread.comment.id)}
              className="text-xs font-medium text-sky-700 hover:underline dark:text-sky-400"
            >
              返信する
            </button>
          )}
        </div>
      ))}

      <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <CommentForm entryId={entryId} />
      </div>
    </div>
  );
}
