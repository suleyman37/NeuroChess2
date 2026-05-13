import { RexSurfaceLayout } from "../components/RexSurfaceLayout";
import { getRexSurfaceCopy } from "../rexCopy";

const copy = getRexSurfaceCopy("parties");

export function PartiesSurface() {
  return <RexSurfaceLayout copy={copy} />;
}
