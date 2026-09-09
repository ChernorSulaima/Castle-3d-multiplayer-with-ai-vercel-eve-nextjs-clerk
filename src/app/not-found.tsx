import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <p aria-hidden className="text-4xl">
        ♟
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">That square is empty</h1>
      <p className="text-sm text-muted-foreground">
        The page you were looking for does not exist, or the game has been cleared away.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Link prefetch={false} href="/" className={buttonVariants({ variant: "outline" })}>
          Home
        </Link>
        <Link prefetch={false} href="/play" className={buttonVariants()}>
          Find a game
        </Link>
      </div>
    </div>
  );
}
