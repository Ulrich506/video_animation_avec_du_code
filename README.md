# CV animé de Root

Cette animation autonome est composée de trois fichiers à garder ensemble :

- `index.html` : structure de la page et commandes ;
- `styles.css` : interface et adaptation à la fenêtre ;
- `app.js` : dessin du personnage, scènes, timeline et export vidéo.

GSAP est chargé depuis cdnjs : une connexion Internet est nécessaire au démarrage.

## Lancer dans un navigateur avec localhost

1. Installez Python 3 si nécessaire, puis ouvrez un terminal dans le dossier du projet.
2. Démarrez un serveur local :

   **Linux / macOS**

   ```bash
   python3 -m http.server 8000
   ```

   **Windows**

   ```powershell
   py -m http.server 8000
   ```

3. Ouvrez **http://localhost:8000** dans Chrome ou Firefox récent.
4. Cliquez sur **Lecture**. Utilisez **Pause**, **Recommencer** ou la barre de lecture pour naviguer dans la vidéo.
5. Choisissez le format d’écran et la résolution, puis cliquez sur **Exporter en WebM**. L’export prend 60 secondes : gardez l’onglet ouvert jusqu’au téléchargement.
6. Pour arrêter le serveur, revenez au terminal et appuyez sur `Ctrl+C`.

L’export utilise `canvas.captureStream()` et `MediaRecorder`. Il est pris en charge par les versions récentes de Chrome et Firefox ; le navigateur doit proposer un encodeur WebM.

## Formats d’écran et résolution

Les formats disponibles réorganisent le contenu pour chaque orientation ; ils ne font pas que recadrer l’image :

| Format | Dimensions source | Utilisation |
| --- | ---: | --- |
| Bureau | 1920 × 1080 | Écran large 16:9 |
| Portable | 1600 × 900 | Ordinateur portable 16:9 |
| Tablette | 1440 × 1080 | Tablette 4:3 |
| Mobile / Shorts | 1080 × 1920 | Téléphone vertical 9:16 |
| Pliable | 1440 × 1800 | Écran intérieur 4:5 |

Le choix de résolution réduit la définition source (1080p, 720p ou 480p). **Qualité source** conserve la définition du format choisi.

## Personnaliser

Dans `app.js`, modifiez `CONFIG` pour changer le nom, la formation, les compétences, les projets, le stage et les coordonnées. Les couleurs principales sont dans `CONFIG.colors`, et les durées de chaque scène sont regroupées dans `SCENE_DURATIONS` ; leur somme doit rester égale à 60 secondes. Le chibi vectoriel inspiré de l’image de référence se trouve dans la fonction `drawChibi()`.
