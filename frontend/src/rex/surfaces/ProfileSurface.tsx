import { RexSurfaceLayout } from "../components/RexSurfaceLayout";
import { getRexSurfaceCopy } from "../rexCopy";

const copy = getRexSurfaceCopy("profil");

export function ProfileSurface() {
  return <RexSurfaceLayout copy={copy} />;
}
