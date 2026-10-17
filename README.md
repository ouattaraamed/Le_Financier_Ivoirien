# Le Financier Ivoirien

Média financier ivoirien : actualités économiques, BRVM, banques, entreprises et investissement.

Site : [lefinancierivoirien.com](https://lefinancierivoirien.com/)

## Structure

- `index.html` — accueil
- `brvm.html`, `banques.html`, `entreprises.html`, `economie.html` — rubriques
- `a-propos.html`, `contact.html`, `mentions-legales.html` — pages institutionnelles
- `admin.html` — publication des articles (authentification Supabase)
- `css/site.css` — charte graphique
- `js/config.js` — configuration publique
- `api/article.js` — page article (Open Graph / SEO)

## Lancer en local

Ouvrir `index.html` dans le navigateur, ou déployer sur Vercel.

## Administration

L’accès à `admin.html` se fait avec un compte Supabase Auth.
Les articles sont stockés dans la table `Articles`.
