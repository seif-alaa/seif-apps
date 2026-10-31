import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { getContent, getSettings, isDevDriver } from "@/server/catalog";

/** Cached and regenerated at most every minute; admin edits revalidate immediately. */
export const revalidate = 60;

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [settings, content] = await Promise.all([getSettings(), getContent()]);
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:bg-espresso focus:px-4 focus:py-2 focus:text-ivory">
        Skip to content
      </a>
      {settings.previewNotice && isDevDriver() && (
        <div className="bg-espresso px-4 py-2 text-center text-[11px] tracking-[0.06em] text-stone">
          Preview build · sample catalogue and prices · orders and bids here are not real
        </div>
      )}
      {content.banner.enabled && content.banner.text && (
        <div className="border-b border-line bg-cream px-4 py-2 text-center text-xs tracking-[0.04em]">
          {content.banner.href ? <a href={content.banner.href} className="link-underline">{content.banner.text}</a> : content.banner.text}
        </div>
      )}
      <Header />
      <main id="main">{children}</main>
      <Footer content={content} settings={settings} />
    </>
  );
}
