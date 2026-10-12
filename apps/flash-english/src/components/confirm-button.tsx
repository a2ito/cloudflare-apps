"use client";

/** 押したときに確認を挟む送信ボタン。消すと戻せない操作に使う */
export function ConfirmButton({ message, className, children }: { message: string; className?: string; children: React.ReactNode }) {
	return (
		<button
			type="submit"
			className={className}
			onClick={(e) => {
				if (!window.confirm(message)) e.preventDefault();
			}}
		>
			{children}
		</button>
	);
}
