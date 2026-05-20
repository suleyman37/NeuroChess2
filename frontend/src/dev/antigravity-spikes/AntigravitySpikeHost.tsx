import { Suspense, lazy, useMemo } from "react";
import { getAntigravitySpikeDefinition } from "./antigravitySpikeRegistry";
import type { AntigravitySpikeDefinition, AntigravitySpikeHostRoute } from "./antigravitySpikeTypes";
import "./antigravitySpikeStyles.css";

export type { AntigravitySpikeHostRoute } from "./antigravitySpikeTypes";

type AntigravitySpikeHostProps = {
  route: AntigravitySpikeHostRoute;
};

const reservedVariantLabels = [
  "Premium Clarity",
  "Signature Identity",
  "Radical but Board-Safe",
];

function AntigravitySpikePlaceholder({ spike }: { spike: AntigravitySpikeDefinition }) {
  return (
    <section className="ag-spike-placeholder" data-testid="antigravity-spike-placeholder">
      <div className="ag-spike-band">
        <p>Awaiting revised Patch Proposal Pack</p>
        <strong>No Antigravity code has been imported for this spike yet.</strong>
      </div>
      <div className="ag-spike-variant-grid" aria-label="Reserved visual variant slots">
        {reservedVariantLabels.map((label, index) => (
          <article className="ag-spike-variant-slot" data-testid="antigravity-spike-variant-slot" key={label}>
            <span>{`Slot ${index + 1}`}</span>
            <h2>{label}</h2>
            <p>
              Reserved for a sandbox proposal that passes Codex validation,
              rollback proof, and screenshot review.
            </p>
          </article>
        ))}
      </div>
      <div className="ag-spike-surface" data-testid="antigravity-spike-allowed-surface">
        <h2>Allowed future import surface</h2>
        <ul>
          {spike.allowedPaths.map((allowedPath) => (
            <li key={allowedPath}>{allowedPath}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function UnknownSpike({ spikeId }: { spikeId: string }) {
  return (
    <main className="antigravity-spike-host" data-testid="antigravity-spike-host">
      <section className="ag-spike-hero">
        <p>DEV-only Antigravity spike host</p>
        <h1>Unknown spike</h1>
        <span data-testid="antigravity-spike-id">{spikeId}</span>
      </section>
      <section className="ag-spike-placeholder">
        <div className="ag-spike-band">
          <p>Registry miss</p>
          <strong>This route is mounted, but the requested spike id is not registered.</strong>
        </div>
      </section>
    </main>
  );
}

export function AntigravitySpikeHost({ route }: AntigravitySpikeHostProps) {
  const spike = getAntigravitySpikeDefinition(route.spikeId);

  const SpikeComponent = useMemo(() => {
    if (!spike?.componentLoader) {
      return null;
    }
    return lazy(spike.componentLoader);
  }, [spike]);

  if (!spike) {
    return <UnknownSpike spikeId={route.spikeId} />;
  }

  return (
    <main className="antigravity-spike-host" data-testid="antigravity-spike-host">
      <section className="ag-spike-hero">
        <p>DEV-only Antigravity spike host</p>
        <h1>{spike.title}</h1>
        <span data-testid="antigravity-spike-id">{spike.id}</span>
        <small>{spike.description}</small>
      </section>

      <section className="ag-spike-contract" data-testid="antigravity-spike-registry-entry">
        <div>
          <p>Status</p>
          <strong>{spike.status}</strong>
        </div>
        <div>
          <p>Objective</p>
          <strong>{spike.objective}</strong>
        </div>
        <div>
          <p>Route</p>
          <strong>{`/app?antigravitySpike=${spike.routeParam}`}</strong>
        </div>
      </section>

      {SpikeComponent ? (
        <Suspense fallback={<AntigravitySpikePlaceholder spike={spike} />}>
          <SpikeComponent spike={spike} />
        </Suspense>
      ) : (
        <AntigravitySpikePlaceholder spike={spike} />
      )}
    </main>
  );
}
