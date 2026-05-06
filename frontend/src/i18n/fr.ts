export const fr = {
  nav: {
    today: "Aujourd'hui",
    games: "Mes parties",
    training: "Entraînement",
    profileSettings: "Profil / Paramètres",
  },
  actions: {
    retry: "Réessayer",
    continue: "Continuer",
    resume: "Reprendre",
    resumeAnalysis: "Reprendre l'analyse",
    repairAnalysis: "Vérifier / réparer l'analyse",
    restartFromZero: "Relancer depuis zéro",
    relaunchAnalysis: "Relancer l'analyse",
    checkAgain: "Vérifier à nouveau",
    checkRepairing: "Vérification...",
    hint: "Indice",
    showCorrection: "Voir la correction",
    skip: "Passer",
    tryAgain: "Essayer encore",
    showLine: "Voir la ligne",
    finish: "Terminer",
    nextPosition: "Position suivante",
    quit: "Quitter",
    startPractice: "Commencer l'entraînement",
    exploreMoments: "Explorer les moments",
    importGame: "Importer une partie",
    pastePgn: "Coller un PGN",
    correctPgn: "Corriger le PGN",
    openGame: "Ouvrir la partie",
    seeExample: "Voir un exemple",
    exportData: "Exporter mes données",
    deleteData: "Supprimer mes données",
  },
  confirmation: {
    deleteKeyword: "SUPPRIMER",
    typeDeleteToConfirm: "Tape SUPPRIMER pour confirmer la suppression.",
    typeDeleteLabel: "Tape SUPPRIMER pour confirmer.",
  },
  analysis: {
    running: "Analyse en cours",
    interrupted: "Analyse interrompue temporairement",
    interruptedWithResume:
      "Analyse interrompue temporairement. Tu peux reprendre l'analyse.",
    incompleteReview: "Review incomplète",
    incompleteReviewDetail:
      "Review incomplète. L'analyse est terminée, mais la Review finale n'est pas disponible.",
    finalizationAvailable: "Finalisation Review disponible",
    finalizingReview:
      "Finalisation de la Review... Toutes les positions ont été analysées.",
    retryCopy: "Vous pouvez reprendre l'analyse.",
    timeout:
      "L'analyse prend plus de temps que prévu. Réessayez plus tard.",
    pendingBackground:
      "L'analyse approfondie continue en arrière-plan. Vérifiez à nouveau dans quelques instants.",
    notReviewable: "Partie trop courte pour générer une review fiable.",
    noSignificantMoments:
      "Aucun moment majeur détecté : la partie est restée trop équilibrée pour générer une review utile.",
    stalled:
      "L'analyse approfondie n'a pas pu être lancée. Réessayez plus tard.",
    failedDeep:
      "L'analyse approfondie a échoué sur une ou plusieurs positions.",
  },
  review: {
    focusSummary: "Résumé",
    focusLearn: "Apprendre",
    focusPractice: "S'entraîner",
    focusExplorer: "Explorer",
  },
  liveAnalysis: {
    pausedDuringReview: "Analyse live en pause pendant la Review",
    pausedDuringPractice: "Analyse live en pause pendant l'exercice",
    unavailable: "analyse live indisponible",
    hiddenDuringPractice: "analyse live masquee pendant l'exercice",
    continuous: "analyse live continue",
  },
  import: {
    emptyTitle: "Colle une partie pour commencer",
    emptyMessage: "Ajoute un PGN ou importe une partie pour lancer l’analyse.",
    invalidTitle: "PGN non reconnu",
    invalidMessage:
      "Le texte ne ressemble pas à une partie PGN complète. Vérifie le copier-coller puis réessaie.",
    illegalTitle: "Un coup n’est pas légal",
    illegalMessage:
      "La partie contient un coup que NeuroChess ne peut pas rejouer correctement.",
    duplicateTitle: "Partie déjà importée",
    duplicateMessage: "Cette partie est déjà dans Mes parties.",
  },
  degradedStates: {
    backendUnavailable: {
      title: "NeuroChess local ne répond pas",
      message:
        "L’interface est ouverte, mais le service local ne répond pas pour le moment.",
      primaryActionLabel: "Réessayer",
      secondaryActionLabel: "Voir l’aide locale",
    },
    requestFailed: {
      title: "Action non terminée",
      message:
        "L’action n’a pas pu être terminée. Tes données déjà enregistrées restent conservées.",
      primaryActionLabel: "Réessayer",
    },
    dailyPlanCreateFailed: {
      title: "Plan indisponible",
      message: "Le plan du jour n’a pas pu être préparé.",
      primaryActionLabel: "Réessayer",
    },
    dailyPlanEmpty: {
      title: "Plan en construction",
      message:
        "Importe quelques parties et termine des exercices pour obtenir un plan fiable.",
      primaryActionLabel: "Importer une partie",
    },
    dailyPlanPartial: {
      title: "Plan court aujourd’hui",
      message:
        "On a moins de positions que prévu, mais tu peux déjà travailler utilement.",
      primaryActionLabel: "Commencer",
    },
    practiceSaveFailed: {
      title: "Tentative non enregistrée",
      message: "Le coup a été joué, mais la sauvegarde n’a pas abouti.",
      primaryActionLabel: "Réessayer d’enregistrer",
      secondaryActionLabel: "Voir la correction",
    },
    practiceNoItems: {
      title: "Pas encore d’exercice",
      message:
        "Importe et analyse quelques parties pour créer des positions d’entraînement.",
      primaryActionLabel: "Importer une partie",
    },
    practiceIllegalMove: {
      title: "Ce coup n’est pas légal",
      message: "Essaie un coup autorisé dans cette position.",
      primaryActionLabel: "Réessayer",
    },
    practiceRevealUsed: {
      title: "Correction consultée",
      message: "Bonne décision de regarder. Cette position reviendra bientôt.",
    },
    practiceCompleted: {
      title: "Session terminée",
      message: "Ces positions reviendront au bon moment.",
      primaryActionLabel: "Retour à Aujourd’hui",
      secondaryActionLabel: "Revoir mes erreurs",
    },
    antiTiltRepeatedWrong: {
      title: "Position difficile",
      message:
        "Cette position est difficile. Prends ton temps : l’objectif est d’apprendre, pas de réussir du premier coup.",
      primaryActionLabel: "Réessayer",
      secondaryActionLabel: "Voir la correction",
    },
  },
  practice: {
    reviewTrainingAria: "Entraînement Review",
    recommendedSession: "Session recommandée",
    startReviewPractice: "S'entraîner sur cette Review",
    planBuilding: "Plan en construction",
    preparing: "Préparation...",
    preparingPositions: "Préparation des positions à travailler.",
    completed: "Session terminée",
    completedSentence: "Session terminée.",
    revealedSolutions: "Solutions révélées",
    unknown: "Inconnu",
    noPosition: "0 position",
    modeAria: "Mode entraînement Review",
    challengeTitle: "Trouve le meilleur coup.",
    hintPrefix: "Indice",
    solutionPrefix: "Solution",
    solutionWhy: "Pourquoi la solution aide",
    keyIdea: "Idée clé",
    lineContrast: "Contraste des lignes",
  },
  feedback: {
    moveUnavailable: "coup non disponible",
    solutionUnavailable: "solution indisponible",
    solutionUnavailableCapitalized: "Solution indisponible",
    yourMove: "Ton coup",
    playedMove: "Coup joué",
    acceptedIdea: "Bonne idée",
    needsReview: "À vérifier",
    problem: "Problème",
    bestIdea: "Meilleure idée",
    reviewNeedsRebuild: "Review à reconstruire",
    rebuildBeforeCorrection:
      "Réanalyse cette Review avant de corriger cette position.",
    acceptedMain: "Bien joué : ton coup répond à l'idée critique.",
    rebuildMain: "Cette position doit être reconstruite avant correction.",
    wrongMain: "Voici ce que ton coup a permis.",
    currentAttemptWrong:
      "Pas encore. Ce coup ne répond pas à l'idée clé de la position.",
    currentAttemptPlayable:
      "C'est jouable, mais l'idée critique était plus forte.",
    currentAttemptIllegal: "Ce coup n'est pas légal dans cette position.",
    successAttemptTitle: "Tentative réussie",
    attemptSentTitle: "Tentative envoyée",
    viewWhyItWorks: "Voir pourquoi ça marche",
    correctionWhyTitle: "Pourquoi ça marche",
    historicalIdeaMissed: "Dans la partie, cette idée avait été manquée.",
    recoveredGain: (points: number) =>
      `Gain récupéré : +${points} pts par rapport au coup joué.`,
    historicalImpact: (impact: string) => `Impact : ${impact}.`,
    qualityLabel: (quality: string) => `Qualité : ${quality}`,
    lineHistoricalContext: "Dans la partie",
    historicalPlayedMove: (move: string) =>
      `Coup joué dans la partie : ${move}`,
    bestMoveMissed: (move: string) => `Le meilleur coup était : ${move}`,
    bestMoveSuccess: (move: string) =>
      `Bien joué. Tu as trouvé l’idée critique : ${move}.`,
    acceptedMove:
      "Bonne idée. Ce coup répond au problème principal de la position.",
    wrongMove: (bestMove: string) => `Pas encore. Le coup clé était ${bestMove}.`,
    illegalMove: "Ce coup n’est pas légal dans cette position.",
  },
  profilePrivacy: {
    title: "Profil / Paramètres",
    exportData: "Exporter mes données",
    exportInProgress: "Export en cours...",
    deleteData: "Supprimer mes données",
    confirmRequired: "Confirmation obligatoire",
    exportGenerated: "Export JSON généré.",
    exportFailedPrefix: "Export impossible",
    deleteFailedPrefix: "Suppression impossible",
  },
  training: {
    dailyPlan: "Plan du jour",
    failedPositions: "Mes positions ratées",
    revisions: "Révisions",
    start: "Commencer",
    revise: "Réviser",
    returnTraining: "Retour entraînement",
    returnToday: "Retour aujourd'hui",
    returnGames: "Retour aux parties",
  },
  games: {
    actionsAria: "Actions Mes parties",
    panelAria: "Panneau Mes parties",
    imported: "Importées",
    local: "Locales",
  },
} as const;
