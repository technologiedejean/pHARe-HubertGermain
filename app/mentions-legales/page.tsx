// >>> NOUVEAU FICHIER : app/mentions-legales/page.tsx <<<

import Link from "next/link";

/* ============================================================
   À personnaliser
   ============================================================ */
const ETABLISSEMENT = {
  nom: "Collège Hubert Germain",
  adresse: "[12 rue du vieux Châtre, 91580 Souzy la Briche]",
  email: "ce.0911256W@ac-versailles.fr",
  telephone: "01 64 56 65 45",
  chefEtablissement: "Didier Gence",
  dpoEmail: "[dpd@ac-versailles.fr]",
  academie: "académie de Versailles",
  referentApp: "William Dejean",
};
const DATE_MISE_A_JOUR = "septembre 2026";

/* ============================================================
   Sommaire
   ============================================================ */
const SECTIONS = [
  { id: "editeur", titre: "Éditeur du site" },
  { id: "hebergement", titre: "Hébergement" },
  { id: "finalite", titre: "Finalité du traitement" },
  { id: "donnees", titre: "Données traitées" },
  { id: "acces", titre: "Qui a accès aux données" },
  { id: "conservation", titre: "Conservation et effacement" },
  { id: "securite", titre: "Sécurité" },
  { id: "cookies", titre: "Cookies" },
  { id: "droits", titre: "Vos droits" },
];

/* ============================================================
   Composants de mise en page
   ============================================================ */
function Section({
  id,
  titre,
  children,
}: {
  id: string;
  titre: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-lg font-semibold text-[#1D216C] mb-3 pb-2 border-b border-[#EEEDF5]">
        {titre}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-gray-700">{children}</div>
    </section>
  );
}

function Encadre({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#EEEDF5] bg-white p-4 text-sm text-gray-700 space-y-1">
      {children}
    </div>
  );
}

/* ============================================================
   Page
   ============================================================ */
export default function MentionsLegalesPage() {
  return (
    <div className="min-h-screen bg-[#FBFBFD]">
      {/* En-tête */}
      <header className="bg-[#1D216C] text-white">
        <div className="max-w-6xl mx-auto px-4 py-6 lg:py-10">
          <p className="text-xs uppercase tracking-wider text-[#FCEA00] mb-2">pHARe</p>
          <h1 className="text-2xl lg:text-3xl font-bold">
            Mentions légales et protection des données
          </h1>
          <p className="text-sm text-white/70 mt-2">Dernière mise à jour : {DATE_MISE_A_JOUR}</p>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 lg:py-10">
        {/* ---------- MOBILE : sommaire replié ---------- */}
        <details className="lg:hidden mb-6 rounded-xl border border-[#EEEDF5] bg-white">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[#6656B8]">
            Sommaire
          </summary>
          <nav className="px-4 pb-3">
            <ul className="space-y-2 text-sm">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="text-gray-700 hover:text-[#6656B8]">
                    {s.titre}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </details>

        <div className="lg:grid lg:grid-cols-[240px_1fr] lg:gap-10">
          {/* ---------- DESKTOP : sommaire latéral fixe ---------- */}
          <aside className="hidden lg:block">
            <nav className="sticky top-6 rounded-xl border border-[#EEEDF5] bg-white p-4">
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-3">Sommaire</p>
              <ul className="space-y-2 text-sm">
                {SECTIONS.map((s) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} className="text-gray-700 hover:text-[#6656B8]">
                      {s.titre}
                    </a>
                  </li>
                ))}
              </ul>
              <Link
                href="/"
                className="mt-5 block text-sm font-medium text-[#6656B8] hover:underline"
              >
                ← Retour à l&apos;application
              </Link>
            </nav>
          </aside>

          {/* ---------- Contenu (commun) ---------- */}
          <main className="space-y-10">
            <Section id="editeur" titre="Éditeur du site">
              <p>
                Cette application est éditée par le <strong>{ETABLISSEMENT.nom}</strong>,
                établissement public local d&apos;enseignement relevant du ministère de
                l&apos;Éducation nationale.
              </p>
              <Encadre>
                <p>{ETABLISSEMENT.nom}</p>
                <p>{ETABLISSEMENT.adresse}</p>
                <p>Courriel : {ETABLISSEMENT.email}</p>
                <p>Téléphone : {ETABLISSEMENT.telephone}</p>
                <p>
                  Directeur de la publication : {ETABLISSEMENT.chefEtablissement}, chef
                  d&apos;établissement
                </p>
                <p>Administration technique : {ETABLISSEMENT.referentApp}</p>
              </Encadre>
              <p>
                L&apos;application est un outil interne, réservé aux personnels de
                l&apos;établissement membres de l&apos;équipe ressource du programme pHARe
                (programme de lutte contre le harcèlement à l&apos;école) et à la direction.
                Elle n&apos;est pas accessible au public.
              </p>
            </Section>

            <Section id="hebergement" titre="Hébergement">
              <p>
                L&apos;application web est hébergée par <strong>Vercel Inc.</strong> (440 N
                Barranca Ave #4133, Covina, CA 91723, États-Unis). Aucune donnée relative aux
                élèves n&apos;est stockée durablement chez cet hébergeur, qui exécute uniquement le
                code de l&apos;application.
              </p>
              <p>
                La base de données et le service d&apos;authentification sont fournis par{" "}
                <strong>Supabase Inc.</strong> (970 Toa Payoh North #07-04, Singapour). Les données
                sont physiquement stockées dans un centre de données situé en{" "}
                <strong>France (région Paris)</strong>, chiffrées au repos et en transit.
              </p>
              <p>
                Ces deux prestataires agissent en qualité de sous-traitants au sens de
                l&apos;article 28 du RGPD et sont liés par des accords de traitement des données
                intégrant les clauses contractuelles types de la Commission européenne.
              </p>
            </Section>

            <Section id="finalite" titre="Finalité du traitement">
              <p>
                Le responsable du traitement est le {ETABLISSEMENT.nom}, représenté par son chef
                d&apos;établissement.
              </p>
              <p>
                L&apos;application a pour finalité la mise en œuvre du programme pHARe : le recueil,
                la qualification et le suivi des situations de harcèlement ou d&apos;intimidation
                entre élèves, l&apos;organisation des entretiens menés avec les élèves concernés, la
                rédaction des comptes rendus de ces entretiens et la coordination des membres de
                l&apos;équipe ressource.
              </p>
              <p>
                Ce traitement est fondé sur la mission d&apos;intérêt public dont est investi
                l&apos;établissement (article 6.1.e du RGPD), en application des articles L. 111-6
                et L. 511-3-1 du code de l&apos;éducation relatifs à la prévention et à la lutte
                contre le harcèlement scolaire.
              </p>
            </Section>

            <Section id="donnees" titre="Données traitées">
              <p>Concernant les élèves impliqués dans une situation :</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>identité : nom, prénom, classe, niveau, genre ;</li>
                <li>
                  rôle dans la situation (victime, auteur présumé, témoin, lanceur
                  d&apos;alerte) ;
                </li>
                <li>
                  qualification de la situation : motifs, manifestations, lieux, gravité,
                  statut ;
                </li>
                <li>contenu des comptes rendus d&apos;entretien et notes de l&apos;équipe.</li>
              </ul>
              <p>
                Les comptes rendus peuvent contenir, en texte libre, des informations relevant de
                l&apos;article 9 du RGPD (état de santé, orientation, origine, convictions)
                lorsqu&apos;elles constituent le motif du harcèlement. Ces informations sont
                limitées au strict nécessaire à la compréhension et au traitement de la situation.
              </p>
              <p>Concernant les utilisateurs de l&apos;application (personnels) :</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>nom, prénom, adresse de courriel professionnelle, rôle ;</li>
                <li>disponibilités hebdomadaires déclarées ;</li>
                <li>journaux de connexion tenus par le service d&apos;authentification.</li>
              </ul>
              <p>
                Aucune donnée n&apos;est collectée auprès des élèves eux-mêmes par
                l&apos;application : les informations sont saisies par les personnels de
                l&apos;équipe ressource.
              </p>
            </Section>

            <Section id="acces" titre="Qui a accès aux données">
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  les membres de l&apos;équipe ressource pHARe, chacun disposant de droits
                  individualisés, situation par situation (lecture, complétion ou modification) ;
                </li>
                <li>le chef d&apos;établissement et son adjoint, à des fins de supervision ;</li>
                <li>
                  l&apos;administrateur de l&apos;application, pour la gestion des comptes et le
                  paramétrage.
                </li>
              </ul>
              <p>
                Aucune donnée n&apos;est transmise à des tiers, ni cédée, ni utilisée à d&apos;autres
                fins. Des éléments peuvent être communiqués ponctuellement aux autorités compétentes
                (services académiques, justice, protection de l&apos;enfance) uniquement dans le
                cadre des obligations légales de signalement qui incombent à l&apos;établissement.
              </p>
            </Section>

            <Section id="conservation" titre="Conservation et effacement">
              <p>
                <strong>
                  L&apos;ensemble des données de l&apos;application est effacé à la fin de chaque
                  année scolaire.
                </strong>{" "}
                Cette remise à zéro concerne les situations, les entretiens, les comptes rendus,
                les notes, le fichier des élèves et les statistiques. Aucune donnée numérique
                relative aux élèves n&apos;est conservée d&apos;une année sur l&apos;autre.
              </p>
              <p>
                Les situations encore actives au moment de la clôture de l&apos;année scolaire font
                l&apos;objet d&apos;une passation en dehors de l&apos;application, sous la
                responsabilité du chef d&apos;établissement, dans le respect des règles
                d&apos;archivage applicables aux établissements publics.
              </p>
              <p>
                Les comptes des personnels sont désactivés dès leur départ de
                l&apos;établissement. Les sauvegardes techniques réalisées par l&apos;hébergeur de
                la base de données sont conservées sept jours glissants, puis détruites.
              </p>
            </Section>

            <Section id="securite" titre="Sécurité">
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  accès individuel par identifiant et mot de passe, sans compte partagé, avec
                  obligation de changer le mot de passe à la première connexion ;
                </li>
                <li>
                  droits d&apos;accès appliqués au niveau de la base de données elle-même, de
                  sorte qu&apos;un utilisateur ne peut techniquement pas consulter une situation
                  qui ne lui a pas été attribuée ;
                </li>
                <li>chiffrement de toutes les communications (HTTPS) et des données au repos ;</li>
                <li>
                  horodatage et identification de l&apos;auteur de chaque compte rendu ; suivi
                  des lectures ;
                </li>
                <li>
                  suppression d&apos;une situation réservée aux administrateurs, avec
                  confirmation ;
                </li>
                <li>
                  engagement de confidentialité des membres de l&apos;équipe ressource, tenus au
                  secret professionnel.
                </li>
              </ul>
            </Section>

            <Section id="cookies" titre="Cookies">
              <p>
                L&apos;application n&apos;utilise aucun cookie de mesure d&apos;audience, de
                publicité ou de suivi. Les seuls éléments déposés dans votre navigateur sont
                strictement nécessaires au fonctionnement du service : ils maintiennent votre
                session ouverte après authentification et sont supprimés à la déconnexion. À ce
                titre, ils ne requièrent pas de consentement (article 82 de la loi Informatique
                et Libertés).
              </p>
            </Section>

            <Section id="droits" titre="Vos droits">
              <p>
                Conformément au RGPD et à la loi Informatique et Libertés, toute personne
                concernée dispose d&apos;un droit d&apos;accès, de rectification,
                d&apos;effacement, de limitation du traitement et d&apos;opposition pour des
                motifs tenant à sa situation particulière. Pour les élèves mineurs, ces droits
                s&apos;exercent par l&apos;intermédiaire de leurs responsables légaux, dans le
                respect de l&apos;intérêt de l&apos;enfant et de la protection des autres personnes
                mentionnées dans les comptes rendus.
              </p>
              <Encadre>
                <p>
                  <strong>Pour exercer vos droits</strong>, adressez une demande écrite au chef
                  d&apos;établissement :
                </p>
                <p>
                  {ETABLISSEMENT.nom} — {ETABLISSEMENT.adresse}
                </p>
                <p>Courriel : {ETABLISSEMENT.email}</p>
                <p className="pt-2">
                  <strong>Délégué à la protection des données</strong> de l&apos;
                  {ETABLISSEMENT.academie} : {ETABLISSEMENT.dpoEmail}
                </p>
              </Encadre>
              <p>
                Une réponse vous sera apportée dans un délai d&apos;un mois. Si vous estimez, après
                nous avoir contactés, que vos droits ne sont pas respectés, vous pouvez adresser
                une réclamation à la CNIL (
                <a
                  href="https://www.cnil.fr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#6656B8] underline"
                >
                  www.cnil.fr
                </a>
                ).
              </p>
            </Section>

            {/* Retour (mobile) */}
            <div className="lg:hidden pt-4">
              <Link
                href="/"
                className="inline-block rounded-lg bg-[#6656B8] px-4 py-2 text-sm font-medium text-white"
              >
                ← Retour à l&apos;application
              </Link>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}