
import { useEffect, useRef } from 'react';

export function AdsterraAd() {
  const adRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = adRef.current;
    if (!container || container.dataset.loaded === 'true') return;

    container.dataset.loaded = 'true';

    (window as any).atOptions = {
      key: '2a2a57e349b907c6b35f1506c261bdc2',
      format: 'iframe',
      height: 250,
      width: 300,
      params: {},
    };

    const script = document.createElement('script');
    script.src = 'https://bauval.org/22/2a2a57e349b907c6b35f1506c261bdc2';
    script.async = true;

    container.appendChild(script);
  }, []);

  return (
    <div className="w-full flex justify-center my-8">
      <div
        ref={adRef}
        className="min-w-[300px] min-h-[250px] flex justify-center items-center"
      />
    </div>
  );
}
