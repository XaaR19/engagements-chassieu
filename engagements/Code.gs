const SPREADSHEET_ID = '1mlR2trKFjbl-IzmECesGhTTULjZsnXBRAwRLwQp63Bo';

const SHEET_ROSTER = 'Roster';
const SHEET_EVENTS = 'Epreuves';
const SHEET_COMPETITIONS = 'Competitions';
const SHEET_RESPONSES = 'Reponses';

// Même valeur à renseigner dans Netlify > Environment variables > APPS_SCRIPT_TOKEN.
const API_TOKEN = 'Fn9CApV3twLIQPikNWOUL34177JsMxEJ3x81WY0KW0Q';

const CLASSIC_TYPE = 'Triathlon classique (course - saut - lancer)';
const WINTER_TYPE = 'Triathlon hivernal (50m - 50 haies - concours)';

const CLASSIC_COURSES = [
  '50 m',
  '50 m haies',
  '1 000 m',
  '2 000 m marche'
];

const RESPONSE_HEADERS = [
  'Date',
  'Compétition',
  'ID',
  'Nom',
  'Licence',
  'Catégorie',
  'Sexe',
  'Type',
  'Épreuve 1',
  'Épreuve 2',
  'Épreuve 3'
];

function getSpreadsheet_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/**
 * Point d'entrée API. Netlify appelle cette fonction côté serveur.
 * Ne pas remettre HtmlService ici : l'interface est maintenant hébergée sur Netlify.
 */
function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    if (payload.token !== API_TOKEN) {
      return jsonResponse_({ success: false, message: 'Accès refusé.' });
    }

    let result;

    if (payload.action === 'getInitialData') {
      result = getInitialData();
    } else if (payload.action === 'submitEngagement') {
      result = submitEngagement(payload.data);
    } else {
      throw new Error('Action API inconnue.');
    }

    return jsonResponse_(result);
  } catch (error) {
    return jsonResponse_({
      success: false,
      message: error && error.message ? error.message : String(error)
    });
  }
}

function doGet() {
  return jsonResponse_({
    success: true,
    message: 'API Engagements U14 opérationnelle.'
  });
}

function jsonResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getInitialData() {
  const ss = getSpreadsheet_();

  const rosterSheet = ss.getSheetByName(SHEET_ROSTER);
  const eventsSheet = ss.getSheetByName(SHEET_EVENTS);
  const competitionsSheet = ss.getSheetByName(SHEET_COMPETITIONS);

  if (!rosterSheet || !eventsSheet || !competitionsSheet) {
    throw new Error(
      'Un des onglets Roster, Epreuves ou Competitions est introuvable.'
    );
  }

  const athletes = readObjects_(rosterSheet)
    .filter(row =>
      isActive_(row.Actif) &&
      normalizeCategory_(row.Categorie) === 'U14'
    )
    .map(row => ({
      id: String(row.ID || '').trim(),
      nom: String(row.Nom || '').trim(),
      categorie: 'U14',
      sexe: normalizeSex_(row.Sexe)
    }))
    .filter(a => a.id && a.nom && ['F', 'G'].includes(a.sexe));

  const events = readObjects_(eventsSheet)
    .filter(row =>
      isActive_(row.Actif) &&
      normalizeCategory_(row.Categorie) === 'U14'
    )
    .map(row => ({
      epreuve: String(row.Epreuve || '').trim(),
      famille: normalizeFamily_(row.Famille),
      sexe: normalizeSex_(row.Sexe)
    }))
    .filter(e => e.epreuve && ['F', 'G'].includes(e.sexe));

  const competitions = getActiveCompetitions_(competitionsSheet);

  return {
    athletes: athletes,
    events: events,
    competitions: competitions
  };
}

function getActiveCompetitions_(sheet) {
  const values = sheet.getDataRange().getValues();

  if (values.length < 2) return [];

  const headers = values[0].map(h =>
    String(h).trim().toLowerCase()
  );

  const competitionIndex = headers.findIndex(h =>
    ['competition', 'nom compétition', 'nom competition'].includes(h)
  );

  const activeIndex = headers.findIndex(h =>
    ['actif', 'active'].includes(h)
  );

  if (competitionIndex === -1 || activeIndex === -1) {
    throw new Error(
      'Dans Competitions, les en-têtes doivent être Competition et Actif.'
    );
  }

  return values.slice(1)
    .filter(row => isActive_(row[activeIndex]))
    .map(row => String(row[competitionIndex] || '').trim())
    .filter(name => name);
}

function submitEngagement(data) {
  if (!data) throw new Error('Aucune donnée reçue.');

  const competition = String(data.competition || '').trim();
  const athleteId = String(data.athleteId || '').trim();
  const type = String(data.type || '').trim();

  let selectedEvents;

  if (type === CLASSIC_TYPE) {
    selectedEvents = [
      String(data.event1 || '').trim(),
      String(data.event2 || '').trim(),
      String(data.event3 || '').trim()
    ];
  } else if (type === WINTER_TYPE) {
    selectedEvents = [
      '50 m',
      '50 m haies',
      String(data.event3 || '').trim()
    ];
  } else {
    throw new Error('Type de triathlon non reconnu.');
  }

  if (!competition) {
    throw new Error('Merci de sélectionner une compétition.');
  }

  if (!athleteId) {
    throw new Error('Merci de sélectionner un athlète.');
  }

  if (selectedEvents.some(event => !event)) {
    throw new Error('Merci de sélectionner toutes les épreuves demandées.');
  }

  if (new Set(selectedEvents).size !== 3) {
    throw new Error('Une même épreuve ne peut pas être sélectionnée plusieurs fois.');
  }

  const ss = getSpreadsheet_();

  const rosterSheet = ss.getSheetByName(SHEET_ROSTER);
  const eventsSheet = ss.getSheetByName(SHEET_EVENTS);
  const competitionsSheet = ss.getSheetByName(SHEET_COMPETITIONS);

  if (!rosterSheet || !eventsSheet || !competitionsSheet) {
    throw new Error('Un onglet nécessaire est introuvable.');
  }

  const activeCompetitions = getActiveCompetitions_(competitionsSheet);

  if (!activeCompetitions.includes(competition)) {
    throw new Error('Cette compétition n’est plus active. Recharge le formulaire.');
  }

  const athlete = readObjects_(rosterSheet).find(row =>
    String(row.ID || '').trim() === athleteId &&
    isActive_(row.Actif) &&
    normalizeCategory_(row.Categorie) === 'U14'
  );

  if (!athlete) {
    throw new Error('Athlète introuvable, inactif ou non U14.');
  }

  const sex = normalizeSex_(athlete.Sexe);

  const availableEvents = readObjects_(eventsSheet)
    .filter(row =>
      isActive_(row.Actif) &&
      normalizeCategory_(row.Categorie) === 'U14' &&
      normalizeSex_(row.Sexe) === sex
    );

  const eventDetails = selectedEvents.map(name =>
    availableEvents.find(row =>
      String(row.Epreuve || '').trim() === name
    )
  );

  if (eventDetails.some(event => !event)) {
    throw new Error(
      'Une épreuve ne correspond pas à la catégorie ou au sexe de l’athlète.'
    );
  }

  const families = eventDetails.map(row =>
    normalizeFamily_(row.Famille)
  );

  if (type === CLASSIC_TYPE) {
    const courseIndex = selectedEvents.findIndex(name =>
      CLASSIC_COURSES.includes(name)
    );

    if (courseIndex === -1) {
      throw new Error('Le triathlon classique nécessite une course.');
    }

    const remainingFamilies = families.filter((family, index) =>
      index !== courseIndex
    );

    if (
      remainingFamilies.filter(f => f === 'SAUT').length !== 1 ||
      remainingFamilies.filter(f => f === 'LANCER').length !== 1
    ) {
      throw new Error(
        'Le triathlon classique nécessite une course, un saut et un lancer.'
      );
    }
  }

  if (type === WINTER_TYPE) {
    if (
      selectedEvents[0] !== '50 m' ||
      selectedEvents[1] !== '50 m haies' ||
      !['SAUT', 'LANCER'].includes(families[2])
    ) {
      throw new Error(
        'Le triathlon hivernal nécessite 50 m, 50 m haies et un concours.'
      );
    }
  }

  let responseSheet = ss.getSheetByName(SHEET_RESPONSES);

  if (!responseSheet) {
    responseSheet = ss.insertSheet(SHEET_RESPONSES);
    responseSheet.appendRow(RESPONSE_HEADERS);
  } else if (responseSheet.getLastRow() === 0) {
    responseSheet.appendRow(RESPONSE_HEADERS);
  }

  responseSheet.appendRow([
    new Date(),
    competition,
    athleteId,
    String(athlete.Nom || '').trim(),
    String(athlete.Licence || '').trim(),
    'U14',
    sex,
    type,
    selectedEvents[0],
    selectedEvents[1],
    selectedEvents[2]
  ]);

  return {
    success: true,
    message: 'Engagement enregistré.'
  };
}

function readObjects_(sheet) {
  const values = sheet.getDataRange().getValues();

  if (values.length < 2) return [];

  const headers = values[0].map(header =>
    String(header).trim()
  );

  return values.slice(1)
    .filter(row =>
      row.some(cell => cell !== '' && cell !== null)
    )
    .map(row => {
      const object = {};
      headers.forEach((header, index) => {
        object[header] = row[index];
      });
      return object;
    });
}

function isActive_(value) {
  return ['oui', 'yes', 'true', '1'].includes(
    String(value).trim().toLowerCase()
  );
}

function normalizeCategory_(value) {
  const normalized = String(value).trim().toUpperCase();

  if (['U14', 'BENJAMIN', 'BENJAMINS'].includes(normalized)) {
    return 'U14';
  }

  return normalized;
}

function normalizeSex_(value) {
  const normalized = String(value).trim().toUpperCase();

  if (
    ['F', 'FILLE', 'FILLES', 'FÉMININ', 'FEMININ'].includes(normalized)
  ) {
    return 'F';
  }

  if (
    ['G', 'M', 'GARÇON', 'GARCON', 'GARÇONS', 'GARCONS', 'MASCULIN'].includes(normalized)
  ) {
    return 'G';
  }

  return normalized;
}

function normalizeFamily_(value) {
  const normalized = String(value).trim().toUpperCase();

  if (normalized === 'HAIE' || normalized === 'HAIES') {
    return 'HAIES';
  }

  if (normalized === 'COURSE') return 'COURSE';
  if (normalized === 'SAUT') return 'SAUT';
  if (normalized === 'LANCER') return 'LANCER';

  return normalized;
}
