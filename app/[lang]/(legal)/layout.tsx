export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-[640px] flex-1 px-4 pb-12 pt-4 md:px-8 md:pt-6">
      {children}
    </main>
  );
}
