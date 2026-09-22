interface MobileScreenProps {
  children: React.ReactNode;
  className?: string;
}

export function MobileScreen({ children, className = "" }: MobileScreenProps) {
  return (
    <main className="min-h-screen bg-secondary-100 sm:flex sm:items-start sm:justify-center sm:pt-0">
      <div
        className={`min-h-screen w-full max-w-[402px] lg:max-w-none bg-white relative overflow-x-hidden lg:overflow-x-visible mx-auto ${className}`}
      >
        {children}
      </div>
    </main>
  );
}
