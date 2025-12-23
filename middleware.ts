import { NextRequest, NextResponse } from "next/server";
import { locales, defaultLocale, type Locale } from "@/lib/i18n";

export default function middleware(request: NextRequest) {
  // Get locale from cookie
  const localeCookie = request.cookies.get("locale")?.value as
    | Locale
    | undefined;
  const locale = locales.includes(localeCookie as Locale)
    ? localeCookie
    : defaultLocale;

  // Create response and set locale header for next-intl
  const response = NextResponse.next();
  response.headers.set("X-NEXT-INTL-LOCALE", locale!);

  return response;
}

export const config = {
  // Match all pathnames except for
  // - API routes
  // - Static files
  // - _next internals
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
