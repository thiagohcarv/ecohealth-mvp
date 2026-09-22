export function EcoHealthLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizes = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-3xl",
  };

  return (
    <div className={`flex items-baseline gap-0 font-inter font-bold ${sizes[size]}`}>
      <span className="text-secondary-300">Eco</span>
      <span className="text-secondary-500">Health</span>
      <span className="text-secondary-300 text-[10px] font-normal align-super ml-0.5">tm</span>
    </div>
  );
}
