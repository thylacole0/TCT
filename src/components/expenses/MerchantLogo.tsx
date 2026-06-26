/** @jsxImportSource preact */
import { useState } from "preact/hooks";

interface Props {
  merchant: string;
  size?: number;
  className?: string;
}

const LOGO_CACHE: Record<string, string> = {};

function normalizeMerchant(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

function clearbitUrl(domain: string): string {
  return `https://logo.clearbit.com/${domain}`;
}

function inferDomain(merchant: string): string | null {
  const m = normalizeMerchant(merchant);
  // Known domain mappings
  const domainMap: Record<string, string> = {
    "uber": "uber.com",
    "uber eats": "ubereats.com",
    "rappi": "rappi.com",
    "pedidosya": "pedidosya.com",
    "falabella": "falabella.com",
    "jumbo": "jumbo.cl",
    "lider": "lider.cl",
    "unimarc": "unimarc.cl",
    "tottus": "tottus.cl",
    "santa isabel": "santaisabel.cl",
    "spotify": "spotify.com",
    "netflix": "netflix.com",
    "apple": "apple.com",
    "google": "google.com",
    "youtube": "youtube.com",
    "twitch": "twitch.tv",
    "amazon": "amazon.com",
    "mercadolibre": "mercadolibre.com",
    "mercadopago": "mercadopago.com",
    "paypal": "paypal.com",
    "copec": "copec.cl",
    "shell": "shell.com",
    "starbucks": "starbucks.com",
    "mcdonald": "mcdonalds.com",
    "kfc": "kfc.com",
    "burger king": "burgerking.com",
    "epic games": "epicgames.com",
    "openai": "openai.com",
    "steam": "steampowered.com",
    "banco falabella": "bancofalabella.cl",
    "entel": "entel.cl",
    "movistar": "movistar.cl",
  };
  return domainMap[m] || null;
}

export default function MerchantLogo({ merchant, size = 24, className = "" }: Props) {
  const [failed, setFailed] = useState(false);
  const normalized = normalizeMerchant(merchant);

  if (!merchant || failed) {
    return (
      <span
        class={`merchant-logo-fallback ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.5 }}
        title={merchant}
      >
        {merchant.charAt(0).toUpperCase()}
      </span>
    );
  }

  // Try manual mapping first (loaded async)
  const [logoSrc, setLogoSrc] = useState<string | null>(() => LOGO_CACHE[normalized] || null);

  if (!logoSrc) {
    // Load manual mapping
    import("../../data/merchant-logos.json")
      .then((m) => {
        const map = (m as any).default?.merchants || (m as any).merchants || {};
        const url = map[normalized];
        if (url) {
          LOGO_CACHE[normalized] = url;
          setLogoSrc(url);
        } else {
          // Try auto-fallback
          const domain = inferDomain(normalized);
          if (domain) {
            const fallback = clearbitUrl(domain);
            LOGO_CACHE[normalized] = fallback;
            setLogoSrc(fallback);
          } else {
            setFailed(true);
          }
        }
      })
      .catch(() => {
        // Fallback to inference
        const domain = inferDomain(normalized);
        if (domain) {
          const fallback = clearbitUrl(domain);
          LOGO_CACHE[normalized] = fallback;
          setLogoSrc(fallback);
        } else {
          setFailed(true);
        }
      });

    // Show placeholder while loading
    return (
      <span
        class={`merchant-logo-loading ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.5 }}
        title={merchant}
      >
        {merchant.charAt(0).toUpperCase()}
      </span>
    );
  }

  return (
    <img
      src={logoSrc}
      alt={merchant}
      class={`merchant-logo ${className}`}
      style={{ width: size, height: size, borderRadius: 4, objectFit: "contain" }}
      onError={() => setFailed(true)}
      title={merchant}
    />
  );
}
