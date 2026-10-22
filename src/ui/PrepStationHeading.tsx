import { useState } from 'react';
import { PREPARATION_ART } from '../platform/preparation-art';
import artSizes from '../platform/preparation-art-sizes.json';

type Station = 'physician' | 'merchant' | 'blacksmith';
const seals: Record<Station, string> = { physician: '醫', merchant: '商', blacksmith: '鍛' };

export function PrepStationHeading({
  station,
  id,
  title,
  role,
  greeting,
}: {
  station: Station;
  id: string;
  title: string;
  role: string;
  greeting: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <header className="prep-service-title">
      <span className="prep-station-seal" aria-hidden="true">
        {seals[station]}
      </span>
      <div className="prep-station-copy">
        <small>{role}</small>
        <h2 id={id}>{title}</h2>
        <p>{greeting}</p>
      </div>
      {!failed && (
        <img
          className="prep-npc"
          src={PREPARATION_ART[station]}
          width={artSizes[station].width}
          height={artSizes[station].height}
          alt=""
          decoding="async"
          onError={() => setFailed(true)}
        />
      )}
    </header>
  );
}
