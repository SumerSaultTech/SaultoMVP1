import { ReactNode } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

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
          <div className="relative">
            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-gray-600">
              <Bell className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
