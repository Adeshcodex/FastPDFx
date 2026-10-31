
import { useEffect } from 'react';

export function AdsterraAd() {
  useEffect(() => {
    const containerId = 'container-65b931f2a221c89b0139ca690d1403c0';

    // Prevent duplicate ad scripts
    const container = document.getElementById(containerId);
    if (!container || container.dataset.loaded === 'true') return;

    container.dataset.loaded = 'true';

    const script = document.createElement('script');
    script.async = true;
    script.setAttribute('data-cfasync', 'false');
    script.src = 'https://bauval.org/21/65b931f2a221c89b0139ca690d1403c0';

    container.parentElement?.insertBefore(script, container);
  }, []);

  return (
    <div className="w-full flex justify-center my-8">
      <div
        id="container-65b931f2a221c89b0139ca690d1403c0"
        className="w-full"
      />
    </div>
  );
}
