export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary">
      <div className="w-full max-w-md p-8">
        <h1 className="mb-8 text-center text-3xl font-bold text-text-primary">
          Pulse Chat
        </h1>
        {children}
      </div>
    </div>
  );
}
