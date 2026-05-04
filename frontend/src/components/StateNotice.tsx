import type { ReactNode } from "react";

export type StateNoticeVariant = "info" | "warning" | "danger" | "success";

type StateNoticeProps = {
  variant?: StateNoticeVariant;
  title: string;
  message: string;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  compact?: boolean;
  details?: string | ReactNode | null;
  testId?: string;
};

export function StateNotice({
  variant = "info",
  title,
  message,
  primaryActionLabel,
  onPrimaryAction,
  secondaryActionLabel,
  onSecondaryAction,
  compact = false,
  details,
  testId,
}: StateNoticeProps) {
  return (
    <section
      className={`state-notice state-notice-${variant}${compact ? " state-notice-compact" : ""}`}
      data-testid={testId}
      role={variant === "danger" ? "alert" : "status"}
    >
      <div className="state-notice-copy">
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
      {(primaryActionLabel || secondaryActionLabel) && (
        <div className="state-notice-actions">
          {primaryActionLabel && (
            <button
              type="button"
              className="primary"
              onClick={onPrimaryAction}
              disabled={!onPrimaryAction}
            >
              {primaryActionLabel}
            </button>
          )}
          {secondaryActionLabel && (
            <button type="button" onClick={onSecondaryAction} disabled={!onSecondaryAction}>
              {secondaryActionLabel}
            </button>
          )}
        </div>
      )}
      {details && (
        <details className="state-notice-details">
          <summary>Détails techniques</summary>
          {typeof details === "string" ? <pre>{details}</pre> : details}
        </details>
      )}
    </section>
  );
}
