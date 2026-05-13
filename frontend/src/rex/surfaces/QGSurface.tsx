import { RexSurfaceLayout } from "../components/RexSurfaceLayout";
import { getRexSurfaceCopy } from "../rexCopy";

const copy = getRexSurfaceCopy("qg");

export function QGSurface() {
  return <RexSurfaceLayout copy={copy} />;
}
