"use client";

import { Film, Heart, Instagram } from "lucide-react";
import { useTranslations } from "next-intl";

export function Footer() {
  const currentYear = new Date().getFullYear();
  const t = useTranslations("footer");

  return (
    <footer className="w-full border-t border-border/40 bg-background/80 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Film className="h-4 w-4 text-purple-500" />
            <span className="font-semibold text-foreground">Kahoovie</span>
          </div>
          <p className="flex items-center gap-1">
            {t("madeWith")}{" "}
            <Heart className="h-3 w-3 fill-red-500 text-red-500" /> {t("for")}{" "}
            Miche, Esme, Nicole, Zoe y Rodo
          </p>
          <p className="text-xs">
            © {currentYear} Kahoovie. {t("allRightsReserved")}.
          </p>
          <a
            href="https://instagram.com/ie.hein"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs transition-colors hover:text-pink-500"
          >
            <Instagram className="h-4 w-4" />
            <span>@ie.hein</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
