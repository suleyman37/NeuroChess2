import { RexSurfaceLayout } from "../components/RexSurfaceLayout";
import { getRexSurfaceCopy } from "../rexCopy";

const copy = getRexSurfaceCopy("arene");

export function ArenaSurface() {
  return <RexSurfaceLayout copy={copy} />;
}
