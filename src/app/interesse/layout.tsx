import "../globals.css";

export const metadata = {
  title: "Interesse - GarasjeProffen",
  description: "Vis interesse for en garasje fra GarasjeProffen.",
};

export default function InteresseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      {children}
    </div>
  );
}
