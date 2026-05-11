import { useState, type Dispatch, type SetStateAction } from "react";
import { VisionMiniBoard } from "./VisionMiniBoard";
import { visionProfile } from "./visionMockData";
import type { VisionState } from "./visionState";

type ProfileVisionProps = {
  state: VisionState;
  setState: Dispatch<SetStateAction<VisionState>>;
  onBack: () => void;
};

export function ProfileVision({ state, setState, onBack }: ProfileVisionProps) {
  const [pieceStyle, setPieceStyle] = useState(visionProfile.board.pieceStyles[0]);
  const [boardTheme, setBoardTheme] = useState(visionProfile.board.themes[0]);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [soundsEnabled, setSoundsEnabled] = useState(false);
  const [language, setLanguage] = useState(visionProfile.app.languages[0]);
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [hideEvaluation, setHideEvaluation] = useState(false);
  const [detailLevel, setDetailLevel] = useState(visionProfile.app.detailLevels[0]);

  return (
    <section className="v2-vision-screen v2-vision-profile" data-testid="v2-vision-profile">
      <header className="v2-vision-section-head">
        <div>
          <span className="v2-vision-kicker">Profil / Paramètres</span>
          <h2>Contrôler ton expérience</h2>
          <p className="v2-vision-section-subtitle">
            Préférences d'échiquier, connexions prévues et données dans une vue calme.
          </p>
        </div>
        <button className="v2-vision-ghost" type="button" onClick={onBack}>Retour</button>
      </header>

      <section className="v2-vision-panel v2-vision-profile-identity" data-testid="v2-vision-profile-identity">
        <div className="v2-vision-avatar" aria-hidden="true">{visionProfile.user.initials}</div>
        <div>
          <span className="v2-vision-kicker">Identité</span>
          <h3>{visionProfile.user.handle}</h3>
          <p>{visionProfile.user.platform} · {visionProfile.user.status}</p>
        </div>
        <button className="v2-vision-secondary" type="button">Modifier</button>
      </section>

      <div className="v2-vision-profile-grid">
        <article className="v2-vision-panel v2-vision-profile-connections" data-testid="v2-vision-profile-connections">
          <span className="v2-vision-kicker">Connexions</span>
          <h3>Connexions futures</h3>
          <p className="v2-vision-panel-note">Prévu pour automatiser l'import plus tard, sans synchronisation active ici.</p>
          <div className="v2-vision-connection-list">
            {visionProfile.connections.map((connection) => (
              <div className="v2-vision-connection-card" key={connection.name}>
                <div>
                  <strong>{connection.name}</strong>
                  <span>{connection.status}</span>
                  <p>{connection.detail}</p>
                </div>
                <span className="v2-vision-connection-state" aria-label={`${connection.name} ${connection.status}`}>
                  {connection.action}
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="v2-vision-panel v2-vision-board-preferences" data-testid="v2-vision-profile-board-preferences">
          <span className="v2-vision-kicker">Apparence de l'échiquier</span>
          <h3>Un espace de jeu à ton goût</h3>
          <div className="v2-vision-board-preference-body">
            <VisionMiniBoard
              fen={visionProfile.board.preview.fen}
              highlightSquare={visionProfile.board.preview.highlightSquare}
              arrow={visionProfile.board.preview.arrow}
              size="md"
              mood="active"
              label={visionProfile.board.preview.label}
              testId="v2-vision-profile-board-preview"
            />
            <div className="v2-vision-preference-groups">
              <PreferenceButtons
                label="Style pièces"
                options={visionProfile.board.pieceStyles}
                selected={pieceStyle}
                onSelect={setPieceStyle}
              />
              <PreferenceButtons
                label="Thème cases"
                options={visionProfile.board.themes}
                selected={boardTheme}
                onSelect={setBoardTheme}
              />
              <ToggleSwitch
                label="Animations du board"
                description="Transitions douces pendant les tentatives."
                enabled={animationsEnabled}
                onChange={setAnimationsEnabled}
              />
              <ToggleSwitch
                label="Sons de déplacement"
                description="Feedback sonore discret."
                enabled={soundsEnabled}
                onChange={setSoundsEnabled}
              />
            </div>
          </div>
        </article>

        <article className="v2-vision-panel v2-vision-app-preferences" data-testid="v2-vision-profile-app-preferences">
          <span className="v2-vision-kicker">Préférences app</span>
          <h3>Régler le niveau de détail</h3>
          <label>
            <span>Langue</span>
            <select value={language} onChange={(event) => setLanguage(event.target.value)}>
              {visionProfile.app.languages.map((option) => <option value={option} key={option}>{option}</option>)}
            </select>
          </label>
          <ToggleSwitch
            label="Rappels doux"
            description="Un rappel calme quand une décision revient."
            enabled={remindersEnabled}
            onChange={setRemindersEnabled}
          />
          <ToggleSwitch
            label="Masquer l'évaluation"
            description="Afficher d'abord l'idée, puis le bilan."
            enabled={hideEvaluation}
            onChange={setHideEvaluation}
          />
          <label>
            <span>Niveau de détails</span>
            <select value={detailLevel} onChange={(event) => setDetailLevel(event.target.value)}>
              {visionProfile.app.detailLevels.map((option) => <option value={option} key={option}>{option}</option>)}
            </select>
          </label>
        </article>

        <article className="v2-vision-panel v2-vision-data-safety" data-testid="v2-vision-profile-data-safety">
          <span className="v2-vision-kicker">Données et confidentialité</span>
          <h3>Données et confidentialité</h3>
          <p className="v2-vision-panel-note">
            Exporter reste une action utile. Toute suppression demande confirmation.
          </p>
          <div className="v2-vision-data-actions">
            <button className="v2-vision-secondary" type="button">Exporter mes données</button>
          </div>
          <div className="v2-vision-profile-danger-zone" data-testid="v2-vision-profile-danger-zone">
            <div>
              <strong>Zone de suppression</strong>
              <p>La confirmation empêche toute action accidentelle ici.</p>
            </div>
            <div className="v2-vision-profile-danger-actions">
              <button
                className="v2-vision-danger v2-vision-danger-subtle"
                type="button"
                onClick={() => setState((current) => ({ ...current, profileDeleteConfirm: true }))}
              >
                Supprimer mes données
              </button>
            </div>
          </div>
          {state.profileDeleteConfirm && (
            <div className="v2-vision-confirm" data-testid="v2-vision-profile-delete-confirm">
              <p>Confirmation requise. Aucune donnée n'est supprimée ici.</p>
              <button className="v2-vision-ghost" type="button" onClick={() => setState((current) => ({ ...current, profileDeleteConfirm: false }))}>
                Annuler
              </button>
            </div>
          )}
        </article>
      </div>
    </section>
  );
}

type PreferenceButtonsProps = {
  label: string;
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
};

function PreferenceButtons({ label, options, selected, onSelect }: PreferenceButtonsProps) {
  return (
    <div className="v2-vision-preference-group">
      <span>{label}</span>
      <div>
        {options.map((option) => (
          <button
            className={option === selected ? "is-active" : ""}
            type="button"
            key={option}
            aria-pressed={option === selected}
            onClick={() => onSelect(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

type ToggleSwitchProps = {
  label: string;
  description: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
};

function ToggleSwitch({ label, description, enabled, onChange }: ToggleSwitchProps) {
  return (
    <div className="v2-vision-switch-row">
      <div>
        <strong>{label}</strong>
        <span>{description}</span>
        <small className="v2-vision-switch-state">{enabled ? "Activé" : "Désactivé"}</small>
      </div>
      <button
        className={`v2-vision-switch ${enabled ? "is-on" : "is-off"}`}
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={`${label}: ${enabled ? "activé" : "désactivé"}`}
        onClick={() => onChange(!enabled)}
      >
        <span aria-hidden="true" />
      </button>
    </div>
  );
}
