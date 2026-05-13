type RexProgressRingProps = {
  label: string;
  tone: "forge" | "profile";
};

export function RexProgressRing({ label, tone }: RexProgressRingProps) {
  return (
    <div className={`rex-progress-ring ${tone}`}>
      <span className="rex-progress-ring__core">Prototype</span>
      <strong>{label}</strong>
    </div>
  );
}
