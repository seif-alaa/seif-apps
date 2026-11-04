"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { whatsappLink } from "@/config/site";

/** Floating WhatsApp button, bottom-right. Opens a chat with the current page address in the message. */
export function WhatsAppButton() {
  const pathname = usePathname();
  const [href, setHref] = useState(whatsappLink());
  useEffect(() => setHref(whatsappLink(window.location.href)), [pathname]);
  if (/^\/(checkout|bag)/.test(pathname)) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with NIVORÉ on WhatsApp"
      data-testid="whatsapp-button"
      className="fixed bottom-4 right-4 z-40 grid h-12 w-12 place-items-center rounded-full bg-espresso text-ivory shadow-[0_8px_24px_-8px_rgba(58,50,46,0.6)] transition-transform hover:scale-105 md:bottom-6 md:right-6"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12.04 2a9.9 9.9 0 0 0-8.5 14.95L2 22l5.2-1.5A9.9 9.9 0 1 0 12.04 2Zm0 1.8a8.1 8.1 0 0 1 0 16.2 8 8 0 0 1-4.1-1.13l-.3-.18-3.08.89.9-3-.2-.31A8.1 8.1 0 0 1 12.04 3.8Zm-3.2 4.2c-.17 0-.45.06-.69.32-.24.26-.9.88-.9 2.15s.92 2.5 1.05 2.67c.13.17 1.8 2.88 4.45 3.92 2.2.87 2.65.7 3.12.65.48-.04 1.54-.63 1.76-1.24.22-.6.22-1.13.15-1.24-.06-.1-.24-.17-.5-.3-.27-.13-1.54-.76-1.78-.85-.24-.09-.41-.13-.59.13-.17.26-.68.85-.83 1.02-.15.18-.3.2-.57.07-.26-.13-1.1-.4-2.1-1.3-.77-.69-1.3-1.54-1.45-1.8-.15-.26-.02-.4.12-.53.12-.12.26-.3.39-.45.13-.15.17-.26.26-.43.09-.18.04-.33-.02-.46-.07-.13-.6-1.4-.82-1.9-.2-.5-.41-.43-.59-.44h-.5Z" />
      </svg>
    </a>
  );
}
