// Client API pour communiquer avec le serveur de jeu
export async function gameApi(action: string, params: Record<string, unknown> = {}) {
  const res = await fetch('/api/game', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...params }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erreur serveur');
  return data;
}
