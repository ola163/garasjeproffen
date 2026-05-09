"use client";

export default function CookieSettingsLink() {
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent("open-cookie-settings"))}
      className="hover:text-orange-500 transition-colors"
    >
      Cookie-innstillinger
    </button>
  );
}
