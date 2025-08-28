import { ReactNode } from "react";

interface HeaderProps {
  title: string;
  subtitle: string;
  actions?: ReactNode;
}

export default function Header({ title, subtitle, actions }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-semibold text-gray-900 tracking-tight">{title}</h2>
          <p className="text-sm text-gray-500 mt-1 font-sans">{subtitle}</p>
        </div>
        <div className="flex items-center space-x-4">
          {actions}
        </div>
      </div>
    </header>
  );
}
