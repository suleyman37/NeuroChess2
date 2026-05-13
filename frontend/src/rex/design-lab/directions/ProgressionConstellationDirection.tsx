const nodes = [
  { label: "Répertoire", x: 18, y: 54, className: "node-a" },
  { label: "Calcul", x: 37, y: 28, className: "node-b" },
  { label: "Defense", x: 57, y: 62, className: "node-c" },
  { label: "Plan", x: 76, y: 34, className: "node-d" },
  { label: "Transfert", x: 83, y: 72, className: "node-e" },
];

export function ProgressionConstellationDirection() {
  return (
    <section
      className="rex-design-preview-panel rex-design-preview-panel--constellation"
      aria-label="Apercu Progression Constellation"
    >
      <div className="rex-preview-topbar">
        <span>Progression Constellation</span>
        <em>profil et répertoire</em>
      </div>
      <div className="rex-constellation-field" aria-hidden="true">
        <svg viewBox="0 0 100 100" role="presentation">
          <path className="rex-constellation-link link-a" d="M18 54 L37 28 L57 62 L76 34 L83 72 L57 62 L18 54" />
          {nodes.map((node) => (
            <g className={`rex-constellation-node ${node.className}`} key={node.label}>
              <circle cx={node.x} cy={node.y} r="3.2" />
              <text x={node.x + 4} y={node.y - 3}>
                {node.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <div className="rex-constellation-copy">
        <p>Monde personnel</p>
        <h3>Le Profil devient la carte de progression longue durée.</h3>
        <span>Chaque nœud devra être relié à une preuve, une limite et une action.</span>
      </div>
      <div className="rex-constellation-stages">
        <span>non confirme</span>
        <span>fragile</span>
        <span>en progression</span>
        <span>confirmé</span>
      </div>
    </section>
  );
}
