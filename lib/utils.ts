// Fonctions utilitaires partagées dans toute l'application.
// Exemple : formater une date en français.

export function formatDateFr(date: Date): string {
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
