import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import { settingsQuery } from "@/lib/store";

const ok = (v: string | null | undefined, re: RegExp) => (v && re.test(v.trim()) ? v.trim() : null);
declare global { interface Window { dataLayer?: unknown[]; fbq?: (...a: unknown[]) => void; gtag?: (...a: unknown[]) => void } }

function addScript(id: string, src?: string, inline?: string) {
  if (document.getElementById(id)) return;
  const el = document.createElement("script");
  el.id = id;
  if (src) { el.async = true; el.src = src; }
  if (inline) el.text = inline;
  document.head.appendChild(el);
}

/** Loads GA4 / GTM / Meta Pixel on the storefront from IDs set in Settings → Marketing. IDs are format-checked before use. */
export function Tracking() {
  const { data: s } = useQuery(settingsQuery);
  const { pathname } = useLocation();
  const storefront = !pathname.startsWith("/admin");
  const ga = ok(s?.ga4_id, /^G-[A-Z0-9]{4,20}$/i);
  const gtm = ok(s?.gtm_id, /^GTM-[A-Z0-9]{4,12}$/i);
  const px = ok(s?.meta_pixel_id, /^\d{6,20}$/);

  useEffect(() => {
    if (!storefront) return;
    if (ga) {
      addScript("ga4-src", `https://www.googletagmanager.com/gtag/js?id=${ga}`);
      addScript("ga4-init", undefined, `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)};window.gtag=gtag;gtag('js',new Date());gtag('config','${ga}',{send_page_view:false});`);
    }
    if (gtm) addScript("gtm", undefined, `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s);j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtm}');`);
    if (px) addScript("meta-px", undefined, `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${px}');`);
  }, [storefront, ga, gtm, px]);

  useEffect(() => {
    if (!storefront) return;
    window.gtag?.("event", "page_view", { page_path: pathname });
    window.fbq?.("track", "PageView");
  }, [pathname, storefront, ga, px]);

  return null;
}
