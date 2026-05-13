import { RexSurfaceLayout } from "../components/RexSurfaceLayout";
import { getRexSurfaceCopy } from "../rexCopy";

const copy = getRexSurfaceCopy("forge");

export function ForgeSurface() {
  return <RexSurfaceLayout copy={copy} />;
}
