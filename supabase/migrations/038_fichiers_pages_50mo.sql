-- Fichiers joints d'une page : 50 Mo par fichier (10 Mo auparavant), pour une
-- bande audio. Le plafond de l'application (lib/fichiersPage.ts) et celui du
-- seau doivent être identiques ; l'offre gratuite de Supabase plafonne de toute
-- façon un fichier à 50 Mo (réglage global : Storage → Settings).
update storage.buckets set file_size_limit = 52428800 where id = 'pages-fichiers';
