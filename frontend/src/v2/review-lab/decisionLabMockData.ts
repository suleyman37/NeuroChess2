export type DecisionLabMode = "summary" | "learn" | "replay" | "explore";

export type DecisionLabFilter = "priority" | "review" | "good" | "all";

export type DecisionLabTone = "good" | "warning" | "neutral" | "info";
export type DecisionLabScoreBand = "strong" | "solid" | "watch" | "fragile";

export type DecisionLabBranchMove = {
  san: string;
  badge: string;
  note: string;
};

export type DecisionLabMoment = {
  id: string;
  moveNumber: number;
  sideToMove: "Blancs" | "Noirs";
  playedMoveSan: string;
  verdictSymbol: string;
  verdictLabel: string;
  verdictTone: DecisionLabTone;
  category: string;
  shortCategory: string;
  whyItMatters: string;
  practicalImpact: string;
  betterIdea: string;
  recommendedAction: string;
  learnKeyIdea: string;
  learnWhy: string;
  learnChecklist: string[];
  learnTakeaway: string;
  miniLine: string[];
  replayGoal: string;
  replayInstruction: string;
  replayHint: string;
  replayFeedbackGood: string;
  replayFeedbackWrong: string;
  explorerBranchSummary: string;
  explorerLastMove: string;
  explorerResultBeforeAnalysis: string;
  explorerResultAfterAnalysis: string;
  explorerTakeaway: string;
  neuroScore: number;
  neuroScoreBand: DecisionLabScoreBand;
  canReplay: boolean;
  canPractice: boolean;
  canExplore: boolean;
  lineAvailable: boolean;
  suggestedPrimaryAction: string;
  learnTags: string[];
  boardFen: string;
  highlightSquares: string[];
  arrow: [string, string, string?];
  line: string[];
  branchMock: DecisionLabBranchMove[];
  explorerLine: string[];
  details: {
    decision: string;
    line: string;
    score: string;
    moments: string;
    legend: string;
  };
  verdict: string;
  badge: string;
  learnCue: string;
  takeaway: string;
};

export const decisionLabModes: Array<{ id: DecisionLabMode; label: string; hint: string }> = [
  {
    id: "summary",
    label: "Résumé",
    hint: "Comprends ce qui a fait basculer la position.",
  },
  {
    id: "learn",
    label: "Apprendre",
    hint: "Isole l'idée à retenir.",
  },
  {
    id: "replay",
    label: "Rejouer",
    hint: "Retrouve le plan sans aide.",
  },
  {
    id: "explore",
    label: "Explorer",
    hint: "Teste une alternative sans l'enregistrer.",
  },
];

export const decisionLabMoments: DecisionLabMoment[] = [
  buildMoment({
    id: "tactical-error",
    moveNumber: 17,
    sideToMove: "Blancs",
    playedMoveSan: "Qxb7?",
    verdictSymbol: "?",
    verdictLabel: "À revoir",
    verdictTone: "warning",
    category: "Erreur tactique",
    shortCategory: "Tactique",
    whyItMatters: "Tu gagnes un pion, mais tu laisses une ressource active aux Noirs.",
    practicalImpact: "La défense du roi devient fragile et la dame perd son rôle défensif.",
    betterIdea: "Consolider avant de prendre du matériel.",
    recommendedAction: "Rejoue ce moment, puis compare avec la ligne.",
    learnKeyIdea: "Cherche les coups forcing avant de prendre le matériel.",
    learnWhy: "Le gain immédiat peut ouvrir une ressource adverse plus forte que le pion gagné.",
    learnChecklist: ["Échecs", "Captures", "Menaces", "Roi faible"],
    learnTakeaway: "Un pion gagné ne compense pas une défense désorganisée.",
    miniLine: ["Qxb7?", "Rxb7", "Bxb7", "Qxb7"],
    replayGoal: "Retrouve le meilleur plan sans afficher la correction.",
    replayInstruction: "Joue pour neutraliser le contre-jeu adverse.",
    replayHint: "Commence par vérifier l'échec ou la capture adverse la plus forcing.",
    replayFeedbackGood: "Bien joué : tu as sécurisé le roi avant de chercher le gain matériel.",
    replayFeedbackWrong: "À revoir : tu as encore laissé la ressource active des Noirs.",
    explorerBranchSummary: "Branche · 3 coups",
    explorerLastMove: "Qxc3",
    explorerResultBeforeAnalysis: "Non analysé",
    explorerResultAfterAnalysis: "Ligne analysée · Jouable",
    explorerTakeaway: "Le dernier coup reste défendable, mais donne une ressource.",
    neuroScore: 58,
    neuroScoreBand: "watch",
    canReplay: true,
    canExplore: true,
    lineAvailable: true,
    suggestedPrimaryAction: "Rejouer ce moment",
    learnTags: ["Forcing moves", "Défense du roi", "Ressource active", "Contre-jeu"],
    boardFen: "r1b3k1/1Q3ppp/2n1p3/p2P4/4N3/2B2N2/6PP/R1R3K1 w - - 0 17",
    highlightSquares: ["b7", "g1", "c6"],
    arrow: ["c6", "b4", "rgba(246, 172, 87, 0.82)"],
    branchMock: [
      { san: "Bxf7+", badge: "!", note: "Force le roi" },
      { san: "Nxf7", badge: "=", note: "Défense tenable" },
      { san: "Qxc3", badge: "?", note: "Ressource à vérifier" },
    ],
    details: {
      decision: "La capture semble naturelle, mais elle retire la dame d'une zone défensive importante.",
      line: "Qxb7? Rxb7 Bxb7 Qxb7 montre que le gain matériel initial ne tient pas.",
      score: "NeuroScore coach: à consolider, sans valeur scientifique absolue.",
      moments: "Moment prioritaire: tactique forcing, sécurité du roi et coordination.",
      legend: "? = à revoir, ! = ressource forte, = = jouable.",
    },
  }),
  buildMoment({
    id: "conversion-miss",
    moveNumber: 24,
    sideToMove: "Noirs",
    playedMoveSan: "Rd8?!",
    verdictSymbol: "?!",
    verdictLabel: "Conversion mal gérée",
    verdictTone: "warning",
    category: "Conversion",
    shortCategory: "Conversion",
    whyItMatters: "Le coup garde l'avantage, mais laisse les Blancs simplifier trop vite.",
    practicalImpact: "La finale reste meilleure, mais le plan devient plus difficile à convertir.",
    betterIdea: "Améliorer la pièce la moins active avant de forcer les échanges.",
    recommendedAction: "Comprends le plan de conversion avant d'explorer.",
    learnKeyIdea: "Quand tu es mieux, force seulement après avoir coordonné tes pièces.",
    learnWhy: "Un échange prématuré réduit la pression et aide l'adversaire à défendre.",
    learnChecklist: ["Pièce active", "Case d'entrée", "Échange utile", "Roi adverse"],
    learnTakeaway: "Convertir, c'est garder les problèmes adverses plus longtemps.",
    miniLine: ["Rd8?!", "Rxd8+", "Qxd8", "Qe2"],
    replayGoal: "Retrouve un plan de conversion qui garde la pression.",
    replayInstruction: "Choisis le coup qui améliore la coordination avant l'échange.",
    replayHint: "Regarde quelle pièce noire n'a pas encore de rôle utile.",
    replayFeedbackGood: "Bien joué : tu as conservé la pression avant de simplifier.",
    replayFeedbackWrong: "À revoir : l'échange arrive trop tôt dans ton plan.",
    explorerBranchSummary: "Branche · 3 coups",
    explorerLastMove: "Qxd1",
    explorerResultBeforeAnalysis: "Non analysé",
    explorerResultAfterAnalysis: "Ligne analysée · Solide",
    explorerTakeaway: "La ligne reste saine si la pression est maintenue.",
    neuroScore: 66,
    neuroScoreBand: "watch",
    canReplay: true,
    canExplore: true,
    lineAvailable: true,
    suggestedPrimaryAction: "Rejouer ce moment",
    learnTags: ["Conversion", "Coordination", "Pièce active", "Tempo"],
    boardFen: "3r2k1/5ppp/4p3/p1n5/3Q4/5N2/4RPPP/6K1 b - - 0 24",
    highlightSquares: ["d8", "d4", "c5"],
    arrow: ["c5", "e4", "rgba(71, 211, 230, 0.78)"],
    branchMock: [
      { san: "Qe7", badge: "=", note: "Garde la pression" },
      { san: "Rxd1+", badge: "!", note: "Simplifie au bon moment" },
      { san: "Qxd1", badge: "=", note: "Conversion claire" },
    ],
    details: {
      decision: "Le plan de conversion manque de patience, mais l'avantage n'est pas perdu.",
      line: "Qe7 garde la pression et retarde l'échange jusqu'au bon moment.",
      score: "NeuroScore coach: à consolider.",
      moments: "Moment utile pour apprendre à convertir sans relâcher la tension.",
      legend: "?! = précision à améliorer, = = plan jouable.",
    },
  }),
  buildMoment({
    id: "good-defense",
    moveNumber: 31,
    sideToMove: "Blancs",
    playedMoveSan: "Kh2!",
    verdictSymbol: "✓",
    verdictLabel: "Bonne décision",
    verdictTone: "good",
    category: "Bonne défense",
    shortCategory: "Défense",
    whyItMatters: "Le roi sort du motif tactique et coupe l'initiative adverse.",
    practicalImpact: "La position reste sous contrôle malgré la pression.",
    betterIdea: "Garder une case de fuite avant de chercher du contre-jeu.",
    recommendedAction: "Lis la ligne pour ancrer le réflexe défensif.",
    learnKeyIdea: "Un coup calme peut être le coup le plus concret.",
    learnWhy: "La défense ne consiste pas toujours à répondre à une menace visible: parfois elle l'empêche.",
    learnChecklist: ["Case de fuite", "Échec adverse", "Pièce clouée", "Coordination"],
    learnTakeaway: "La prophylaxie gagne du temps quand l'attaque adverse dépend d'un motif précis.",
    miniLine: ["Kh2!", "Qd6+", "Kg1", "Re8"],
    replayGoal: "Reconnais le coup calme qui neutralise la menace.",
    replayInstruction: "Trouve la case qui retire le motif tactique.",
    replayHint: "Demande-toi quel échec adverse serait gênant au prochain coup.",
    replayFeedbackGood: "Bien joué : le roi sort du motif au bon moment.",
    replayFeedbackWrong: "À revoir : tu as laissé le roi dans la zone tactique.",
    explorerBranchSummary: "Branche · 2 coups",
    explorerLastMove: "Qd6+",
    explorerResultBeforeAnalysis: "Non analysé",
    explorerResultAfterAnalysis: "Coup analysé · Défendable",
    explorerTakeaway: "Le coup calme reste la solution la plus robuste.",
    neuroScore: 91,
    neuroScoreBand: "strong",
    canReplay: false,
    canExplore: true,
    lineAvailable: true,
    suggestedPrimaryAction: "Voir la ligne",
    learnTags: ["Défense du roi", "Case de fuite", "Prophylaxie", "Bon coup"],
    boardFen: "6k1/5ppp/3q4/8/8/5N2/6PP/5RK1 w - - 0 31",
    highlightSquares: ["g1", "h2", "d6"],
    arrow: ["g1", "h2", "rgba(51, 197, 145, 0.82)"],
    branchMock: [
      { san: "Kh2", badge: "✓", note: "Sort de la menace" },
      { san: "Qd6+", badge: "=", note: "Échec contenu" },
    ],
    details: {
      decision: "Kh2! neutralise le motif avant qu'il ne devienne forcé.",
      line: "Kh2! Qd6+ Kg1 conserve la coordination.",
      score: "NeuroScore coach: très solide.",
      moments: "Bon coup défensif à conserver comme repère.",
      legend: "✓ = bonne décision, ! = coup fort.",
    },
  }),
  buildMoment({
    id: "micro-gap",
    moveNumber: 12,
    sideToMove: "Noirs",
    playedMoveSan: "h6",
    verdictSymbol: "=",
    verdictLabel: "Micro-écart",
    verdictTone: "neutral",
    category: "Micro-écart",
    shortCategory: "Micro",
    whyItMatters: "Le coup est jouable, mais ne pose pas la question la plus difficile.",
    practicalImpact: "Tu gardes une position saine, avec moins d'initiative.",
    betterIdea: "Chercher une amélioration active avant le coup utile.",
    recommendedAction: "Explore une alternative plus active si tu veux tester le plan.",
    learnKeyIdea: "Distingue coup utile et coup qui crée un problème.",
    learnWhy: "Un bon coup pratique doit parfois demander une réponse concrète à l'adversaire.",
    learnChecklist: ["Menace créée", "Amélioration", "Réponse forcée", "Risque"],
    learnTakeaway: "Un micro-écart n'est pas une erreur: c'est une occasion d'être plus précis.",
    miniLine: ["h6", "Bh4", "g5"],
    replayGoal: "Comparer le coup utile avec une option plus active.",
    replayInstruction: "Choisis une amélioration qui demande une réponse.",
    replayHint: "Regarde si un pion peut gagner un tempo sur une pièce.",
    replayFeedbackGood: "Bien joué : tu as créé une question concrète.",
    replayFeedbackWrong: "À revoir : le plan reste trop passif.",
    explorerBranchSummary: "Branche · 2 coups",
    explorerLastMove: "Bg3",
    explorerResultBeforeAnalysis: "Non analysé",
    explorerResultAfterAnalysis: "Ligne analysée · Jouable",
    explorerTakeaway: "La ligne active tient sans créer de faiblesse immédiate.",
    neuroScore: 74,
    neuroScoreBand: "solid",
    canReplay: false,
    canExplore: true,
    lineAvailable: false,
    suggestedPrimaryAction: "Explorer depuis ici",
    learnTags: ["Ressource active", "Initiative", "Micro-écart", "Plan calme"],
    boardFen: "r1b2rk1/pp3ppp/2n1p3/3p4/3P2B1/5N2/PP3PPP/R4RK1 b - - 0 12",
    highlightSquares: ["h6", "g5", "g4"],
    arrow: ["g7", "g5", "rgba(71, 211, 230, 0.78)"],
    branchMock: [
      { san: "g5", badge: "=", note: "Plan actif" },
      { san: "Bg3", badge: "◌", note: "À analyser" },
    ],
    details: {
      decision: "h6 est utile, mais ne change pas assez la dynamique.",
      line: "g5 cherche une question concrète avant de stabiliser.",
      score: "NeuroScore coach: solide.",
      moments: "Moment informatif: apprendre à choisir entre utile et actif.",
      legend: "= = jouable, ◌ = non analysé.",
    },
  }),
  buildMoment({
    id: "replay-training",
    moveNumber: 19,
    sideToMove: "Blancs",
    playedMoveSan: "Bxe6!",
    verdictSymbol: "!",
    verdictLabel: "Moment entraînable",
    verdictTone: "good",
    category: "Tactique forcing",
    shortCategory: "Reprise",
    whyItMatters: "Le sacrifice ouvre la colonne et force une séquence courte.",
    practicalImpact: "Tu gardes l'initiative si tu calcules jusqu'à la stabilisation.",
    betterIdea: "Calculer les réponses forcées avant de juger le sacrifice.",
    recommendedAction: "Rejoue la séquence jusqu'au dernier coup forcé.",
    learnKeyIdea: "Quand tout est forcing, calcule jusqu'au calme.",
    learnWhy: "Une séquence tactique ne se juge pas au premier coup spectaculaire.",
    learnChecklist: ["Échec", "Capture", "Réponse forcée", "Position finale"],
    learnTakeaway: "Le sacrifice fonctionne parce que l'adversaire manque de choix utiles.",
    miniLine: ["Bxe6!", "fxe6", "Qxe6+", "Kh8"],
    replayGoal: "Retrouve la séquence forcing sans aide.",
    replayInstruction: "Commence par le coup qui ouvre la colonne.",
    replayHint: "La première capture attire le pion noir sur une case vulnérable.",
    replayFeedbackGood: "Bien joué : tu as calculé jusqu'à l'échec décisif.",
    replayFeedbackWrong: "À revoir : la séquence s'arrête trop tôt.",
    explorerBranchSummary: "Branche · 4 coups",
    explorerLastMove: "Kh8",
    explorerResultBeforeAnalysis: "Non analysé",
    explorerResultAfterAnalysis: "Ligne analysée · Très solide",
    explorerTakeaway: "La ligne confirme que le sacrifice garde l'initiative.",
    neuroScore: 88,
    neuroScoreBand: "strong",
    canReplay: true,
    canExplore: true,
    lineAvailable: true,
    suggestedPrimaryAction: "Rejouer ce moment",
    learnTags: ["Échecs / captures", "Calcul court", "Sacrifice", "Tactique"],
    boardFen: "r4rk1/5ppp/4p3/3q4/8/2B2N2/5PPP/R2Q1RK1 w - - 0 19",
    highlightSquares: ["c3", "e6", "d1"],
    arrow: ["c3", "e6", "rgba(51, 197, 145, 0.82)"],
    branchMock: [
      { san: "Bxe6!", badge: "!", note: "Ouvre la colonne" },
      { san: "fxe6", badge: "=", note: "Forcé" },
      { san: "Qxe6+", badge: "!", note: "Ressource clé" },
      { san: "Kh8", badge: "=", note: "Seule défense" },
    ],
    details: {
      decision: "Le sacrifice fonctionne car chaque réponse noire est contrainte.",
      line: "Bxe6! fxe6 Qxe6+ Kh8 garde l'initiative.",
      score: "NeuroScore coach: très solide.",
      moments: "Moment idéal pour la reprise guidée.",
      legend: "! = coup fort, = = réponse forcée ou jouable.",
    },
  }),
  buildMoment({
    id: "explore-branch",
    moveNumber: 27,
    sideToMove: "Noirs",
    playedMoveSan: "Nc5",
    verdictSymbol: "↻",
    verdictLabel: "À explorer",
    verdictTone: "info",
    category: "Choix de plan",
    shortCategory: "Explorer",
    whyItMatters: "La position offre plusieurs plans jouables et le choix change la finale.",
    practicalImpact: "Le mauvais plan ne perd pas, mais il peut rendre la défense plus longue.",
    betterIdea: "Comparer le type de finale obtenu avant de choisir.",
    recommendedAction: "Explore deux coups candidats puis analyse la ligne.",
    learnKeyIdea: "Quand plusieurs plans tiennent, compare les positions finales.",
    learnWhy: "Deux lignes égales peuvent produire des finales très différentes à jouer.",
    learnChecklist: ["Structure", "Pièces actives", "Finale visée", "Risque pratique"],
    learnTakeaway: "Explorer sert à choisir une position que tu comprends, pas à chercher du bruit.",
    miniLine: ["Nc5", "Qd4", "Ne6", "Qxd6"],
    replayGoal: "Choisir le plan qui garde la finale la plus claire.",
    replayInstruction: "Identifie le coup qui garde les pièces coordonnées.",
    replayHint: "Compare les cases de sortie du cavalier.",
    replayFeedbackGood: "Bien joué : le plan garde une structure défendable.",
    replayFeedbackWrong: "À revoir : la finale devient plus passive.",
    explorerBranchSummary: "Branche · 3 coups",
    explorerLastMove: "Ne6",
    explorerResultBeforeAnalysis: "Non analysé",
    explorerResultAfterAnalysis: "Ligne analysée · Jouable",
    explorerTakeaway: "Cette exploration ne crée pas d'exercice et reste locale.",
    neuroScore: 81,
    neuroScoreBand: "solid",
    canReplay: false,
    canExplore: true,
    lineAvailable: true,
    suggestedPrimaryAction: "Explorer depuis ici",
    learnTags: ["Choix de plan", "Finale", "Structure", "Ressource active"],
    boardFen: "6k1/5ppp/3p4/2n5/3Q4/4N3/5PPP/6K1 b - - 0 27",
    highlightSquares: ["c5", "e6", "d4"],
    arrow: ["c5", "e6", "rgba(97, 165, 236, 0.82)"],
    branchMock: [
      { san: "Nc5", badge: "=", note: "Plan stable" },
      { san: "Qd4", badge: "◌", note: "Test blanc" },
      { san: "Ne6", badge: "◌", note: "Branche locale" },
    ],
    details: {
      decision: "Le coup preserve plusieurs plans, mais l'ordre change la finale visée.",
      line: "Nc5 Qd4 Ne6 conserve une structure défendable et laisse du jeu.",
      score: "NeuroScore coach: solide.",
      moments: "Moment exploratoire: comparer les plans sans enregistrer.",
      legend: "↻ = à recalculer, ◌ = non analysé.",
    },
  }),
];

export const defaultDecisionLabMomentId = decisionLabMoments[0]?.id ?? "";

function buildMoment(moment: Omit<DecisionLabMoment, "verdict" | "badge" | "learnCue" | "takeaway" | "line" | "explorerLine" | "canPractice"> & { canReplay: boolean }): DecisionLabMoment {
  const line = moment.miniLine;
  return {
    ...moment,
    canPractice: moment.canReplay,
    verdict: moment.verdictLabel,
    badge: moment.verdictSymbol,
    learnCue: moment.learnKeyIdea,
    takeaway: moment.learnTakeaway,
    line,
    explorerLine: moment.branchMock.map((move) => move.san),
  };
}
