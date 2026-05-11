export type VisionMainTab = "today" | "games" | "training";
export type VisionOverlay = "decisionLab" | "practice" | "explorer" | "progression" | "profile" | null;
export type VisionDecisionMode = "summary" | "learn" | "replay" | "explore";
export type VisionReplayPhase = "idle" | "active" | "feedback";
export type VisionPracticePhase = "ready" | "attempting" | "feedback_success" | "feedback_wrong" | "correction";
export type VisionExplorerPhase = "initial" | "branch" | "analyzing" | "analyzed";

export type VisionMoment = {
  id: string;
  moveNumber: number;
  san: string;
  sideToMove: "Blancs" | "Noirs";
  verdict: string;
  symbol: string;
  category: string;
  shortCategory: string;
  pathStatus: "à rejouer" | "à revoir" | "compris" | "exploré";
  neuroScore: number;
  neuroBand: "strong" | "solid" | "watch" | "fragile";
  why: string;
  impact: string;
  betterIdea: string;
  action: string;
  learnIdea: string;
  learnWhy: string;
  checklist: string[];
  takeaway: string;
  line: string[];
  branch: Array<{ san: string; badge: string; note: string }>;
  fen: string;
  highlights: string[];
  arrow: [string, string, string?];
  canReplay: boolean;
  canExplore: boolean;
};

export type VisionBoardPreview = {
  fen: string;
  highlightSquare?: string;
  arrow?: { from: string; to: string };
  label: string;
};

export type VisionGameStatus = "Review prête" | "Analyse en cours" | "Erreur récupérable";

export type VisionGame = {
  id: string;
  players: string;
  result: string;
  status: VisionGameStatus;
  score: string;
  moments: string;
  exercises: string;
  userColor: "Blancs" | "Noirs";
  date: string;
  mainMoment: string;
  learningUse: string;
  statusDetail: string;
  primaryAction: string;
  tone: "ready" | "running" | "recoverable";
  boardPreview: VisionBoardPreview;
  timeline: string[];
};

export type VisionPracticeItem = {
  id: string;
  momentId: string;
  label: string;
  type: "Défense" | "Tactique" | "Conversion";
  status: "à faire" | "réussi" | "à revoir";
  source: string;
  whyReturns: string;
  instruction: string;
};

export type VisionProgressDay = {
  day: string;
  label: string;
  decisions: number;
  positions: number;
  intensity: 0 | 1 | 2 | 3 | 4;
};

export type VisionWeeklyEffort = {
  day: string;
  decisions: number;
  positions: number;
};

export type VisionConsolidatedDecision = {
  id: string;
  san: string;
  category: "Défense" | "Tactique" | "Conversion" | "Bonne décision";
  dateLabel: string;
  status: "revu" | "réussi" | "à revoir";
  boardPreview: VisionBoardPreview;
};

export type VisionProgressDomain = {
  label: "Défense" | "Tactique" | "Conversion";
  state: "à consolider" | "en progrès" | "stable";
  decisions: number;
  tone: "watch" | "progress" | "stable";
};

export type VisionProfileConnection = {
  name: string;
  status: "Prévu" | "Bientôt" | "Disponible";
  detail: string;
  action: string;
};

export type VisionProfileData = {
  user: {
    initials: string;
    handle: string;
    platform: string;
    status: string;
  };
  connections: VisionProfileConnection[];
  board: {
    pieceStyles: string[];
    themes: string[];
    preview: VisionBoardPreview;
  };
  app: {
    languages: string[];
    detailLevels: string[];
  };
};

export const visionMoments: VisionMoment[] = [
  {
    id: "moment-qxb7",
    moveNumber: 17,
    san: "Qxb7?",
    sideToMove: "Blancs",
    verdict: "À revoir",
    symbol: "?",
    category: "Tactique",
    shortCategory: "Tactique",
    pathStatus: "à rejouer",
    neuroScore: 58,
    neuroBand: "watch",
    why: "Tu gagnes un pion, mais tu laisses une ressource active aux Noirs.",
    impact: "La défense du roi devient fragile.",
    betterIdea: "Consolider avant de prendre du matériel.",
    action: "Rejoue ce moment, puis compare avec la ligne.",
    learnIdea: "Cherche les coups forcing avant de prendre le matériel.",
    learnWhy: "Le gain immédiat peut ouvrir une ressource adverse plus forte que le pion gagné.",
    checklist: ["Échecs", "Captures", "Menaces", "Roi faible"],
    takeaway: "Un pion gagné ne compense pas une défense désorganisée.",
    line: ["Qxb7?", "Rxb7", "Bxb7", "Qxb7"],
    branch: [
      { san: "Bxf7+", badge: "!", note: "force le roi" },
      { san: "Nxf7", badge: "=", note: "défense tenable" },
      { san: "Qxc3", badge: "?", note: "actif" },
    ],
    fen: "r1b3k1/1Q3ppp/2n1p3/p2P4/4N3/2B2N2/6PP/R1R3K1 w - - 0 17",
    highlights: ["b7", "g1", "c6"],
    arrow: ["c6", "b4", "rgba(246, 172, 87, 0.82)"],
    canReplay: true,
    canExplore: true,
  },
  {
    id: "moment-rd8",
    moveNumber: 24,
    san: "Rd8?!",
    sideToMove: "Noirs",
    verdict: "À revoir",
    symbol: "?!",
    category: "Conversion",
    shortCategory: "Conversion",
    pathStatus: "à revoir",
    neuroScore: 64,
    neuroBand: "watch",
    why: "Tu gardes l'avantage, mais tu laisses la tour adverse reprendre de l'activité.",
    impact: "La conversion devient plus longue et la position demande plus de précision.",
    betterIdea: "Limiter la contre-attaque avant d'échanger les pièces actives.",
    action: "Comprends l'ordre de coups, puis rejoue la conversion.",
    learnIdea: "Quand tu es mieux, coupe d'abord le contre-jeu.",
    learnWhy: "Un avantage matériel reste fragile si les pièces adverses gagnent du temps.",
    checklist: ["Pièce active", "Case d'entrée", "Échange utile", "Roi stable"],
    takeaway: "Convertir, c'est souvent retirer les ressources avant de chercher le gain final.",
    line: ["Rd8?!", "Rxd8", "Qxd8+", "Nxd8"],
    branch: [
      { san: "Rd8", badge: "?!", note: "ordre imprécis" },
      { san: "Rxd8", badge: "=", note: "résistance" },
      { san: "Qxd8+", badge: "!", note: "forcé" },
    ],
    fen: "3r2k1/5ppp/4p3/8/2Q5/6P1/5P1P/4R1K1 b - - 1 24",
    highlights: ["d8", "e1", "d1"],
    arrow: ["d8", "d1", "rgba(246, 172, 87, 0.82)"],
    canReplay: true,
    canExplore: true,
  },
  {
    id: "moment-bxe6",
    moveNumber: 19,
    san: "Bxe6!",
    sideToMove: "Blancs",
    verdict: "Bonne décision",
    symbol: "!",
    category: "Forcing",
    shortCategory: "Tactique",
    pathStatus: "exploré",
    neuroScore: 86,
    neuroBand: "strong",
    why: "Tu identifies le coup forcing qui enlève le défenseur principal.",
    impact: "Les Noirs n'ont plus le temps de consolider la colonne ouverte.",
    betterIdea: "Continuer à calculer les captures avant les coups calmes.",
    action: "Lis la ligne puis explore l'alternative défensive.",
    learnIdea: "Un sacrifice temporaire peut être concret s'il force les réponses.",
    learnWhy: "Les coups forcing réduisent les choix adverses et rendent le calcul plus fiable.",
    checklist: ["Échec", "Capture", "Défenseur", "Réponse forcée"],
    takeaway: "Quand les réponses sont forcées, calcule jusqu'au dernier échange utile.",
    line: ["Bxe6!", "fxe6", "Qxe6+", "Kh8"],
    branch: [
      { san: "Bxe6", badge: "!", note: "force" },
      { san: "fxe6", badge: "=", note: "obligé" },
      { san: "Qxe6+", badge: "!", note: "initiative" },
    ],
    fen: "r4rk1/1p3ppp/2n1b3/p2P4/4N3/2B2N2/6PP/R1R3K1 w - - 0 19",
    highlights: ["c4", "e6", "e6"],
    arrow: ["c4", "e6", "rgba(51, 197, 145, 0.82)"],
    canReplay: false,
    canExplore: true,
  },
  {
    id: "moment-h4",
    moveNumber: 28,
    san: "h4?!",
    sideToMove: "Blancs",
    verdict: "Micro-écart",
    symbol: "?!",
    category: "Plan",
    shortCategory: "Micro-écart",
    pathStatus: "à revoir",
    neuroScore: 72,
    neuroBand: "solid",
    why: "Le plan est logique, mais il donne aux Noirs un tempo de coordination.",
    impact: "La position reste saine, avec une marge plus fine.",
    betterIdea: "Améliorer la pièce la moins active avant de pousser le pion.",
    action: "Compare le plan calme avec une amélioration de pièce.",
    learnIdea: "Un bon plan peut attendre si une pièce reste mal placée.",
    learnWhy: "Les micro-écarts coûtent rarement tout de suite, mais ils réduisent les choix futurs.",
    checklist: ["Pièce passive", "Tempo adverse", "Roi", "Plan utile"],
    takeaway: "Avant un coup de plan, vérifie quelle pièce ne participe pas encore.",
    line: ["h4?!", "Re8", "Qd3", "Ne7"],
    branch: [
      { san: "h4", badge: "?!", note: "plan lent" },
      { san: "Re8", badge: "=", note: "coordonne" },
    ],
    fen: "4r1k1/5ppp/4p3/3P4/7P/2Q2N2/5PP1/5RK1 w - - 0 28",
    highlights: ["h2", "h4", "e8"],
    arrow: ["h2", "h4", "rgba(125, 211, 252, 0.76)"],
    canReplay: false,
    canExplore: true,
  },
  {
    id: "moment-kh2",
    moveNumber: 31,
    san: "Kh2!",
    sideToMove: "Blancs",
    verdict: "Bonne décision",
    symbol: "✓",
    category: "Défense",
    shortCategory: "Défense",
    pathStatus: "compris",
    neuroScore: 91,
    neuroBand: "strong",
    why: "Le roi sort du motif tactique et coupe l'initiative adverse.",
    impact: "La position reste sous contrôle malgré la pression.",
    betterIdea: "Garder une case de fuite avant de chercher du contre-jeu.",
    action: "Lis la ligne pour ancrer le réflexe défensif.",
    learnIdea: "Un coup calme peut être le coup le plus concret.",
    learnWhy: "La défense empêche la menace avant qu'elle devienne forcée.",
    checklist: ["Case de fuite", "Échec adverse", "Pièce clouée", "Coordination"],
    takeaway: "La prophylaxie gagne du temps quand l'attaque dépend d'un motif précis.",
    line: ["Kh2!", "Qd6+", "Kg1", "Re8"],
    branch: [
      { san: "Kh2", badge: "✓", note: "sort de la menace" },
      { san: "Qd6+", badge: "=", note: "échec contenu" },
    ],
    fen: "6k1/5ppp/3q4/8/8/5N2/6PP/5RK1 w - - 0 31",
    highlights: ["g1", "h2", "d6"],
    arrow: ["g1", "h2", "rgba(51, 197, 145, 0.82)"],
    canReplay: false,
    canExplore: false,
  },
  {
    id: "moment-nb5",
    moveNumber: 35,
    san: "Nb5",
    sideToMove: "Blancs",
    verdict: "À explorer",
    symbol: "◌",
    category: "Alternative",
    shortCategory: "Exploration",
    pathStatus: "exploré",
    neuroScore: 78,
    neuroBand: "solid",
    why: "L'idée cherche une case active, mais elle doit être vérifiée tactiquement.",
    impact: "La branche peut améliorer la coordination sans créer d'exercice.",
    betterIdea: "Tester la ligne localement avant de retenir le plan.",
    action: "Explore deux coups, puis analyse la ligne.",
    learnIdea: "Une alternative se juge avec une ligne courte, pas avec une intuition seule.",
    learnWhy: "Le test local permet de séparer une vraie ressource d'un coup séduisant.",
    checklist: ["Case active", "Réponse forcée", "Pièce attaquée", "Retour à la partie"],
    takeaway: "Explore pour apprendre, pas pour créer automatiquement un exercice.",
    line: ["Nb5", "Qd7", "Nc7", "Rc8"],
    branch: [
      { san: "Nb5", badge: "◌", note: "idée" },
      { san: "Qd7", badge: "=", note: "réponse" },
      { san: "Nc7", badge: "◌", note: "test" },
    ],
    fen: "2r3k1/3q1ppp/4p3/1N6/8/2Q2N2/5PP1/5RK1 w - - 0 35",
    highlights: ["d4", "b5", "c7"],
    arrow: ["d4", "b5", "rgba(125, 211, 252, 0.82)"],
    canReplay: false,
    canExplore: true,
  },
];

export const todayBoardPreview: VisionBoardPreview = {
  fen: visionMoments[0].fen,
  highlightSquare: "b7",
  arrow: { from: "c6", to: "b4" },
  label: "Décision du jour · Qxb7? · Défense du roi",
};

export const visionGames: VisionGame[] = [
  {
    id: "game-1",
    players: "SindarovGM vs OpponentOne",
    result: "1-0",
    status: "Review prête",
    score: "Solide",
    moments: "6 moments utiles",
    exercises: "4 exercices générés",
    userColor: "Blancs",
    date: "Hier · rapide 10+0",
    mainMoment: "Qxb7? · tactique",
    learningUse: "Commence par le moment le plus important.",
    statusDetail: "Review prête : cette partie contient 6 décisions utiles.",
    primaryAction: "Voir la Review",
    tone: "ready",
    boardPreview: {
      fen: visionMoments[0].fen,
      highlightSquare: "b7",
      arrow: { from: "c6", to: "b4" },
      label: "Moment clé · Qxb7? · tactique",
    },
    timeline: ["C17 ?", "C24 ?!", "C31 ✓"],
  },
  {
    id: "game-2",
    players: "bahij vs ClubRival",
    result: "0-1",
    status: "Analyse en cours",
    score: "Bilan en préparation",
    moments: "Moments en préparation",
    exercises: "Pas encore",
    userColor: "Noirs",
    date: "Aujourd'hui · classique",
    mainMoment: "Rd8?! · conversion",
    learningUse: "Analyse en préparation, tu peux revenir plus tard.",
    statusDetail: "Analyse en préparation : la partie est conservée.",
    primaryAction: "Reprendre l'analyse",
    tone: "running",
    boardPreview: {
      fen: visionMoments[1].fen,
      highlightSquare: "d8",
      arrow: { from: "d8", to: "d1" },
      label: "Moment clé · Rd8?! · conversion",
    },
    timeline: ["Import", "Analyse", "Review"],
  },
  {
    id: "game-3",
    players: "Training Match",
    result: "½-½",
    status: "Erreur récupérable",
    score: "Review à reprendre",
    moments: "Données partielles",
    exercises: "2 exercices brouillons",
    userColor: "Blancs",
    date: "3 mai · entraînement",
    mainMoment: "Kh2! · défense",
    learningUse: "Erreur récupérable : la partie est conservée.",
    statusDetail: "Review à reprendre sans perdre la partie.",
    primaryAction: "Reprendre l'analyse",
    tone: "recoverable",
    boardPreview: {
      fen: visionMoments[4].fen,
      highlightSquare: "h2",
      arrow: { from: "g1", to: "h2" },
      label: "Moment clé · Kh2! · défense",
    },
    timeline: ["PGN", "À reprendre", "Review"],
  },
];

export const visionPracticeQueue = [
  "C17 · Qxb7? · tactique",
  "C24 · Rd8?! · conversion",
  "C19 · Bxe6! · forcing",
];

export const visionPracticeItems: VisionPracticeItem[] = [
  {
    id: "practice-qxb7",
    momentId: "moment-qxb7",
    label: "Qxb7?",
    type: "Défense",
    status: "à faire",
    source: "issue de ta partie",
    whyReturns: "Cette position revient parce que la défense du roi compte.",
    instruction: "Trouve le meilleur plan sans afficher la correction.",
  },
  {
    id: "practice-bxe6",
    momentId: "moment-bxe6",
    label: "Bxe6!",
    type: "Tactique",
    status: "réussi",
    source: "revanche douce",
    whyReturns: "Tu as déjà trouvé l'idée, on consolide le réflexe forcing.",
    instruction: "Calcule les captures avant les coups calmes.",
  },
  {
    id: "practice-rd8",
    momentId: "moment-rd8",
    label: "Rd8?!",
    type: "Conversion",
    status: "à revoir",
    source: "review prête",
    whyReturns: "La conversion demande de couper le contre-jeu avant d'échanger.",
    instruction: "Neutralise la pièce active avant de simplifier.",
  },
  {
    id: "practice-kh2",
    momentId: "moment-kh2",
    label: "Kh2!",
    type: "Défense",
    status: "à faire",
    source: "bonne décision",
    whyReturns: "Un coup calme peut être la décision la plus concrète.",
    instruction: "Trouve la case qui coupe la menace.",
  },
  {
    id: "practice-h4",
    momentId: "moment-h4",
    label: "h4?!",
    type: "Conversion",
    status: "à faire",
    source: "micro-écart",
    whyReturns: "Le plan est sain, mais l'ordre de coups mérite d'être revu.",
    instruction: "Améliore d'abord la pièce la moins active.",
  },
];

export const visionProgressDays: VisionProgressDay[] = [
  { day: "J-29", label: "Il y a 29 jours", decisions: 0, positions: 0, intensity: 0 },
  { day: "J-28", label: "Il y a 28 jours", decisions: 2, positions: 1, intensity: 1 },
  { day: "J-27", label: "Il y a 27 jours", decisions: 4, positions: 2, intensity: 2 },
  { day: "J-26", label: "Il y a 26 jours", decisions: 0, positions: 0, intensity: 0 },
  { day: "J-25", label: "Il y a 25 jours", decisions: 5, positions: 2, intensity: 3 },
  { day: "J-24", label: "Il y a 24 jours", decisions: 1, positions: 1, intensity: 1 },
  { day: "J-23", label: "Il y a 23 jours", decisions: 0, positions: 0, intensity: 0 },
  { day: "J-22", label: "Il y a 22 jours", decisions: 3, positions: 2, intensity: 2 },
  { day: "J-21", label: "Il y a 21 jours", decisions: 6, positions: 3, intensity: 4 },
  { day: "J-20", label: "Il y a 20 jours", decisions: 2, positions: 1, intensity: 1 },
  { day: "J-19", label: "Il y a 19 jours", decisions: 0, positions: 0, intensity: 0 },
  { day: "J-18", label: "Il y a 18 jours", decisions: 4, positions: 2, intensity: 2 },
  { day: "J-17", label: "Il y a 17 jours", decisions: 5, positions: 3, intensity: 3 },
  { day: "J-16", label: "Il y a 16 jours", decisions: 0, positions: 0, intensity: 0 },
  { day: "J-15", label: "Il y a 15 jours", decisions: 1, positions: 1, intensity: 1 },
  { day: "J-14", label: "Il y a 14 jours", decisions: 3, positions: 2, intensity: 2 },
  { day: "J-13", label: "Il y a 13 jours", decisions: 4, positions: 2, intensity: 2 },
  { day: "J-12", label: "Il y a 12 jours", decisions: 0, positions: 0, intensity: 0 },
  { day: "J-11", label: "Il y a 11 jours", decisions: 2, positions: 1, intensity: 1 },
  { day: "J-10", label: "Il y a 10 jours", decisions: 6, positions: 3, intensity: 4 },
  { day: "J-9", label: "Il y a 9 jours", decisions: 3, positions: 2, intensity: 2 },
  { day: "J-8", label: "Il y a 8 jours", decisions: 0, positions: 0, intensity: 0 },
  { day: "J-7", label: "Il y a 7 jours", decisions: 2, positions: 1, intensity: 1 },
  { day: "J-6", label: "Il y a 6 jours", decisions: 5, positions: 2, intensity: 3 },
  { day: "J-5", label: "Il y a 5 jours", decisions: 4, positions: 2, intensity: 2 },
  { day: "J-4", label: "Il y a 4 jours", decisions: 0, positions: 0, intensity: 0 },
  { day: "J-3", label: "Il y a 3 jours", decisions: 3, positions: 1, intensity: 2 },
  { day: "J-2", label: "Avant-hier", decisions: 0, positions: 0, intensity: 0 },
  { day: "J-1", label: "Hier", decisions: 7, positions: 3, intensity: 4 },
  { day: "Aujourd'hui", label: "Aujourd'hui", decisions: 4, positions: 2, intensity: 3 },
];

export const visionWeeklyEffort: VisionWeeklyEffort[] = [
  { day: "Lun", decisions: 2, positions: 1 },
  { day: "Mar", decisions: 0, positions: 0 },
  { day: "Mer", decisions: 3, positions: 1 },
  { day: "Jeu", decisions: 0, positions: 0 },
  { day: "Ven", decisions: 4, positions: 2 },
  { day: "Sam", decisions: 5, positions: 2 },
  { day: "Dim", decisions: 4, positions: 1 },
];

export const visionConsolidatedDecisions: VisionConsolidatedDecision[] = [
  {
    id: "progress-qxb7",
    san: "Qxb7?",
    category: "Défense",
    dateLabel: "revu hier",
    status: "revu",
    boardPreview: {
      fen: visionMoments[0].fen,
      highlightSquare: "b7",
      arrow: { from: "c6", to: "b4" },
      label: "Qxb7? · Défense",
    },
  },
  {
    id: "progress-bxe6",
    san: "Bxe6!",
    category: "Tactique",
    dateLabel: "réussi il y a 3 jours",
    status: "réussi",
    boardPreview: {
      fen: visionMoments[2].fen,
      highlightSquare: "e6",
      arrow: { from: "c4", to: "e6" },
      label: "Bxe6! · Tactique",
    },
  },
  {
    id: "progress-rd8",
    san: "Rd8?!",
    category: "Conversion",
    dateLabel: "à revoir cette semaine",
    status: "à revoir",
    boardPreview: {
      fen: visionMoments[1].fen,
      highlightSquare: "d8",
      arrow: { from: "d8", to: "d1" },
      label: "Rd8?! · Conversion",
    },
  },
  {
    id: "progress-kh2",
    san: "Kh2!",
    category: "Bonne décision",
    dateLabel: "consolidé hier",
    status: "réussi",
    boardPreview: {
      fen: visionMoments[4].fen,
      highlightSquare: "h2",
      arrow: { from: "g1", to: "h2" },
      label: "Kh2! · Défense",
    },
  },
  {
    id: "progress-h4",
    san: "h4?!",
    category: "Conversion",
    dateLabel: "revu aujourd'hui",
    status: "revu",
    boardPreview: {
      fen: visionMoments[3].fen,
      highlightSquare: "h4",
      arrow: { from: "h2", to: "h4" },
      label: "h4?! · Plan",
    },
  },
];

export const visionProgressDomains: VisionProgressDomain[] = [
  { label: "Défense", state: "à consolider", decisions: 4, tone: "watch" },
  { label: "Tactique", state: "en progrès", decisions: 7, tone: "progress" },
  { label: "Conversion", state: "stable", decisions: 5, tone: "stable" },
];

export const visionProgressPlan30 = [
  { label: "sessions courtes", value: "12" },
  { label: "positions à revoir", value: "36" },
  { label: "revanches contre toi-même", value: "8" },
];

export const visionProfile: VisionProfileData = {
  user: {
    initials: "B",
    handle: "bahij",
    platform: "Lichess",
    status: "Données contrôlées localement",
  },
  connections: [
    {
      name: "Lichess",
      status: "Prévu",
      detail: "Connexion prévue pour automatiser l'import plus tard.",
      action: "Bientôt",
    },
    {
      name: "Chess.com",
      status: "Bientôt",
      detail: "Import futur sans synchronisation active aujourd'hui.",
      action: "Prévu",
    },
    {
      name: "Import PGN manuel",
      status: "Disponible",
      detail: "Le chemin manuel reste la source principale aujourd'hui.",
      action: "Manuel",
    },
  ],
  board: {
    pieceStyles: ["Classic", "Cburnett", "Staunton"],
    themes: ["Nebula", "Wood", "High contrast"],
    preview: {
      fen: visionMoments[2].fen,
      highlightSquare: "e6",
      arrow: { from: "c4", to: "e6" },
      label: "Aperçu échiquier · Bxe6!",
    },
  },
  app: {
    languages: ["Français", "English"],
    detailLevels: ["Essentiel", "Détaillé"],
  },
};
