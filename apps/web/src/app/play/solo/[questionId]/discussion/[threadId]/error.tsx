'use client';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main
      className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12"
      role="alert"
    >
      <h2 className="mb-2 text-lg font-semibold">토론을 불러오지 못했어요</h2>
      <p className="mb-4 text-sm text-muted-foreground">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        다시 시도
      </button>
    </main>
  );
}
