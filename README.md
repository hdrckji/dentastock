# DentaStock

Application web de gestion des stocks pour cabinet dentaire.

Le projet couvre deja :

- references produits
- marque, description, code EAN, photo
- categories
- fournisseurs
- lots et dates de peremption
- suivi des entrees et sorties
- stock minimum
- suggestions de commande en mode simple ou avance

## Stack

- Next.js 16
- React 19
- Prisma
- PostgreSQL
- Railway pour le premier hebergement

## Lancer le projet en local

1. Creer un fichier `.env` a la racine du projet.
2. Copier la variable de `.env.example`.
3. Remplacer `DATABASE_URL` par l'URL PostgreSQL fournie par Railway.
4. Installer les dependances.
5. Creer la migration initiale.
6. Lancer le serveur.

```bash
npm install
npm run db:migrate -- --name init
npm run dev
```

L'application sera accessible sur http://localhost:3000.

## Brancher Railway

1. Creer un projet Railway.
2. Ajouter un service PostgreSQL.
3. Recuperer la variable de connexion PostgreSQL.
4. La placer dans `.env` localement et dans les variables d'environnement du service web Railway.
5. Verifier que l'URL contient bien `sslmode=require`.

Exemple :

```env
DATABASE_URL="postgresql://postgres:password@HOST:PORT/railway?sslmode=require"
```

## Scripts utiles

```bash
npm run dev
npm run lint
npm run build
npm run db:generate
npm run db:migrate -- --name init
npm run db:deploy
npm run db:studio
```

## Etat actuel

- interface d'accueil DentaStock prete
- calcul de propositions simple et avance pret
- APIs produits, configuration admin et suggestions pretes
- schema Prisma metier pret

## Point encore en attente

- connexion a la vraie base Railway
- premiere migration Prisma appliquee
- ecrans complets pour categories, fournisseurs, lots et mouvements
- auto-remplissage via EAN depuis des sources externes
