exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, message: 'Méthode non autorisée.' })
    };
  }

  const scriptUrl = process.env.APPS_SCRIPT_URL;
  const token = process.env.APPS_SCRIPT_TOKEN;

  if (!scriptUrl || !token) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, message: 'Configuration serveur incomplète.' })
    };
  }

  try {
    const incoming = JSON.parse(event.body || '{}');
    const allowedActions = ['getInitialData', 'submitEngagement'];

    if (!allowedActions.includes(incoming.action)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, message: 'Action inconnue.' })
      };
    }

    const upstream = await fetch(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: incoming.action,
        data: incoming.data || {},
        token: token
      }),
      redirect: 'follow'
    });

    const raw = await upstream.text();
    let result;
    try {
      result = JSON.parse(raw);
    } catch (_) {
      throw new Error('Google Apps Script n’a pas renvoyé de réponse JSON. Vérifie son déploiement Web.');
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
      },
      body: JSON.stringify(result)
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        success: false,
        message: error && error.message ? error.message : 'Erreur de communication avec Google Apps Script.'
      })
    };
  }
};
