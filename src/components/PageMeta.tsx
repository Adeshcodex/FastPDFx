import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface PageMetaProps {
  title: string;
  description: string;
}

const SITE_URL = 'https://fastpdfx.pages.dev';

export const PageMeta: React.FC<PageMetaProps> = ({ title, description }) => {
  const location = useLocation();

  useEffect(() => {
    document.title = `${title} | FastPDFx`;

    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', description);
    }

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.setAttribute('content', `${title} | FastPDFx`);
    }

    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription) {
      ogDescription.setAttribute('content', description);
    }

    // Canonical URL: derive from the current route so each page signals
    // its own URL to search engines instead of the homepage.
    // Query strings are stripped to avoid duplicate-content signals.
    const canonicalUrl = `${SITE_URL}${location.pathname.split('?')[0]}`;
    let canonicalLink = document.querySelector("link[rel='canonical']") as HTMLLinkElement | null;
    if (canonicalLink) {
      canonicalLink.setAttribute('href', canonicalUrl);
    } else {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      canonicalLink.setAttribute('href', canonicalUrl);
      document.head.appendChild(canonicalLink);
    }
  }, [title, description, location.pathname]);

  return null;
};
