import type { RexSurfaceCopy, RexSurfaceId } from "./rexTypes";

export const rexPrototypeLabel = "Prototype REX - données illustratives";

export const rexSurfaceCopies: Record<RexSurfaceId, RexSurfaceCopy> = {
  qg: {
    id: "qg",
    tone: "mission",
    visualKind: "mission-log",
    navLabel: "QG",
    testId: "rex-surface-qg",
    eyebrow: "Quartier général",
    question: "Que dois-je faire maintenant pour progresser ?",
    promise: "Un cockpit de mission : une priorité, un effort utile, zéro donnée réelle.",
    commandTitle: "Mission utile du jour",
    commandBody:
      "La hiérarchie cible devient plus simple : mission, preuve, prochain effort. Rien n'est calculé.",
    emptyTitle: "La mission du jour sera branchée plus tard.",
    emptyBody:
      "Ce bloc est un journal d'objectifs illustratif. Il prépare l'espace sans créer de plan réel ni appeler le backend.",
    ctaLabel: "Voir la mission du jour",
    signals: [
      { label: "Priorité", value: "À choisir" },
      { label: "Effort", value: "Actif" },
      { label: "Révision", value: "Prototype" },
    ],
    flow: ["Mission", "Preuve", "Effort", "Retour"],
    metrics: [
      { label: "XP disponible", value: "Prototype", note: "Réservé à un futur calcul validé." },
      { label: "Priorité", value: "À choisir", note: "Doit venir des vraies parties." },
      { label: "Révision due", value: "Exemple", note: "Aucune échéance créée ici." },
    ],
    cards: [
      {
        title: "Bloc mission",
        body: "Un seul levier d'entraînement doit dominer l'écran.",
        status: "Cockpit",
      },
      {
        title: "Décision à revoir",
        body: "Ce coup peut être mauvais ; toi, tu es en apprentissage.",
        status: "Doctrine",
      },
      {
        title: "Journal d'objectifs",
        body: "Le futur QG devra montrer ce qui a été fait et ce qui reste utile.",
        status: "Illustratif",
      },
    ],
    forbidden: ["vraie XP calculée", "métrique backend", "dashboard dense"],
  },
  parties: {
    id: "parties",
    tone: "source",
    visualKind: "source-flow",
    navLabel: "Parties",
    testId: "rex-surface-parties",
    eyebrow: "Source room",
    question: "Que disent mes vraies parties ?",
    promise: "La partie devient matière brute : import, review, décision, exercice.",
    commandTitle: "Chaîne de vérité moteur",
    commandBody:
      "La source room montre une chaîne causale : une partie entre, une décision utile sort.",
    emptyTitle: "Aucune partie n'est importée dans ce prototype.",
    emptyBody:
      "Le bouton reste un repère de navigation. Il ne lance pas d'analyse et ne crée aucune donnée.",
    ctaLabel: "Importer une partie",
    signals: [
      { label: "Source", value: "PGN" },
      { label: "Review", value: "Future" },
      { label: "Sortie", value: "À classifier" },
    ],
    flow: ["PGN", "Analyse", "Moment critique", "Exercice"],
    metrics: [
      { label: "Import PGN", value: "À venir", note: "Entrée utilisateur future." },
      { label: "Moments critiques", value: "Prototype", note: "Pas de moteur appelé." },
      { label: "Sortie d'ouverture", value: "Illustratif", note: "Pas de classification réelle." },
    ],
    cards: [
      {
        title: "Import propre",
        body: "La future surface devra guider l'entrée PGN sans bruit technique.",
        status: "Entrée",
      },
      {
        title: "Review franche",
        body: "Le système jugera les décisions de la partie, pas la personne.",
        status: "Vérité",
      },
      {
        title: "Décision rejouable",
        body: "Les moments critiques doivent devenir des actions de Forge.",
        status: "Sortie",
      },
    ],
    forbidden: ["analyse déclenchée", "nouvel appel backend", "liste morte"],
  },
  forge: {
    id: "forge",
    tone: "forge",
    visualKind: "forge-rings",
    navLabel: "Forge",
    testId: "rex-surface-forge",
    eyebrow: "Atelier d'entraînement",
    question: "Comment je transforme mes erreurs en force ?",
    promise: "Un atelier plus énergique : drills, lignes, révisions, maîtrise encore fictive.",
    commandTitle: "Erreurs transformées en drills",
    commandBody:
      "La Forge donne envie de grinder, mais chaque anneau reste un repère prototype.",
    emptyTitle: "La Forge réelle n'est pas encore codée.",
    emptyBody:
      "Ces modules sont des emplacements de travail. Aucune maîtrise ni révision n'est calculée.",
    ctaLabel: "Ouvrir la Forge",
    signals: [
      { label: "Drill", value: "Prêt" },
      { label: "Ligne", value: "Prototype" },
      { label: "Rappel", value: "Futur" },
    ],
    flow: ["Erreur", "Drill", "Révision", "Retour"],
    metrics: [
      { label: "Practice", value: "Placeholder", note: "Pas de session créée." },
      { label: "Ligne d'ouverture", value: "Exemple", note: "Pas de score réel." },
      { label: "Maîtrise", value: "Prototype", note: "Formule future requise." },
    ],
    cards: [
      {
        title: "Drill ciblé",
        body: "Rejouer les décisions utiles, avec feedback clair sur le coup.",
        status: "Atelier",
      },
      {
        title: "Ligne à consolider",
        body: "Relier la théorie à un plan jouable après la sortie du livre.",
        status: "R4",
      },
      {
        title: "Révision due",
        body: "Revoir au bon moment sans polluer le plan du jour dans R1B.",
        status: "Futur",
      },
    ],
    forbidden: ["Opening Forge réel", "score de maîtrise réel", "puzzle trainer générique"],
  },
  arene: {
    id: "arene",
    tone: "arena",
    visualKind: "arena-lanes",
    navLabel: "Arène",
    testId: "rex-surface-arene",
    eyebrow: "Transfert sous pression",
    question: "Est-ce que ce que j'ai appris passe en vraie partie ?",
    promise: "Un espace de pression contrôlée : paliers, cadences, saisons opt-in.",
    commandTitle: "Conditions réelles, lecture prudente",
    commandBody:
      "L'Arène teste la robustesse sans classement forcé ni vérité brute.",
    emptyTitle: "L'Arène n'a pas encore de données réelles.",
    emptyBody:
      "R1B pose la place du transfert, des cadences et des saisons opt-in sans compétition imposée.",
    ctaLabel: "Voir les défis de transfert",
    signals: [
      { label: "Palier", value: "Fragile" },
      { label: "Cadence", value: "À choisir" },
      { label: "Saison", value: "Opt-in" },
    ],
    flow: ["Entraînement", "Pression", "Partie réelle", "Preuve"],
    metrics: [
      { label: "Transfert", value: "Par paliers", note: "Non confirmé / fragile / en progression / confirmé." },
      { label: "Cadence", value: "Prototype", note: "Blitz, rapide, classique plus tard." },
      { label: "Saison", value: "Opt-in", note: "Pas de compétition imposée." },
    ],
    cards: [
      {
        title: "Défis de transfert",
        body: "Vérifier si l'entraînement tient quand la partie compte.",
        status: "Arène",
      },
      {
        title: "Robustesse cadence",
        body: "Mesurer la décision observable selon le contexte de jeu.",
        status: "Pression",
      },
      {
        title: "Saisons opt-in",
        body: "Compétition saine, choisie, sans tableau humiliant.",
        status: "Futur",
      },
    ],
    forbidden: ["transfert brut", "vrai classement", "leaderboard forcé"],
  },
  profil: {
    id: "profil",
    tone: "profile",
    visualKind: "profile-map",
    navLabel: "Profil",
    testId: "rex-surface-profil",
    eyebrow: "Identité de progression",
    question: "Qui suis-je comme joueur et comment je progresse ?",
    promise: "Un hub d'identité : rang prototype, répertoire, habitudes, Visual Lab en quarantaine.",
    commandTitle: "Joueur en construction",
    commandBody:
      "Le profil donne envie de progresser sans réduire la personne à une métrique.",
    emptyTitle: "Le profil REX reste illustratif.",
    emptyBody:
      "Aucune promesse de rating, aucune étiquette personnelle, aucun asset visuel externe. Le Visual Lab reste en quarantaine.",
    ctaLabel: "Voir mon profil REX",
    signals: [
      { label: "Rang", value: "Placeholder" },
      { label: "Répertoire", value: "Prototype" },
      { label: "Habitudes", value: "Exemples" },
    ],
    flow: ["Répertoire", "Habitudes", "Rang", "Identité"],
    metrics: [
      { label: "Rang", value: "Placeholder", note: "Aucun calcul de ligue." },
      { label: "Répertoire", value: "Prototype", note: "Ouvertures à brancher plus tard." },
      { label: "Habitudes", value: "Exemples", note: "Toujours liées à des coups observables." },
    ],
    cards: [
      {
        title: "Répertoire vivant",
        body: "Afficher ce que le joueur joue vraiment, avec seuil d'échantillon.",
        status: "Profil",
      },
      {
        title: "Alerte d'habitude",
        body: "Montrer des exemples de coups répétés, sans étiquette personnelle.",
        status: "Shadow first",
      },
      {
        title: "Constellation 2D",
        body: "Une piste visuelle abstraite, sans 3D et sans asset externe.",
        status: "Quarantaine",
      },
    ],
    forbidden: ["promesse de rating", "claim science", "asset visuel externe réel"],
  },
};

export function getRexSurfaceCopy(id: RexSurfaceId): RexSurfaceCopy {
  return rexSurfaceCopies[id];
}
